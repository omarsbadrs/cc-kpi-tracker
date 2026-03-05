"use client"

import { Suspense, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-background-card p-8 text-center shadow-lg">
        <p className="text-foreground-muted">Invalid or missing reset token.</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-blue-500 hover:text-blue-400">
          Back to login
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.message || "Failed to reset password")
      return
    }

    router.push("/login?reset=success")
  }

  return (
    <div className="rounded-2xl border border-border bg-background-card p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Set New Password</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Enter your new password below
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-border bg-background-card p-8 text-center shadow-lg">
        <p className="text-foreground-muted">Loading...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
