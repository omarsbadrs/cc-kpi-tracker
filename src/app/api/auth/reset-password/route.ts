import { prisma } from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { error, success } from "@/lib/api-response"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { logger } from "@/lib/logger"

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = resetPasswordSchema.safeParse(body)
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

  const { token, password } = parsed.data
  const tokenHash = createHash("sha256").update(token).digest("hex")

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
    return error(400, "VALIDATION_ERROR", "Invalid or expired reset token")
  }

  // Check password history (last 3)
  const history = await prisma.passwordHistory.findMany({
    where: { userId: resetToken.userId },
    orderBy: { createdAt: "desc" },
    take: 3,
  })

  for (const h of history) {
    if (await bcrypt.compare(password, h.passwordHash)) {
      return error(
        400,
        "VALIDATION_ERROR",
        "Cannot reuse one of your last 3 passwords"
      )
    }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordHistory.create({
      data: { userId: resetToken.userId, passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ])

  logger.info({ userId: resetToken.userId }, "Password reset successful")
  return success({ message: "Password reset successful" })
}
