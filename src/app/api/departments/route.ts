import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success } from "@/lib/api-response"

export const GET = withAuth(async () => {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return success(departments)
})
