import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { reviewActualSchema } from "@/lib/validations/actuals"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { session, params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing actual ID")

  const actual = await prisma.kpiActual.findUnique({
    where: { id },
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
  })

  if (!actual) return error(404, "NOT_FOUND", "Actual not found")

  // Non-admins/managers can only see their own
  if (
    actual.userId !== session.user.id &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "MANAGER"
  ) {
    return error(403, "FORBIDDEN", "Insufficient permissions")
  }

  return success(actual)
})

export const PATCH = withAuth(async (req, { session, params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing actual ID")

  const existing = await prisma.kpiActual.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "Actual not found")

  const body = await req.json()

  // Check if this is a review action (approve/reject)
  if (body.status === "APPROVED" || body.status === "REJECTED") {
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return error(
        403,
        "FORBIDDEN",
        "Only admins and managers can review actuals"
      )
    }

    const parsed = reviewActualSchema.safeParse(body)
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

    const actual = await prisma.kpiActual.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewComment: parsed.data.reviewComment,
      },
      include: {
        assignment: {
          include: {
            kpiDefinition: { select: { code: true, name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    logger.info(
      {
        actualId: id,
        status: parsed.data.status,
        reviewedBy: session.user.id,
      },
      "Actual reviewed"
    )
    return success(actual)
  }

  // Regular update (draft only)
  if (
    existing.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return error(403, "FORBIDDEN", "You can only update your own actuals")
  }

  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
    return error(
      422,
      "UNPROCESSABLE",
      "Only draft or rejected actuals can be updated"
    )
  }

  const actual = await prisma.kpiActual.update({
    where: { id },
    data: {
      actualValue: body.actualValue ?? undefined,
      binaryValue: body.binaryValue ?? undefined,
      status: "DRAFT",
    },
  })

  logger.info({ actualId: id, userId: session.user.id }, "Actual updated")
  return success(actual)
})
