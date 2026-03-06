import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize } = parsePagination(searchParams)

  const entity = searchParams.get("entity") || undefined
  const entityId = searchParams.get("entityId") || undefined
  const userId = searchParams.get("userId") || undefined

  const where: Record<string, unknown> = {}
  if (entity) where.entity = entity
  if (entityId) where.entityId = entityId
  if (userId) where.userId = userId

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...paginateQuery(page, pageSize),
    }),
    prisma.auditLog.count({ where }),
  ])

  return success(logs, buildMeta(page, pageSize, total))
}, "ADMIN")
