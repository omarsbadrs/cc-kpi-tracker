import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "@/lib/validations/auth"
import { error, success } from "@/lib/api-response"
import { randomBytes, createHash } from "crypto"
import { logger } from "@/lib/logger"

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return error(400, "VALIDATION_ERROR", "Invalid input")
  }

  const { email } = parsed.data
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  // Always return success to prevent email enumeration
  if (!user) {
    logger.info({ email }, "Password reset requested for unknown email")
    return success({
      message: "If an account exists, a reset link has been sent.",
    })
  }

  const plainToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(plainToken).digest("hex")

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  })

  logger.info({ userId: user.id }, "Password reset token generated")
  // TODO: Send email with reset link containing plainToken
  // For MVP, admin manually resets passwords

  return success({
    message: "If an account exists, a reset link has been sent.",
  })
}
