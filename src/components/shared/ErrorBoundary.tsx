"use client"

import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"
import { AlertCircle } from "lucide-react"
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
    <div role="alert" className="empty">
      <AlertCircle size={22} strokeWidth={1.6} aria-hidden="true" className="empty-icon" />
      <h3>Something went wrong</h3>
      <p>{message}</p>
      <div className="empty-actions">
        <button type="button" onClick={resetErrorBoundary} className="btn btn-primary">
          Try again
        </button>
      </div>
    </div>
  )
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <ReactErrorBoundary FallbackComponent={ErrorFallback}>{children}</ReactErrorBoundary>
}
