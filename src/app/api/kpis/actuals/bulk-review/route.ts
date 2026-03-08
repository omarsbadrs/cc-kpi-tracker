import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { z } from "zod"
import { logger } from "@/lib/logger"

const bulkReviewSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(1000),
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: z.string().optional(),
})

export const POST = withAuth(async (req, { session }) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return error(403, "FORBIDDEN", "Insufficient permissions")
  }

  const body = await req.json()
  const parsed = bulkReviewSchema.safeParse(body)
  if (!parsed.success) {
    return error(400, "VALIDATION_ERROR", "Invalid input",
      parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }))
    )
  }

  const { ids, status, reviewComment } = parsed.data

  const now = new Date()

  const result = await prisma.kpiActual.updateMany({
    where: {
      id: { in: ids },
      status: "SUBMITTED", // only update submitted ones
    },
    data: {
      status,
      reviewedBy: session.user.id,
      reviewedAt: now,
      reviewComment: reviewComment ?? null,
    },
  })

  logger.info(
    { reviewerId: session.user.id, status, count: result.count, requested: ids.length },
    "Bulk review completed"
  )

  return success({ updated: result.count, requested: ids.length })
})
