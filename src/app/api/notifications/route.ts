import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success } from "@/lib/api-response"
import { parsePagination, paginateQuery, buildMeta } from "@/lib/pagination"

export const GET = withAuth(async (req, { session }) => {
  const { searchParams } = new URL(req.url)
  const { page, pageSize } = parsePagination(searchParams)
  const isRead = searchParams.get("isRead")
  const type = searchParams.get("type") || undefined

  const where: Record<string, unknown> = { userId: session.user.id }
  if (isRead === "true") where.isRead = true
  if (isRead === "false") where.isRead = false
  if (type) where.type = type

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginateQuery(page, pageSize),
    }),
    prisma.notification.count({ where }),
  ])

  return success(notifications, buildMeta(page, pageSize, total))
})

export const PATCH = withAuth(async (req, { session }) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  })

  return success({ message: "All notifications marked as read", count })
})
