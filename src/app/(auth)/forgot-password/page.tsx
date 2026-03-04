"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
    <div className="rounded-2xl border border-border bg-background-card p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Reset Password</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Enter your email to receive a reset link
        </p>
      </div>

      {submitted ? (
        <div className="text-center">
          <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            If an account exists with that email, a reset link has been sent.
          </div>
          <p className="mb-4 text-sm text-foreground-muted">
            Contact your administrator if you don&apos;t receive an email.
          </p>
          <Link href="/login" className="text-sm text-blue-500 hover:text-blue-400">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@elsewedy.com"
              required
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link href="/login" className="text-sm text-blue-500 hover:text-blue-400">
              Back to login
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
