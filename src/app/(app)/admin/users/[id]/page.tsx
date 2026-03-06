"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import { ArrowLeft, Save, Clock, UserCog, UserPlus, UserMinus, Shield, Mail, Briefcase, GraduationCap, Hash, Building2 } from "lucide-react"

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
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(true)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`)
      if (!res.ok) throw new Error("Failed to fetch user")
      return (await res.json()).data as UserData
    },
    enabled: !!id,
  })

  useEffect(() => {
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
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "users", id] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", "user", id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const update = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value }))

  if (isLoading) return <LoadingSpinner />
  if (!data) return <div className="p-8 text-center text-foreground-muted">User not found</div>

  const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-blue-500"
  const labelClass = "mb-1.5 block text-xs font-medium text-foreground-muted"
  const selectClass = "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-blue-500"

  return (
    <div>
      <PageHeader
        title="Edit User"
        description={`${data.firstName} ${data.lastName}`}
        action={
          <button
            onClick={() => router.push("/admin/users")}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary hover:bg-card-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </button>
        }
      />

      {/* Profile header */}
      <div className="card-shadow mb-6 rounded-xl border border-card-border bg-card-bg p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
            {data.firstName[0]}{data.lastName[0]}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">{data.firstName} {data.lastName}</h2>
            <p className="text-sm text-foreground-muted">{data.jobTitle || "No title"}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-xs font-semibold ${isActive ? "text-green-500" : "text-red-400"}`}>
              {isActive ? "Active" : "Inactive"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`status-toggle ${isActive ? "status-toggle-on" : "status-toggle-off"}`}
            >
              <span className="status-toggle-thumb" />
            </button>
          </div>
        </div>

        {/* Team directory info */}
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Employee ID:</span>
            <span className="font-medium text-foreground">{data.employeeId || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Email:</span>
            <span className="font-medium text-foreground truncate">{data.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Title:</span>
            <span className="font-medium text-foreground">{data.jobTitle || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Grad Year:</span>
            <span className="font-medium text-foreground">{data.graduationYear || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Function / Project:</span>
            <span className="font-medium text-foreground">{data.functionProject || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-foreground-muted" />
            <span className="text-foreground-muted">Role:</span>
            <span className="font-medium text-foreground">{ROLE_LABELS[data.role as keyof typeof ROLE_LABELS] || data.role}</span>
            <span className="mx-1 text-foreground-muted">/</span>
            <span className="font-medium text-foreground">{TIER_LABELS[data.tier as keyof typeof TIER_LABELS] || data.tier}</span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card-shadow rounded-xl border border-card-border bg-card-bg p-6">
        <h3 className="mb-6 text-lg font-semibold text-foreground">User Information</h3>

        {updateUser.error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {updateUser.error.message}
          </div>
        )}
        {saved && (
          <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
            User updated successfully
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>First Name</label>
            <input value={formData.firstName || ""} onChange={(e) => update("firstName", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input value={formData.lastName || ""} onChange={(e) => update("lastName", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={formData.email || ""} onChange={(e) => update("email", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Employee ID</label>
            <input value={formData.employeeId || ""} onChange={(e) => update("employeeId", e.target.value)} placeholder="e.g., 5684" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={formData.role || "USER"} onChange={(e) => update("role", e.target.value)} className={selectClass}>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tier</label>
            <select value={formData.tier || "ENGINEER"} onChange={(e) => update("tier", e.target.value)} className={selectClass}>
              {Object.entries(TIER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Job Title</label>
            <input value={formData.jobTitle || ""} onChange={(e) => update("jobTitle", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nationality</label>
            <input value={formData.nationality || ""} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g., Egyptian" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Graduation Year</label>
            <input type="number" value={formData.graduationYear || ""} onChange={(e) => update("graduationYear", e.target.value)} placeholder="e.g., 2020" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Function / Project</label>
            <input value={formData.functionProject || ""} onChange={(e) => update("functionProject", e.target.value)} placeholder="e.g., SG&A - Digitalization" className={inputClass} />
          </div>
        </div>

        {/* Meta info (read-only) */}
        <div className="mt-6 border-t border-border pt-5">
          <h4 className="mb-3 text-sm font-medium text-foreground-muted">Account Info</h4>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-foreground-muted">Last Login</p>
              <p className="text-foreground">{data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : "Never"}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Created</p>
              <p className="text-foreground">{new Date(data.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-muted">User ID</p>
              <p className="font-mono text-xs text-foreground-muted">{data.id}</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => updateUser.mutate(formData)}
            disabled={updateUser.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateUser.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Audit Trail */}
      <AuditTrail userId={id} />
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

const ACTION_CONFIG: Record<string, { label: string; icon: typeof UserCog; color: string }> = {
  CREATE_USER: { label: "User Created", icon: UserPlus, color: "text-green-500" },
  UPDATE_USER: { label: "User Updated", icon: UserCog, color: "text-blue-400" },
  ACTIVATE_USER: { label: "User Activated", icon: Shield, color: "text-green-500" },
  DEACTIVATE_USER: { label: "User Deactivated", icon: UserMinus, color: "text-red-400" },
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  role: "Role",
  tier: "Tier",
  jobTitle: "Job Title",
  isActive: "Status",
  employeeId: "Employee ID",
  nationality: "Nationality",
  graduationYear: "Graduation Year",
  functionProject: "Function / Project",
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (key === "isActive") return value ? "Active" : "Inactive"
  if (key === "role" && typeof value === "string") return ROLE_LABELS[value as keyof typeof ROLE_LABELS] || value
  if (key === "tier" && typeof value === "string") return TIER_LABELS[value as keyof typeof TIER_LABELS] || value
  return String(value)
}

function AuditTrail({ userId }: { userId: string }) {
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

  return (
    <div className="card-shadow mt-6 rounded-xl border border-card-border bg-card-bg p-6">
      <div className="mb-5 flex items-center gap-2">
        <Clock className="h-4 w-4 text-foreground-muted" />
        <h3 className="text-lg font-semibold text-foreground">Audit Trail</h3>
        {logs.length > 0 && (
          <span className="rounded-full bg-background-secondary px-2 py-0.5 text-xs text-foreground-muted">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-foreground-muted">Loading audit trail...</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-foreground-muted">No audit trail entries yet</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-0">
            {logs.map((log) => {
              const config = ACTION_CONFIG[log.action] || { label: log.action, icon: UserCog, color: "text-foreground-muted" }
              const Icon = config.icon
              const changedFields = log.oldValue && log.newValue
                ? Object.keys(log.newValue).filter((k) => k !== "name")
                : []

              return (
                <div key={log.id} className="relative flex gap-4 py-3">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-card-border bg-card-bg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-xs text-foreground-muted">
                        by {log.user.firstName} {log.user.lastName}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Changed fields */}
                    {changedFields.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {changedFields.map((field) => {
                          const oldVal = log.oldValue?.[field]
                          const newVal = log.newValue?.[field]
                          return (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-foreground-secondary">{FIELD_LABELS[field] || field}:</span>
                              <span className="text-red-400/70 line-through">{formatValue(field, oldVal)}</span>
                              <span className="text-foreground-muted">&rarr;</span>
                              <span className="text-green-400">{formatValue(field, newVal)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Create action — show created values */}
                    {log.action === "CREATE_USER" && log.newValue && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(log.newValue).map(([field, val]) => (
                          <div key={field} className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-foreground-secondary">{FIELD_LABELS[field] || field}:</span>
                            <span className="text-green-400">{formatValue(field, val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
