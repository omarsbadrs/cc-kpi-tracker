import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/health", "/api/ping"]

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // API routes that don't need any auth checking — pass through immediately
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/ping")) {
    return NextResponse.next()
  }

  // Allow public routes
  if (isPublicRoute(pathname) || pathname === "/") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    // If logged in and on login page, redirect to dashboard
    if (token && pathname === "/login") {
      const role = token.role as string
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

  // Protect all other routes — decode JWT without DB access
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = token.role as string

  // Admin routes
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // Manager routes
  if (pathname.startsWith("/manager") && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
