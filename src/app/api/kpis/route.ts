import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"
import { createKpiSchema } from "@/lib/validations/kpis"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize } = parsePagination(searchParams)
  const pillarCode = searchParams.get("pillarCode") || undefined

  const where: Record<string, unknown> = { isActive: true }
  if (pillarCode) {
    where.pillar = { code: pillarCode }
  }

  const [kpis, total] = await Promise.all([
    prisma.kpiDefinition.findMany({
      where,
      include: {
        pillar: { select: { code: true, name: true } },
        targets: true,
        subKpiWeights: true,
      },
      orderBy: { sortOrder: "asc" },
      ...paginateQuery(page, pageSize),
    }),
    prisma.kpiDefinition.count({ where }),
  ])

  return success(kpis, buildMeta(page, pageSize, total))
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const parsed = createKpiSchema.safeParse(body)
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

  const existing = await prisma.kpiDefinition.findUnique({
    where: { code: parsed.data.code },
  })
  if (existing) {
    return error(409, "CONFLICT", "A KPI with this code already exists")
  }

  const kpi = await prisma.kpiDefinition.create({
    data: parsed.data,
    include: { pillar: { select: { code: true, name: true } } },
  })

  logger.info({ kpiId: kpi.id, code: kpi.code }, "KPI definition created")
  return success(kpi)
}, "ADMIN")
