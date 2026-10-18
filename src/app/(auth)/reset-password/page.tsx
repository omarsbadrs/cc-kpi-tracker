"use client"

import { Suspense, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Check, Circle, Link2Off } from "lucide-react"
import { Field } from "@/components/ui/Field"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"

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
      <div className="empty" style={{ paddingBlock: "8px 4px" }}>
        <Link2Off size={22} strokeWidth={1.6} aria-hidden="true" className="empty-icon" />
        <h1>This reset link is not valid</h1>
        <p>The reset token is invalid or missing. Ask for a new link from the sign-in page.</p>
        <div className="empty-actions">
          <Link href="/login" className="btn">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // Shown as a quiet checklist; the server enforces the same rules.
  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Busy, not unavailable: the button keeps focus, so guard a second run.
    if (loading) return
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
    <>
      <div className="text-center">
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-sub">Enter your new password below</p>
      </div>

      {error && (
        <div className="sample-banner offline-banner" role="alert">
          <span className="sample-banner-ic">
            <AlertCircle size={14} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="grow">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Field label="New password" htmlFor="password">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-rules"
            className="input"
          />
          <ul id="password-rules" className="rule-list" aria-label="Password rules">
            {rules.map((rule) => (
              <li key={rule.label} className={rule.met ? "met" : undefined}>
                {rule.met ? (
                  <Check size={13} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Circle size={11} strokeWidth={2} aria-hidden="true" />
                )}
                <span>
                  {rule.label}
                  <span className="sr-only">{rule.met ? ", met" : ", not met yet"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="input"
          />
        </Field>

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit mt-1"
          aria-disabled={loading || undefined}
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>

        <p className="auth-note">
          <Link href="/login" className="card-link">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
