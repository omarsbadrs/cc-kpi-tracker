"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import { Mail, Briefcase, Building2, Hash, Globe, Clock, Shield, Layers, GraduationCap, Lock, Eye, EyeOff, Check, AlertCircle } from "lucide-react"

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const passwordChecks = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ]

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const allChecksMet = passwordChecks.every((c) => c.met)
  const canSubmit = currentPassword && allChecksMet && passwordsMatch && status !== "loading"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setMessage("")

    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data.error?.message || "Failed to change password")
        return
      }

      setStatus("success")
      setMessage("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setStatus("error")
      setMessage("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="card-shadow rounded-xl border border-card-border bg-card-bg p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
          <Lock className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 pr-10 text-sm text-foreground placeholder-foreground-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter current password"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 pr-10 text-sm text-foreground placeholder-foreground-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter new password"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password strength checks */}
          {newPassword.length > 0 && (
            <div className="mt-2 space-y-1">
              {passwordChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-xs">
                  {check.met ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-foreground-muted" />
                  )}
                  <span className={check.met ? "text-emerald-500" : "text-foreground-muted"}>{check.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 pr-10 text-sm text-foreground placeholder-foreground-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Confirm new password"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-500">Passwords don&apos;t match</p>
          )}
        </div>

        {/* Status message */}
        {message && (
          <div className={`rounded-lg px-3 py-2 text-sm ${status === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  )
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const { data: profile, isLoading } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return (await res.json()).data
    },
  })

  if (isLoading) return <LoadingSpinner />

  const user = profile || session?.user

  const fields = [
    { icon: Mail, label: "Email", value: user?.email },
    { icon: Shield, label: "Role", value: ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role },
    { icon: Layers, label: "Tier", value: TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier },
    { icon: Briefcase, label: "Job Title", value: user?.jobTitle },
    { icon: Hash, label: "Employee ID", value: user?.employeeId },
    { icon: Building2, label: "Function / Project", value: user?.functionProject },
    { icon: Building2, label: "Department", value: profile?.department?.name },
    { icon: GraduationCap, label: "Graduation Year", value: user?.graduationYear },
    { icon: Globe, label: "Nationality", value: user?.nationality },
    { icon: Clock, label: "Last Login", value: user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null },
    { icon: Clock, label: "Member Since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : null },
  ]

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Profile card */}
        <div className="card-shadow rounded-xl border border-card-border bg-card-bg p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">{user?.email}</p>
            <div className="mt-3 inline-flex rounded-full bg-blue-600/10 px-3 py-1 text-xs font-medium text-blue-500">
              {TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier}
            </div>
            {user?.jobTitle && (
              <p className="mt-2 text-sm text-foreground-secondary">{user.jobTitle}</p>
            )}
          </div>
        </div>

        {/* Right: Details + Change Password */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card-shadow rounded-xl border border-card-border bg-card-bg p-6">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Personal Information</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {fields.map((field) => {
                const Icon = field.icon
                return (
                  <div key={field.label} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-secondary">
                      <Icon className="h-4 w-4 text-foreground-muted" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground-muted">{field.label}</p>
                      <p className="mt-0.5 text-sm text-foreground">{field.value || "—"}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <ChangePasswordForm />
        </div>
      </div>
    </div>
  )
}
