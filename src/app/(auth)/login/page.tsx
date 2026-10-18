"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState, useTransition } from "react"
import Link from "next/link"
import { AlertCircle, Ban, Lock } from "lucide-react"
import { loginAction } from "./actions"
import { Field } from "@/components/ui/Field"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"

/** Warn banner for a failed sign-in: icon + words, never colour alone. */
function LoginError({ error }: { error: string }) {
  let Icon = AlertCircle
  let title: string | null = null
  let message = error

  if (error === "ACCOUNT_DISABLED") {
    Icon = Ban
    title = "Account inactive"
    message = "Your account is inactive. Contact your administrator to restore access."
  } else if (error === "ACCOUNT_LOCKED") {
    Icon = Lock
    title = "Account locked"
    message = "Too many failed sign-in attempts. Try again in 15 minutes."
  }

  return (
    <div className="sample-banner offline-banner" role="alert">
      <span className="sample-banner-ic">
        <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="grow">
        {title && <span className="banner-title">{title}</span>}
        {message}
      </span>
    </div>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  const [error, setError] = useState(errorParam ? "Invalid email or password." : "")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    // Busy, not unavailable: the button keeps focus, so guard a second run.
    if (isPending) return
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

  return (
    <>
      <div className="text-center">
        <h1 className="auth-title">Cost Control KPI Tracker</h1>
        <p className="auth-sub">Elsewedy Electric PSP · Cost Control Department</p>
      </div>

      {error && <LoginError error={error} />}

      <form action={handleSubmit}>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="name@elsewedy.com"
            required
            autoComplete="email"
            className="input"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="input"
          />
        </Field>

        <div className="auth-row">
          <label className="check-row">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link href="/forgot-password" className="card-link">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit"
          aria-disabled={isPending || undefined}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-note">Cost Control Department · by Omar Badr</p>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginForm />
    </Suspense>
  )
}
