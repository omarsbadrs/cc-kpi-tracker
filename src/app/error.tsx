"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-4 text-6xl font-bold text-red-500">500</div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
