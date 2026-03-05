import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // API routes that don't need any auth checking
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/ping")) {
    return NextResponse.next()
  }

  // Public routes
  const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/health", "/api/ping"]
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route)) || pathname === "/"

  if (isPublic) {
    // If logged in and on login page, redirect to role-based dashboard
    if (session?.user && pathname === "/login") {
      const role = (session.user as Record<string, unknown>).role as string
      const dashboardUrl =
        role === "ADMIN"
          ? "/admin/dashboard"
          : role === "MANAGER"
            ? "/manager/dashboard"
            : "/dashboard"
      return NextResponse.redirect(new URL(dashboardUrl, req.url))
    }
    return NextResponse.next()
  }

  // Protected routes — redirect to login if not authenticated
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = (session.user as Record<string, unknown>).role as string

  // Admin routes
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // Manager routes
  if (pathname.startsWith("/manager") && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
