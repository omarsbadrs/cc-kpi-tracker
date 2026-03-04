import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { updatePeriodSchema } from "@/lib/validations/periods"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing period ID")

  const period = await prisma.evalPeriod.findUnique({
    where: { id },
  })

  if (!period) return error(404, "NOT_FOUND", "Evaluation period not found")
  return success(period)
})

export const PATCH = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing period ID")

  const existing = await prisma.evalPeriod.findUnique({ where: { id } })
  if (!existing)
    return error(404, "NOT_FOUND", "Evaluation period not found")

  const body = await req.json()
  const parsed = updatePeriodSchema.safeParse(body)
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

  // Prevent modifying locked periods
  if (existing.isLocked) {
    return error(
      422,
      "UNPROCESSABLE",
      "Cannot modify a period that is currently being scored"
    )
  }

  const period = await prisma.evalPeriod.update({
    where: { id },
    data: parsed.data,
  })

  logger.info({ periodId: id, changes: parsed.data }, "Evaluation period updated")
  return success(period)
}, "ADMIN")
