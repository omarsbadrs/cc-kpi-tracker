import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { loginSchema } from "./validations/auth"
import { logger } from "./logger"
import type { Role, Tier } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: Role
      tier: Tier
      companyId: string
      departmentId: string | null
      avatarUrl: string | null
    }
  }

  interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: Role
    tier: Tier
    companyId: string
    departmentId: string | null
    avatarUrl: string | null
  }
}

declare module "next-auth" {
  interface JWT {
    id: string
    role: Role
    tier: Tier
    firstName: string
    lastName: string
    companyId: string
    departmentId: string | null
    avatarUrl: string | null
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          return null
        }

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            firstName: true,
            lastName: true,
            role: true,
            tier: true,
            companyId: true,
            departmentId: true,
            avatarUrl: true,
            isActive: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        })

        if (!user) {
          logger.warn({ email }, "Login attempt for unknown user")
          return null
        }

        if (!user.isActive) {
          logger.warn({ email }, "Login attempt for disabled user")
          throw new Error("ACCOUNT_DISABLED")
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.warn({ email, lockedUntil: user.lockedUntil }, "Login attempt on locked account")
          throw new Error("ACCOUNT_LOCKED")
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1
          const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
            failedLoginAttempts: attempts,
          }

          if (attempts >= 5) {
            updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
            logger.warn({ email, attempts }, "Account locked after failed attempts")
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })

          return null
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        })

        logger.info({ userId: user.id, email }, "User login success")

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tier: user.tier,
          companyId: user.companyId,
          departmentId: user.departmentId,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tier = user.tier
        token.firstName = user.firstName
        token.lastName = user.lastName
        token.companyId = user.companyId
        token.departmentId = user.departmentId
        token.avatarUrl = user.avatarUrl
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as Role
      session.user.tier = token.tier as Tier
      session.user.firstName = token.firstName as string
      session.user.lastName = token.lastName as string
      session.user.companyId = token.companyId as string
      session.user.departmentId = token.departmentId as string | null
      session.user.avatarUrl = token.avatarUrl as string | null
      return session
    },
  },
})
