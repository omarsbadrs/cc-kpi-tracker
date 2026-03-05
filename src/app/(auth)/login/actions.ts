"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    })
    return { success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please try again." }
    }
    // NextAuth v5 throws NEXT_REDIRECT even with redirect:false in server actions
    // Check if it's a redirect (which means success)
    if (error instanceof Error && error.message?.includes("NEXT_REDIRECT")) {
      return { success: true }
    }
    return { error: "An unexpected error occurred. Please try again." }
  }
}
