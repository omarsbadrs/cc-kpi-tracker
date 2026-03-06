"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { prisma } from "@/lib/prisma"

function extractErrorChain(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  for (let i = 0; i < 10 && current; i++) {
    if (current instanceof Error) {
      parts.push(current.message)
      current = current.cause
    } else if (typeof current === "string") {
      parts.push(current)
      break
    } else {
      try {
        parts.push(String(current))
      } catch { /* ignore */ }
      break
    }
  }
  return parts.join(" | ")
}

export async function loginAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get("email") as string)?.toLowerCase()

  // Pre-check user status before attempting auth (avoids relying on error chain parsing)
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { isActive: true, lockedUntil: true },
    })

    if (user && !user.isActive) {
      return { error: "ACCOUNT_DISABLED" }
    }
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      return { error: "ACCOUNT_LOCKED" }
    }
  }

  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    })
    return { success: true }
  } catch (error) {
    // NextAuth v5 throws NEXT_REDIRECT even with redirect:false in server actions
    if (error instanceof Error && error.message?.includes("NEXT_REDIRECT")) {
      return { success: true }
    }

    // Check for custom error codes in the full error chain
    const errorStr = extractErrorChain(error)

    if (errorStr.includes("ACCOUNT_DISABLED")) {
      return { error: "ACCOUNT_DISABLED" }
    }
    if (errorStr.includes("ACCOUNT_LOCKED")) {
      return { error: "ACCOUNT_LOCKED" }
    }

    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please try again." }
    }
    return { error: "An unexpected error occurred. Please try again." }
  }
}
