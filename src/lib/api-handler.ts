import { NextRequest, NextResponse } from "next/server"
import { auth } from "./auth"
import { logger } from "./logger"
import { error } from "./api-response"
import type { Role } from "@prisma/client"
import type { Session } from "next-auth"

type AuthenticatedHandler = (
  req: NextRequest,
  context: {
    session: Session
    params?: Record<string, string>
  }
) => Promise<NextResponse>

export function withAuth(handler: AuthenticatedHandler, requiredRole?: Role) {
  return async (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => {
    try {
      const session = await auth()
      if (!session?.user) {
        return error(401, "UNAUTHORIZED", "Not authenticated")
      }

      if (requiredRole) {
        const userRole = session.user.role
        // ADMIN can access everything
        if (userRole !== requiredRole && userRole !== "ADMIN") {
          return error(403, "FORBIDDEN", "Insufficient permissions")
        }
      }

      const params = ctx?.params ? await ctx.params : undefined
      return await handler(req, { session, params })
    } catch (err) {
      logger.error(
        { error: err, route: req.url, method: req.method },
        "Unhandled API error"
      )
      return error(500, "INTERNAL_ERROR", "An unexpected error occurred")
    }
  }
}
