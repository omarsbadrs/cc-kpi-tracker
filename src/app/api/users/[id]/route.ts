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
      department: { select: { name: true } },
      managerId: true,
      nationality: true,
      graduationYear: true,
      functionProject: true,
      preferredLocale: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) return error(404, "NOT_FOUND", "User not found")
  return success(user)
})

export const PATCH = withAuth(async (req, { params, session }) => {
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

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      firstName: true, lastName: true, email: true,
      role: true, tier: true, jobTitle: true,
      isActive: true, employeeId: true, nationality: true,
      graduationYear: true, functionProject: true,
    },
  })
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
      isActive: true,
      updatedAt: true,
    },
  })

  // Build change diff for audit log
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, newVal] of Object.entries(parsed.data)) {
    const oldVal = existing[key as keyof typeof existing]
    if (oldVal !== newVal && newVal !== undefined) {
      changes[key] = { from: oldVal, to: newVal }
    }
  }

  if (Object.keys(changes).length > 0) {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: changes.isActive !== undefined
          ? (changes.isActive.to ? "ACTIVATE_USER" : "DEACTIVATE_USER")
          : "UPDATE_USER",
        entity: "user",
        entityId: id,
        oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
        newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
      },
    })
  }

  logger.info({ userId: id }, "User updated")
  return success(user)
}, "ADMIN")

export const DELETE = withAuth(async (req, { params, session }) => {
  const id = params?.id
  if (!id) return error(400, "VALIDATION_ERROR", "Missing user ID")

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, email: true },
  })
  if (!existing) return error(404, "NOT_FOUND", "User not found")

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DEACTIVATE_USER",
      entity: "user",
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false, name: `${existing.firstName} ${existing.lastName}` },
    },
  })

  logger.info({ userId: id }, "User deactivated")
  return success({ message: "User deactivated" })
}, "ADMIN")
