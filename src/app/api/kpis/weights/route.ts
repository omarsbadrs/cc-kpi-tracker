import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { updateWeightSchema } from "@/lib/validations/kpis"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const tier = searchParams.get("tier") || undefined

  const pillarWhere: Record<string, unknown> = {}
  const subWhere: Record<string, unknown> = {}
  if (tier) {
    pillarWhere.tier = tier
    subWhere.tier = tier
  }

  const [pillarWeights, subKpiWeights] = await Promise.all([
    prisma.pillarWeight.findMany({
      where: pillarWhere,
      include: { pillar: { select: { code: true, name: true } } },
      orderBy: { pillar: { sortOrder: "asc" } },
    }),
    prisma.subKpiWeight.findMany({
      where: subWhere,
      include: {
        kpiDefinition: { select: { code: true, name: true } },
      },
      orderBy: { kpiDefinition: { sortOrder: "asc" } },
    }),
  ])

  return success({ pillarWeights, subKpiWeights })
})

export const PATCH = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const type = searchParams.get("type") // "pillar" or "sub"

  if (!id) return error(400, "VALIDATION_ERROR", "Missing weight ID")
  if (!type || (type !== "pillar" && type !== "sub")) {
    return error(
      400,
      "VALIDATION_ERROR",
      'Missing or invalid type parameter. Must be "pillar" or "sub"'
    )
  }

  const body = await req.json()
  const parsed = updateWeightSchema.safeParse(body)
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

  if (type === "pillar") {
    const existing = await prisma.pillarWeight.findUnique({ where: { id } })
    if (!existing) return error(404, "NOT_FOUND", "Pillar weight not found")

    const weight = await prisma.pillarWeight.update({
      where: { id },
      data: { weight: parsed.data.weight },
      include: { pillar: { select: { code: true, name: true } } },
    })

    logger.info(
      { weightId: id, type: "pillar", newWeight: parsed.data.weight },
      "Pillar weight updated"
    )
    return success(weight)
  } else {
    const existing = await prisma.subKpiWeight.findUnique({ where: { id } })
    if (!existing)
      return error(404, "NOT_FOUND", "Sub-KPI weight not found")

    const weight = await prisma.subKpiWeight.update({
      where: { id },
      data: { weight: parsed.data.weight },
      include: {
        kpiDefinition: { select: { code: true, name: true } },
      },
    })

    logger.info(
      { weightId: id, type: "sub", newWeight: parsed.data.weight },
      "Sub-KPI weight updated"
    )
    return success(weight)
  }
}, "ADMIN")
