import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { updateKpiSchema } from "@/lib/validations/kpis"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing KPI ID")

  const kpi = await prisma.kpiDefinition.findUnique({
    where: { id },
    include: {
      pillar: true,
      targets: true,
      subKpiWeights: true,
    },
  })

  if (!kpi) return error(404, "NOT_FOUND", "KPI not found")
  return success(kpi)
})

export const PATCH = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing KPI ID")

  const existing = await prisma.kpiDefinition.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "KPI not found")

  const body = await req.json()
  const parsed = updateKpiSchema.safeParse(body)
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

  const kpi = await prisma.kpiDefinition.update({
    where: { id },
    data: parsed.data,
    include: { pillar: { select: { code: true, name: true } } },
  })

  logger.info({ kpiId: id, code: kpi.code }, "KPI definition updated")
  return success(kpi)
}, "ADMIN")

export const DELETE = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing KPI ID")

  const existing = await prisma.kpiDefinition.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "KPI not found")

  await prisma.kpiDefinition.update({
    where: { id },
    data: { isActive: false },
  })

  logger.info({ kpiId: id }, "KPI definition deactivated")
  return success({ message: "KPI definition deactivated" })
}, "ADMIN")
