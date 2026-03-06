"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState, useTransition } from "react"
import Link from "next/link"
import { loginAction } from "./actions"
import { useTheme } from "@/components/providers"

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
        window.location.href = "/dashboard"
      }
    })
  }

  const { theme, toggleTheme } = useTheme()

  return (
    <div className="login-card p-8 relative">
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="login-theme-toggle absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full transition-colors"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/logo.svg"
          alt="Elsewedy Electric PSP"
          className="mx-auto mb-4 hidden h-16 w-auto dark:block"
        />
        <img
          src="/logo-light.svg"
          alt="Elsewedy Electric PSP"
          className="mx-auto mb-4 block h-16 w-auto dark:hidden"
        />
        <h1 className="login-title text-2xl font-bold tracking-tight">Cost Control KPI Tracker</h1>
        <p className="login-subtitle mt-1 text-sm">
          Elsewedy Electric PSP — Cost Control Department
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            error === "ACCOUNT_DISABLED"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
              : "border-red-500/15 bg-red-500/10 text-red-400"
          }`}
        >
          {error === "ACCOUNT_DISABLED" ? (
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <div>
                <p className="font-semibold">Account Inactive</p>
                <p className="mt-0.5 text-xs opacity-80">Your account is inactive. Please contact your administrator.</p>
              </div>
            </div>
          ) : error === "ACCOUNT_LOCKED" ? (
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="font-semibold">Account Locked</p>
                <p className="mt-0.5 text-xs opacity-80">Too many failed login attempts. Please try again in 15 minutes.</p>
              </div>
            </div>
          ) : (
            error
          )}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-foreground-secondary">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@elsewedy.com"
            required
            autoComplete="email"
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-foreground-secondary">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="form-input"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#c8c6c2]">
            <input type="checkbox" className="rounded border-border" />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-[#c8c6c2] dark:hover:text-white transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-gray-900 dark:bg-foreground px-4 py-2.5 text-sm font-semibold text-white dark:text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-xs font-medium text-gray-700 dark:text-[#c8c6c2]">Cost Control Dept.</p>
        <p className="mt-1 text-[10px] text-gray-500 dark:text-[#a8a6a0]">by Omar Badr</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-card p-8 text-center">
        <img
          src="/logo.svg"
          alt="Elsewedy Electric PSP"
          className="mx-auto mb-4 hidden h-16 w-auto dark:block"
        />
        <img
          src="/logo-light.svg"
          alt="Elsewedy Electric PSP"
          className="mx-auto mb-4 block h-16 w-auto dark:hidden"
        />
        <p className="text-foreground-muted">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
