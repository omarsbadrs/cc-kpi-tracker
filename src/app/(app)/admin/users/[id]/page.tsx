"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Clock, UserCog, UserPlus, UserMinus, Shield, UserX } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { Field, SelectWrap } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { Switch } from "@/components/ui/KpiMarks"
import { ConfirmDialog } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import "@/styles/views/admin-users.css"

interface UserData {
  id: string
  email: string
  firstName: string
  lastName: string
  employeeId: string | null
  role: string
  tier: string
  jobTitle: string | null
  isActive: boolean
  avatarUrl?: string | null
  nationality: string | null
  graduationYear: number | null
  functionProject: string | null
  departmentId: string | null
  department: { name: string } | null
  managerId: string | null
  lastLoginAt: string | null
  createdAt: string
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(true)
  const [confirmStatus, setConfirmStatus] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`)
      if (!res.ok) throw new Error("Failed to fetch user")
      return (await res.json()).data as UserData
    },
    enabled: !!id,
  })

  // Set by the danger-zone status change, so the refetch after it doesn't
  // wipe edits still unsaved in the form.
  const keepFormEdits = useRef(false)

  useEffect(() => {
    if (data && keepFormEdits.current) {
      keepFormEdits.current = false
      setIsActive(data.isActive)
      return
    }
    if (data) {
      setFormData({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
        employeeId: data.employeeId || "",
        role: data.role || "USER",
        tier: data.tier || "ENGINEER",
        jobTitle: data.jobTitle || "",
        nationality: data.nationality || "",
        graduationYear: data.graduationYear?.toString() || "",
        functionProject: data.functionProject || "",
      })
      setIsActive(data.isActive)
    }
  }, [data])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    queryClient.invalidateQueries({ queryKey: ["admin", "users", id] })
    queryClient.invalidateQueries({ queryKey: ["audit-logs", "user", id] })
  }

  const updateUser = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const payload: Record<string, string | number | boolean | undefined> = { ...updates }
      if (!payload.employeeId) payload.employeeId = undefined
      if (!payload.nationality) payload.nationality = undefined
      if (!payload.jobTitle) payload.jobTitle = undefined
      if (!payload.functionProject) payload.functionProject = undefined
      if (payload.graduationYear) payload.graduationYear = parseInt(payload.graduationYear as string)
      else payload.graduationYear = undefined
      payload.isActive = isActive

      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to update user")
      }
      return res.json()
    },
    onSuccess: () => {
      invalidate()
      toast("Changes saved")
    },
    onError: (err: Error) => {
      toast(err.message || "Could not save. Check your connection", { icon: "alert" })
    },
  })

  // Danger zone: switches only the account status, leaving other edits in the form.
  const setActive = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to update user")
      }
      return next
    },
    onSuccess: (next) => {
      setIsActive(next)
      setConfirmStatus(false)
      keepFormEdits.current = true
      invalidate()
      toast(next ? "User reactivated" : "User deactivated")
    },
    onError: (err: Error) => {
      setConfirmStatus(false)
      toast(err.message || "Could not update the account. Check your connection", { icon: "alert" })
    },
  })

  const update = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value }))

  if (isLoading) return <LoadingSpinner label="Loading user…" />
  if (!data) {
    return (
      <>
        <PageHead title="User not found" back={{ href: "/admin/users", label: "Users" }} />
        <EmptyState
          icon={UserX}
          title="User not found"
          description="This account may have been removed. Go back to Users to pick another."
        />
      </>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`
  const roleLabel = ROLE_LABELS[data.role as keyof typeof ROLE_LABELS] || data.role
  const tierLabel = TIER_LABELS[data.tier as keyof typeof TIER_LABELS] || data.tier
  const subFacts = [data.jobTitle || "No title", data.department?.name, data.employeeId ? `#${data.employeeId}` : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <div>
      <PageHead
        back={{ href: "/admin/users", label: "Users" }}
        title={fullName}
        titleAside={
          <StatusChip tone={data.isActive ? "ok" : "neutral"}>{data.isActive ? "Active" : "Inactive"}</StatusChip>
        }
        sub={subFacts}
      />

      <div className="detail-grid">
        {/* Edit form */}
        <section className="card" aria-labelledby="user-form-title">
          <h2 className="card-title" id="user-form-title">Profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!updateUser.isPending) updateUser.mutate(formData)
            }}
          >
            <h3 className="form-section">Identity</h3>
            <div className="field-grid">
              <Field label="First name" htmlFor="user-first-name">
                <input id="user-first-name" className="input" value={formData.firstName || ""} onChange={(e) => update("firstName", e.target.value)} />
              </Field>
              <Field label="Last name" htmlFor="user-last-name">
                <input id="user-last-name" className="input" value={formData.lastName || ""} onChange={(e) => update("lastName", e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="user-email">
                <input id="user-email" className="input" type="email" value={formData.email || ""} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <Field label="Employee ID" htmlFor="user-employee-id">
                <input id="user-employee-id" className="input" value={formData.employeeId || ""} onChange={(e) => update("employeeId", e.target.value)} placeholder="e.g. 5684" />
              </Field>
              <Field label="Nationality" htmlFor="user-nationality">
                <input id="user-nationality" className="input" value={formData.nationality || ""} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g. Egyptian" />
              </Field>
              <Field label="Graduation year" htmlFor="user-grad-year">
                <input id="user-grad-year" className="input tabular" type="number" value={formData.graduationYear || ""} onChange={(e) => update("graduationYear", e.target.value)} placeholder="e.g. 2020" />
              </Field>
            </div>

            <h3 className="form-section">Role and tier</h3>
            <div className="field-grid">
              <Field label="Role" htmlFor="user-role">
                <SelectWrap>
                  <select id="user-role" className="select" value={formData.role || "USER"} onChange={(e) => update("role", e.target.value)}>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="Tier" htmlFor="user-tier">
                <SelectWrap>
                  <select id="user-tier" className="select" value={formData.tier || "ENGINEER"} onChange={(e) => update("tier", e.target.value)}>
                    {Object.entries(TIER_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </SelectWrap>
              </Field>
              <Field label="Job title" htmlFor="user-job-title">
                <input id="user-job-title" className="input" value={formData.jobTitle || ""} onChange={(e) => update("jobTitle", e.target.value)} />
              </Field>
              <Field label="Function / project" htmlFor="user-function">
                <input id="user-function" className="input" value={formData.functionProject || ""} onChange={(e) => update("functionProject", e.target.value)} placeholder="e.g. SG&A - Digitalization" />
              </Field>
            </div>

            <h3 className="form-section">Reporting line</h3>
            <div className="kv-grid" style={{ marginBottom: 14 }}>
              <div className="kv">
                <span className="kv-label">Department</span>
                <span className="kv-value">{data.department?.name || "—"}</span>
              </div>
            </div>

            <h3 className="form-section">Security</h3>
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
              <div className="min-w-0">
                <span className="kv-value" id="user-active-label">Account active</span>
                <p className="side-note">
                  {isActive
                    ? "This person can sign in and appears in teams, assignments and scoring."
                    : "This person can't sign in and is hidden from teams, assignments and scoring."}
                </p>
              </div>
              <Switch checked={isActive} onChange={setIsActive} label="Account active" />
            </div>

            <div className="settings-save">
              <button type="submit" className="btn btn-primary" aria-disabled={updateUser.isPending || undefined}>
                {updateUser.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <aside className="detail-side" aria-label="Account">
          {/* Account facts */}
          <section className="card side-card">
            <div className="client-head" style={{ marginBottom: 14 }}>
              <UserAvatar firstName={data.firstName} lastName={data.lastName} avatarUrl={data.avatarUrl} big />
              <div>
                <div className="kv-value">{fullName}</div>
                <div className="client-sub">{data.email}</div>
              </div>
            </div>
            <div className="kv-grid">
              <div className="kv">
                <span className="kv-label">Employee ID</span>
                <span className="kv-value">{data.employeeId ? <span className="kpi-code">{data.employeeId}</span> : "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Role · tier</span>
                <span className="kv-value">{roleLabel} · {tierLabel}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Title</span>
                <span className="kv-value">{data.jobTitle || "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Graduation year</span>
                <span className="kv-value tabular">{data.graduationYear || "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Function / project</span>
                <span className="kv-value">{data.functionProject || "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Last sign-in</span>
                <span className="kv-value tabular">{data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : "Never"}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Created</span>
                <span className="kv-value tabular">{new Date(data.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="kv">
                <span className="kv-label">User ID</span>
                <span className="kpi-code" style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>{data.id}</span>
              </div>
            </div>
          </section>

          {/* Recent activity */}
          <AuditTrail userId={id} />

          {/* Danger zone */}
          <section className="card side-card" aria-labelledby="danger-title">
            <h2 className="card-title" id="danger-title">{isActive ? "Deactivate account" : "Reactivate account"}</h2>
            <p className="card-sub">
              {isActive
                ? "Blocks sign-in and hides this person from every other page. Their history is kept."
                : "Restores sign-in and brings this person back into teams, assignments and scoring."}
            </p>
            <button
              type="button"
              className={`btn ${isActive ? "btn-danger" : ""} btn-block`}
              onClick={() => setConfirmStatus(true)}
            >
              {isActive ? "Deactivate user" : "Reactivate user"}
            </button>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmStatus}
        title={isActive ? `Deactivate ${fullName}?` : `Reactivate ${fullName}?`}
        message={
          isActive
            ? "They can no longer sign in and drop out of teams, assignments, scoring and reports; their data is kept."
            : "They can sign in again and reappear in teams, assignments, scoring and reports."
        }
        confirmLabel={isActive ? "Deactivate user" : "Reactivate user"}
        danger={isActive}
        busy={setActive.isPending}
        onConfirm={() => setActive.mutate(!isActive)}
        onCancel={() => setConfirmStatus(false)}
      />
    </div>
  )
}

// ─────────────────────────────────────
// Audit Trail Component
// ─────────────────────────────────────

interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof UserCog }> = {
  CREATE_USER: { label: "User created", icon: UserPlus },
  UPDATE_USER: { label: "User updated", icon: UserCog },
  ACTIVATE_USER: { label: "User activated", icon: Shield },
  DEACTIVATE_USER: { label: "User deactivated", icon: UserMinus },
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  role: "Role",
  tier: "Tier",
  jobTitle: "Job title",
  isActive: "Status",
  employeeId: "Employee ID",
  nationality: "Nationality",
  graduationYear: "Graduation year",
  functionProject: "Function / project",
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (key === "isActive") return value ? "Active" : "Inactive"
  if (key === "role" && typeof value === "string") return ROLE_LABELS[value as keyof typeof ROLE_LABELS] || value
  if (key === "tier" && typeof value === "string") return TIER_LABELS[value as keyof typeof TIER_LABELS] || value
  return String(value)
}

const RECENT_COUNT = 5

function AuditTrail({ userId }: { userId: string }) {
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", "user", userId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entity=user&entityId=${userId}&pageSize=50`)
      if (!res.ok) throw new Error("Failed to fetch audit logs")
      const json = await res.json()
      return json.data as AuditLogEntry[]
    },
    enabled: !!userId,
  })

  const logs = data || []
  const shown = showAll ? logs : logs.slice(0, RECENT_COUNT)

  return (
    <section className="card side-card" aria-labelledby="activity-title">
      <div className="card-head">
        <h2 className="card-title" id="activity-title" style={{ marginBottom: 0 }}>Recent activity</h2>
        {logs.length > 0 && (
          <TagPill>{logs.length} {logs.length === 1 ? "entry" : "entries"}</TagPill>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading activity…" />
      ) : logs.length === 0 ? (
        <p className="side-note" style={{ marginTop: 10 }}>No changes logged for this account yet.</p>
      ) : (
        <>
          <div className="audit-list" style={{ marginTop: 6 }}>
            {shown.map((log) => {
              const config = ACTION_CONFIG[log.action] || { label: log.action, icon: UserCog }
              const Icon = config.icon
              const changedFields = log.oldValue && log.newValue
                ? Object.keys(log.newValue).filter((k) => k !== "name")
                : []

              return (
                <div key={log.id} className="audit-row">
                  <span className="audit-ic">
                    <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div className="audit-main">
                    <span className="audit-title">{config.label}</span>
                    <span className="audit-sub">
                      by {log.user.firstName} {log.user.lastName}
                      {" · "}
                      <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                    </span>

                    {/* Changed fields */}
                    {changedFields.length > 0 && (
                      <div className="audit-changes">
                        {changedFields.map((field) => (
                          <div key={field} className="audit-change">
                            <span className="audit-field">{FIELD_LABELS[field] || field}</span>
                            <span className="audit-vals">
                              <del>{formatValue(field, log.oldValue?.[field])}</del>
                              <span className="audit-arrow" aria-label="changed to">→</span>
                              {formatValue(field, log.newValue?.[field])}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Create action: show created values */}
                    {log.action === "CREATE_USER" && log.newValue && (
                      <div className="audit-changes">
                        {Object.entries(log.newValue).map(([field, val]) => (
                          <div key={field} className="audit-change">
                            <span className="audit-field">{FIELD_LABELS[field] || field}</span>
                            <span className="audit-vals">{formatValue(field, val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {logs.length > RECENT_COUNT && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              <Clock size={15} aria-hidden="true" />
              {showAll ? "Show recent only" : `Show all ${logs.length} entries`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
