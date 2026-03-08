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
  const myTeam = searchParams.get("myTeam") === "true"
  const fetchAll = (userId === "all" || myTeam) && (session.user.role === "ADMIN" || session.user.role === "MANAGER")

  // Non-admins/managers can only see their own
  const effectiveUserId = fetchAll
    ? undefined
    : (session.user.role === "ADMIN" || session.user.role === "MANAGER")
      ? userId
      : session.user.id

  const where: Record<string, unknown> = {
    isActive: true,
  }

  // For myTeam on MANAGER: limit to their full descendant hierarchy
  if (myTeam && session.user.role === "MANAGER") {
    const everyone = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, managerId: true },
    })
    const childIndex = new Map<string, string[]>()
    for (const u of everyone) {
      if (u.managerId) {
        const arr = childIndex.get(u.managerId) ?? []
        arr.push(u.id)
        childIndex.set(u.managerId, arr)
      }
    }
    function collectDescendants(rootId: string): string[] {
      const children = childIndex.get(rootId) ?? []
      const result: string[] = [...children]
      for (const c of children) result.push(...collectDescendants(c))
      return result
    }
    where.userId = { in: collectDescendants(session.user.id) }
  } else if (effectiveUserId) {
    where.userId = effectiveUserId
  }

  if (evalPeriodId) where.evalPeriodId = evalPeriodId
  // Exclude admin users from the hub view — admins manage KPIs, not assigned to them
  if (fetchAll) where.user = { role: { not: "ADMIN" } }

  // For single-user queries, get tier-specific targets
  let userTier: string | undefined
  if (effectiveUserId) {
    const user = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { tier: true },
    })
    userTier = user?.tier
  }

  const includeUser = fetchAll
    ? { select: { id: true, email: true, firstName: true, lastName: true, tier: true, role: true } }
    : undefined

  const includeTargets = userTier
    ? { where: { tier: userTier as import("@prisma/client").Tier }, take: 1 }
    : fetchAll
      ? true
      : undefined

  const [assignments, total] = await Promise.all([
    prisma.kpiAssignment.findMany({
      where,
      include: {
        ...(includeUser ? { user: includeUser } : {}),
        kpiDefinition: {
          include: {
            pillar: { select: { code: true, name: true } },
            ...(includeTargets ? { targets: includeTargets } : {}),
          },
        },
        evalPeriod: {
          select: { name: true, startDate: true, endDate: true },
        },
        actuals: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          include: { evidenceFiles: true },
        },
      },
      orderBy: fetchAll
        ? [{ user: { lastName: "asc" } }, { kpiDefinition: { sortOrder: "asc" } }]
        : { kpiDefinition: { sortOrder: "asc" } },
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
