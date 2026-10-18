"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Field } from "@/components/ui/Field"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Busy, not unavailable: the button keeps focus, so guard a second run.
    if (loading) return
    setLoading(true)

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      <div className="text-center">
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-sub">Enter your email to receive a reset link</p>
      </div>

      {submitted ? (
        <>
          <div className="sample-banner" role="status">
            <span className="sample-banner-ic">
              <MailCheck size={14} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="grow">If an account exists with that email, a reset link has been sent.</span>
          </div>
          <p className="side-note">Contact your administrator if you don&apos;t receive an email.</p>
          <Link href="/login" className="btn btn-block auth-submit mt-5">
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@elsewedy.com"
              required
              autoComplete="email"
              className="input"
            />
          </Field>

          <button
            type="submit"
            className="btn btn-primary btn-block auth-submit mt-1"
            aria-disabled={loading || undefined}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>

          <p className="auth-note">
            <Link href="/login" className="card-link">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </>
  )
}
