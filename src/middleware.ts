import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/health"]

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route))
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (isPublicRoute(pathname) || pathname === "/") {
    // If logged in and on login page, redirect to dashboard
    if (req.auth?.user && pathname === "/login") {
      const role = req.auth.user.role
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

  // Protect all other routes
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = req.auth.user.role

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
