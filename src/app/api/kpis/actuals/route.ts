import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"
import { submitActualSchema } from "@/lib/validations/actuals"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { session }) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize } = parsePagination(searchParams)
  const userId = searchParams.get("userId") || session.user.id
  const evalPeriodId = searchParams.get("evalPeriodId") || undefined
  const status = searchParams.get("status") || undefined
  const kpiCode = searchParams.get("kpiCode") || undefined
  const pillarCode = searchParams.get("pillarCode") || undefined

  // Non-admins/managers can only see their own
  const effectiveUserId =
    session.user.role === "ADMIN" || session.user.role === "MANAGER"
      ? userId
      : session.user.id

  const where: Record<string, unknown> = { userId: effectiveUserId }
  if (evalPeriodId) where.evalPeriodId = evalPeriodId
  if (status) where.status = status

  // Filter by KPI code or pillar code via nested relation
  if (kpiCode || pillarCode) {
    const assignmentWhere: Record<string, unknown> = {}
    if (kpiCode) {
      assignmentWhere.kpiDefinition = { code: kpiCode }
    }
    if (pillarCode) {
      assignmentWhere.kpiDefinition = {
        ...((assignmentWhere.kpiDefinition as Record<string, unknown>) || {}),
        pillar: { code: pillarCode },
      }
    }
    where.assignment = assignmentWhere
  }

  const [actuals, total] = await Promise.all([
    prisma.kpiActual.findMany({
      where,
      include: {
        assignment: {
          include: {
            kpiDefinition: {
              include: { pillar: { select: { code: true, name: true } } },
            },
          },
        },
        evidenceFiles: true,
      },
      orderBy: { createdAt: "desc" },
      ...paginateQuery(page, pageSize),
    }),
    prisma.kpiActual.count({ where }),
  ])

  return success(actuals, buildMeta(page, pageSize, total))
})

export const POST = withAuth(async (req, { session }) => {
  // Only admins and managers can submit actuals
  if (session.user.role === "USER") {
    return error(403, "FORBIDDEN", "Only admins and managers can submit actual values")
  }

  const body = await req.json()
  const parsed = submitActualSchema.safeParse(body)
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

  const { assignmentId, evalPeriodId, actualValue, binaryValue } = parsed.data

  // Verify the assignment exists
  const assignment = await prisma.kpiAssignment.findUnique({
    where: { id: assignmentId },
    include: { user: { select: { managerId: true } } },
  })
  if (!assignment) {
    return error(404, "NOT_FOUND", "Assignment not found")
  }
  // Managers can only submit for users they manage
  if (session.user.role === "MANAGER" && assignment.user.managerId !== session.user.id) {
    return error(403, "FORBIDDEN", "You can only submit actuals for users you manage")
  }

  // Check period is not locked or closed
  const period = await prisma.evalPeriod.findUnique({
    where: { id: evalPeriodId },
  })
  if (!period) return error(404, "NOT_FOUND", "Evaluation period not found")
  if (period.isClosed)
    return error(422, "UNPROCESSABLE", "This evaluation period is closed")
  if (period.isLocked)
    return error(
      422,
      "UNPROCESSABLE",
      "This period is currently being scored. Please try again in a few minutes."
    )

  // Upsert actual (create or update)
  const actual = await prisma.kpiActual.upsert({
    where: {
      assignmentId_evalPeriodId: { assignmentId, evalPeriodId },
    },
    create: {
      assignmentId,
      userId: assignment.userId,
      evalPeriodId,
      actualValue: actualValue ?? null,
      binaryValue: binaryValue ?? null,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    update: {
      actualValue: actualValue ?? null,
      binaryValue: binaryValue ?? null,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    include: {
      assignment: {
        include: {
          kpiDefinition: { select: { code: true, name: true } },
        },
      },
    },
  })

  logger.info(
    {
      userId: session.user.id,
      assignmentId,
      actualValue,
      binaryValue,
    },
    "Actual submitted"
  )
  return success(actual)
})
