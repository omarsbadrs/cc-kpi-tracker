import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { updateTargetSchema } from "@/lib/validations/kpis"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const tier = searchParams.get("tier") || undefined

  const where: Record<string, unknown> = {}
  if (tier) where.tier = tier

  const targets = await prisma.kpiTarget.findMany({
    where,
    include: {
      kpiDefinition: { select: { code: true, name: true } },
    },
    orderBy: { kpiDefinition: { sortOrder: "asc" } },
  })

  return success(targets)
})

export const PATCH = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return error(400, "VALIDATION_ERROR", "Missing target ID")

  const body = await req.json()
  const parsed = updateTargetSchema.safeParse(body)
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

  const existing = await prisma.kpiTarget.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "Target not found")

  const target = await prisma.kpiTarget.update({
    where: { id },
    data: parsed.data,
    include: {
      kpiDefinition: { select: { code: true, name: true } },
    },
  })

  logger.info(
    { targetId: id, newValue: parsed.data.targetValue },
    "KPI target updated"
  )
  return success(target)
}, "ADMIN")
