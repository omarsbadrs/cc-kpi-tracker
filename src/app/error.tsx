"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import "@/styles/views/account.css"

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
    <div className="auth-shell">
      <main className="card status-card">
        <div className="empty">
          <AlertTriangle size={22} strokeWidth={1.6} aria-hidden="true" className="empty-icon" />
          <h1>Something went wrong</h1>
          <p>{error.message || "An unexpected error occurred. Try again, or go back to your dashboard."}</p>
          {error.digest && <p className="side-note tabular">Reference {error.digest}</p>}
          <div className="empty-actions">
            <Link href="/dashboard" className="btn">
              Go to dashboard
            </Link>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
