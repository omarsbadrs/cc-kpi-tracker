import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"
import {
  createAssignmentSchema,
  bulkAssignSchema,
} from "@/lib/validations/assignments"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { session }) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize } = parsePagination(searchParams)
  const userId = searchParams.get("userId") || session.user.id
  const evalPeriodId = searchParams.get("evalPeriodId") || undefined

  // Non-admins/managers can only see their own
  const effectiveUserId =
    session.user.role === "ADMIN" || session.user.role === "MANAGER"
      ? userId
      : session.user.id

  const where: Record<string, unknown> = {
    userId: effectiveUserId,
    isActive: true,
  }
  if (evalPeriodId) where.evalPeriodId = evalPeriodId

  // Get user tier so we can include the tier-specific target
  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { tier: true },
  })

  const [assignments, total] = await Promise.all([
    prisma.kpiAssignment.findMany({
      where,
      include: {
        kpiDefinition: {
          include: {
            pillar: { select: { code: true, name: true } },
            targets: user ? { where: { tier: user.tier }, take: 1 } : false,
          },
        },
        evalPeriod: {
          select: { name: true, startDate: true, endDate: true },
        },
        actuals: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { kpiDefinition: { sortOrder: "asc" } },
      ...paginateQuery(page, pageSize),
    }),
    prisma.kpiAssignment.count({ where }),
  ])

  return success(assignments, buildMeta(page, pageSize, total))
})

export const POST = withAuth(async (req) => {
  const body = await req.json()

  // Try bulk assignment first
  const bulkParsed = bulkAssignSchema.safeParse(body)
  if (bulkParsed.success) {
    const { userIds, kpiDefinitionIds, evalPeriodId } = bulkParsed.data

    // Validate that the eval period exists
    const period = await prisma.evalPeriod.findUnique({
      where: { id: evalPeriodId },
    })
    if (!period) {
      return error(404, "NOT_FOUND", "Evaluation period not found")
    }

    const data = userIds.flatMap((userId) =>
      kpiDefinitionIds.map((kpiDefinitionId) => ({
        userId,
        kpiDefinitionId,
        evalPeriodId,
      }))
    )

    const result = await prisma.kpiAssignment.createMany({
      data,
      skipDuplicates: true,
    })

    logger.info({ count: result.count }, "Bulk KPI assignments created")
    return success({ created: result.count })
  }

  // Single assignment
  const parsed = createAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    return error(
      400,
      "VALIDATION_ERROR",
      "Invalid input",
      parsed.error.issues.map((i) => ({
        field: String(i.path[0]),
        message: i.message,
      }))
    )
  }

  // Check for duplicate
  const existing = await prisma.kpiAssignment.findUnique({
    where: {
      userId_kpiDefinitionId_evalPeriodId: {
        userId: parsed.data.userId,
        kpiDefinitionId: parsed.data.kpiDefinitionId,
        evalPeriodId: parsed.data.evalPeriodId,
      },
    },
  })
  if (existing) {
    return error(
      409,
      "CONFLICT",
      "This KPI is already assigned to the user for this period"
    )
  }

  const assignment = await prisma.kpiAssignment.create({
    data: parsed.data,
    include: {
      kpiDefinition: { select: { code: true, name: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  })

  logger.info(
    {
      assignmentId: assignment.id,
      userId: parsed.data.userId,
      kpiId: parsed.data.kpiDefinitionId,
    },
    "KPI assignment created"
  )
  return success(assignment)
}, "ADMIN")

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return error(400, "VALIDATION_ERROR", "Missing assignment ID")

  const existing = await prisma.kpiAssignment.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "Assignment not found")

  await prisma.kpiAssignment.update({
    where: { id },
    data: { isActive: false },
  })

  logger.info({ assignmentId: id }, "KPI assignment deactivated")
  return success({ message: "Assignment removed" })
}, "ADMIN")
