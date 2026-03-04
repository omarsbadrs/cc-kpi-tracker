import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { createPeriodSchema } from "@/lib/validations/periods"
import { logger } from "@/lib/logger"

export const GET = withAuth(async () => {
  const periods = await prisma.evalPeriod.findMany({
    orderBy: { startDate: "desc" },
  })
  return success(periods)
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const parsed = createPeriodSchema.safeParse(body)
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

  const period = await prisma.evalPeriod.create({ data: parsed.data })

  logger.info(
    { periodId: period.id, name: period.name },
    "Evaluation period created"
  )
  return success(period)
}, "ADMIN")
