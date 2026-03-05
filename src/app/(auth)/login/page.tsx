"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState, useTransition } from "react"
import Link from "next/link"
import { loginAction } from "./actions"

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  const [error, setError] = useState(errorParam ? "Invalid email or password." : "")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError("")
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.success) {
        // Hard navigation to ensure full page load with fresh session
        window.location.href = "/dashboard"
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-background-card p-8 shadow-lg">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
          CC
        </div>
        <h1 className="text-2xl font-bold text-foreground">CC KPI Tracker</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Elsewedy Electric — Cost Control Department
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@elsewedy.com"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <input type="checkbox" className="rounded border-border" />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-blue-500 hover:text-blue-400"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-foreground-muted">
        Contact your administrator for account access
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-border bg-background-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
          CC
        </div>
        <p className="text-foreground-muted">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
