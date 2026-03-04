import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { updateUserSchema } from "@/lib/validations/users"
import { logger } from "@/lib/logger"

export const GET = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing user ID")

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      role: true,
      tier: true,
      jobTitle: true,
      isActive: true,
      avatarUrl: true,
      departmentId: true,
      managerId: true,
      nationality: true,
      preferredLocale: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) return error(404, "NOT_FOUND", "User not found")
  return success(user)
})

export const PATCH = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing user ID")

  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
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

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "User not found")

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tier: true,
      updatedAt: true,
    },
  })

  logger.info({ userId: id }, "User updated")
  return success(user)
}, "ADMIN")

export const DELETE = withAuth(async (req, { params }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing user ID")

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return error(404, "NOT_FOUND", "User not found")

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  })

  logger.info({ userId: id }, "User deactivated")
  return success({ message: "User deactivated" })
}, "ADMIN")
