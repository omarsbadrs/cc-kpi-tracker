"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData): Promise<{ error: string } | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please try again." }
    }
    // NEXT_REDIRECT is thrown by NextAuth on success — must be re-thrown
    throw error
  }
}
