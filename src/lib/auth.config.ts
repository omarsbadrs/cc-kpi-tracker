import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config (no database imports)
// Used by middleware to check session without bundling Prisma
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" as const, maxAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>
        token.id = user.id
        token.role = u.role
        token.tier = u.tier
        token.firstName = u.firstName
        token.lastName = u.lastName
        token.companyId = u.companyId
        token.departmentId = u.departmentId
        token.avatarUrl = u.avatarUrl
      }
      return token
    },
    async session({ session, token }) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const s = session as any
      s.user.id = token.id
      s.user.role = token.role
      s.user.tier = token.tier
      s.user.firstName = token.firstName
      s.user.lastName = token.lastName
      s.user.companyId = token.companyId
      s.user.departmentId = token.departmentId
      s.user.avatarUrl = token.avatarUrl
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return session
    },
  },
} satisfies NextAuthConfig
