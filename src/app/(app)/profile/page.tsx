"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Check, Circle, Eye, EyeOff, Monitor, Moon, Sun } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { Field } from "@/components/ui/Field"
import { Segmented } from "@/components/ui/Segmented"
import { TagPill } from "@/components/ui/StatusChip"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { UserAvatar } from "@/components/layout/UserMenu"
import { useTheme } from "@/components/providers"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import type { ThemeMode } from "@/lib/theme"
import "@/styles/views/account.css"

/** A password box with a show/hide icon button inside its end edge. */
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  describedBy?: string
}) {
  const [shown, setShown] = useState(false)
  const label = shown ? "Hide password" : "Show password"

  return (
    <div className="input-reveal">
      <input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        className="input"
      />
      <button
        type="button"
        className="icon-btn"
        onClick={() => setShown(!shown)}
        aria-label={label}
        title={label}
        aria-pressed={shown}
      >
        {shown ? <EyeOff size={16} strokeWidth={1.7} aria-hidden="true" /> : <Eye size={16} strokeWidth={1.7} aria-hidden="true" />}
      </button>
    </div>
  )
}

function ChangePasswordForm() {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  const passwordChecks = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ]

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const allChecksMet = passwordChecks.every((c) => c.met)
  const ready = Boolean(currentPassword) && allChecksMet && passwordsMatch
  const busy = status === "loading"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Busy, not unavailable: the button keeps focus, so guard a second run.
    if (!ready || busy) return
    setStatus("loading")

    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        toast(data.error?.message || "Could not change password. Try again", { icon: "alert" })
        return
      }

      setStatus("success")
      toast("Password changed")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setStatus("error")
      toast("Could not change password. Check your connection", { icon: "alert" })
    }
  }

  return (
    <section className="card settings-card" aria-labelledby="password-title">
      <h2 id="password-title" className="card-title">
        Change password
      </h2>
      <p className="card-sub">You&apos;ll need your current password to set a new one.</p>

      <form onSubmit={handleSubmit}>
        <Field label="Current password" htmlFor="current-password">
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter current password"
            autoComplete="current-password"
          />
        </Field>

        <Field label="New password" htmlFor="new-password">
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password"
            autoComplete="new-password"
            describedBy="new-password-rules"
          />
          {newPassword.length > 0 && (
            <ul id="new-password-rules" className="rule-list" aria-label="Password rules">
              {passwordChecks.map((check) => (
                <li key={check.label} className={check.met ? "met" : undefined}>
                  {check.met ? (
                    <Check size={13} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Circle size={11} strokeWidth={2} aria-hidden="true" />
                  )}
                  <span>
                    {check.label}
                    <span className="sr-only">{check.met ? ", met" : ", not met yet"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-password">
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            autoComplete="new-password"
            describedBy={confirmPassword.length > 0 && !passwordsMatch ? "confirm-password-error" : undefined}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p id="confirm-password-error" className="field-error">
              Passwords don&apos;t match
            </p>
          )}
        </Field>

        <div className="settings-save">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!ready && !busy}
            title={!ready && !busy ? "Fill in your current password and a new password that meets every rule" : undefined}
            aria-disabled={busy || undefined}
          >
            {busy ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  )
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={15} strokeWidth={1.7} aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <Moon size={15} strokeWidth={1.7} aria-hidden="true" /> },
  { value: "system", label: "System", icon: <Monitor size={15} strokeWidth={1.7} aria-hidden="true" /> },
]

function AppearanceCard() {
  const { mode, setMode } = useTheme()
  return (
    <section className="card settings-card" aria-labelledby="appearance-title">
      <h2 id="appearance-title" className="card-title">
        Appearance
      </h2>
      <p className="card-sub">Applies straight away on this device. System follows your device setting.</p>
      <Segmented label="Theme" options={THEME_OPTIONS} value={mode} onChange={setMode} />
    </section>
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

  if (isLoading) {
    return (
      <>
        <PageHead title="Profile" />
        <LoadingSpinner />
      </>
    )
  }

  const user = profile || session?.user

  const tierLabel = TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier
  const roleLabel = ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Email", value: user?.email },
    { label: "Role", value: roleLabel },
    { label: "Tier", value: tierLabel },
    { label: "Job title", value: user?.jobTitle },
    { label: "Employee ID", value: user?.employeeId },
    { label: "Function / project", value: user?.functionProject },
    { label: "Department", value: profile?.department?.name },
    { label: "Graduation year", value: user?.graduationYear },
    { label: "Nationality", value: user?.nationality },
    { label: "Last login", value: user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null },
    { label: "Member since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : null },
  ]

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  const headSub = [user?.jobTitle, user?.email].filter(Boolean).join(" · ")

  return (
    <>
      <PageHead title="Profile" sub="Your details, appearance and password" />

      <div className="settings-grid">
        <section className="card settings-card" aria-labelledby="identity-title">
          <div className="client-head">
            <UserAvatar firstName={user?.firstName} lastName={user?.lastName} avatarUrl={user?.avatarUrl} big />
            <div className="grow">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="identity-title" className="card-title mb-0">
                  {fullName || "Your profile"}
                </h2>
                {tierLabel && <TagPill>{tierLabel}</TagPill>}
              </div>
              {headSub && <p className="client-sub">{headSub}</p>}
            </div>
          </div>

          <h3 className="form-section mt-4">Personal information</h3>
          <div className="kv-grid">
            {fields.map((field) => (
              <div key={field.label} className="kv">
                <span className="kv-label">{field.label}</span>
                <span className={`kv-value${field.value ? "" : " muted"}`}>{field.value || "—"}</span>
              </div>
            ))}
          </div>
        </section>

        <AppearanceCard />

        <ChangePasswordForm />
      </div>
    </>
  )
}
