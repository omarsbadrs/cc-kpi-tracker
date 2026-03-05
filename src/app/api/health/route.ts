import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Dynamic import to get better error messages
    const { prisma } = await import("@/lib/prisma")
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { status: "unhealthy", database: "disconnected", error: message },
      { status: 503 }
    )
  }
}
