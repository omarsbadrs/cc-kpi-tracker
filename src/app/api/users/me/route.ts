import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success } from "@/lib/api-response"

export const GET = withAuth(async (req, { session }) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      role: true,
      tier: true,
      jobTitle: true,
      avatarUrl: true,
      departmentId: true,
      managerId: true,
      nationality: true,
      preferredLocale: true,
      department: { select: { name: true } },
      company: { select: { name: true } },
      lastLoginAt: true,
      createdAt: true,
    },
  })

  return success(user)
})
