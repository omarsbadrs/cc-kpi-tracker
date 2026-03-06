import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { changePasswordSchema } from "@/lib/validations/users"
import bcrypt from "bcryptjs"

export const PATCH = withAuth(async (req, { session }) => {
  const body = await req.json()
  const parsed = changePasswordSchema.safeParse(body)

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

  const { currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })

  if (!user) {
    return error(404, "NOT_FOUND", "User not found")
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    return error(400, "VALIDATION_ERROR", "Current password is incorrect")
  }

  const isSame = await bcrypt.compare(newPassword, user.passwordHash)
  if (isSame) {
    return error(400, "VALIDATION_ERROR", "New password must be different from current password")
  }

  const newHash = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  })

  return success({ message: "Password changed successfully" })
})
