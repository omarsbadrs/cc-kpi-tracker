"use client"

import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"
import type { ReactNode } from "react"

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown
  resetErrorBoundary: () => void
}) {
  const message = error instanceof Error ? error.message : "An unexpected error occurred"
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h2 className="text-xl font-bold text-red-500">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-foreground-muted">{message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  )
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  )
}
