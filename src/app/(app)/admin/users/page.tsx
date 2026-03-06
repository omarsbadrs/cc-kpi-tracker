"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"
import { Pagination } from "@/components/shared/Pagination"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import { useRouter } from "next/navigation"
import { Clock, UserCog, UserPlus, UserMinus, Shield, ChevronDown } from "lucide-react"

export default function AdminUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    },
  })

  const createUser = useMutation({
    mutationFn: async (userData: Record<string, string>) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to create user")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setShowCreateForm(false)
    },
  })

  if (isLoading) return <LoadingSpinner />

  const users = data?.data || []
  const meta = data?.meta

  return (
    <div>
      <PageHeader
        title="User Management"
        description={`${meta?.total || 0} users total`}
        action={
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Cancel" : "Add User"}
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or employee ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full max-w-md rounded-lg border border-border bg-input px-4 py-2 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-blue-500"
        />
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateUserForm
          onSubmit={(data) => createUser.mutate(data)}
          isLoading={createUser.isPending}
          error={createUser.error?.message}
        />
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary">
              <th className="px-4 py-3 font-medium text-foreground-secondary">Name</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Email</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Role</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Tier</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: { id: string; firstName: string; lastName: string; email: string; role: string; tier: string; isActive: boolean }) => (
              <tr
                key={user.id}
                onClick={() => router.push(`/admin/users/${user.id}`)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-card-hover"
              >
                <td className="px-4 py-3 font-medium text-foreground">{user.firstName} {user.lastName}</td>
                <td className="px-4 py-3 text-foreground-secondary">{user.email}</td>
                <td className="px-4 py-3"><Badge>{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</Badge></td>
                <td className="px-4 py-3 text-xs text-foreground-muted">{TIER_LABELS[user.tier as keyof typeof TIER_LABELS]}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.isActive ? "success" : "danger"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
      </div>

      {/* Global Audit Trail */}
      <GlobalAuditTrail />
    </div>
  )
}

// ─────────────────────────────────────
// Global Audit Trail
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
}

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (key === "isActive") return value ? "Active" : "Inactive"
  if (key === "role" && typeof value === "string") return ROLE_LABELS[value as keyof typeof ROLE_LABELS] || value
  if (key === "tier" && typeof value === "string") return TIER_LABELS[value as keyof typeof TIER_LABELS] || value
  return String(value)
}

function getTargetUserName(log: AuditLogEntry): string {
  if (log.action === "CREATE_USER" && log.newValue) {
    return `${log.newValue.firstName || ""} ${log.newValue.lastName || ""}`.trim()
  }
  if (log.newValue?.name) return String(log.newValue.name)
  if (log.newValue?.firstName || log.newValue?.lastName) {
    return `${log.newValue.firstName || log.oldValue?.firstName || ""} ${log.newValue.lastName || log.oldValue?.lastName || ""}`.trim()
  }
  if (log.oldValue?.firstName || log.oldValue?.lastName) {
    return `${log.oldValue.firstName || ""} ${log.oldValue.lastName || ""}`.trim()
  }
  return ""
}

function GlobalAuditTrail() {
  const [expanded, setExpanded] = useState(false)
  const [logPage, setLogPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", "global", logPage],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entity=user&page=${logPage}&pageSize=20`)
      if (!res.ok) throw new Error("Failed to fetch audit logs")
      return res.json()
    },
  })

  const logs: AuditLogEntry[] = data?.data || []
  const logMeta = data?.meta

  return (
    <div className="mt-8 rounded-xl border border-card-border bg-card-bg">
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-card-hover"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-4.5 w-4.5 text-foreground-muted" />
          <h3 className="text-base font-semibold text-foreground">Audit Trail</h3>
          {logMeta?.total != null && (
            <span className="rounded-full bg-background-secondary px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
              {logMeta.total}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-foreground-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-border px-6 py-5">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-foreground-muted">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-foreground-muted">No audit trail entries yet</div>
          ) : (
            <>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-0">
                  {logs.map((log) => {
                    const config = ACTION_CONFIG[log.action] || { label: log.action, icon: UserCog, color: "text-foreground-muted" }
                    const Icon = config.icon
                    const targetName = getTargetUserName(log)
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
                            {targetName && (
                              <span className="text-sm font-medium text-foreground">{targetName}</span>
                            )}
                            <span className="text-xs text-foreground-muted">
                              by {log.user.firstName} {log.user.lastName}
                            </span>
                            <span className="text-xs text-foreground-muted">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Changed fields for UPDATE */}
                          {changedFields.length > 0 && log.action !== "CREATE_USER" && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                              {changedFields.map((field) => (
                                <div key={field} className="flex items-center gap-1.5 text-xs">
                                  <span className="text-foreground-muted">{FIELD_LABELS[field] || field}:</span>
                                  <span className="text-red-400/70 line-through">{formatAuditValue(field, log.oldValue?.[field])}</span>
                                  <span className="text-foreground-muted">&rarr;</span>
                                  <span className="text-green-400">{formatAuditValue(field, log.newValue?.[field])}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Created values */}
                          {log.action === "CREATE_USER" && log.newValue && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                              {Object.entries(log.newValue).map(([field, val]) => (
                                <div key={field} className="flex items-center gap-1.5 text-xs">
                                  <span className="text-foreground-muted">{FIELD_LABELS[field] || field}:</span>
                                  <span className="text-green-400">{formatAuditValue(field, val)}</span>
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

              {/* Pagination */}
              {logMeta && logMeta.totalPages > 1 && (
                <div className="mt-4 border-t border-border pt-4">
                  <Pagination page={logMeta.page} totalPages={logMeta.totalPages} onPageChange={setLogPage} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────
// Create User Form
// ─────────────────────────────────────

function CreateUserForm({ onSubmit, isLoading, error }: { onSubmit: (data: Record<string, string>) => void; isLoading: boolean; error?: string }) {
  const [formData, setFormData] = useState({
    email: "", password: "", firstName: "", lastName: "",
    role: "USER", tier: "ENGINEER", jobTitle: "", employeeId: "",
  })

  const update = (key: string, value: string) => setFormData({ ...formData, [key]: value })

  return (
    <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-6">
      <h3 className="mb-4 text-sm font-medium text-foreground-muted">New User</h3>
      {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="First Name" value={formData.firstName} onChange={(e) => update("firstName", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Last Name" value={formData.lastName} onChange={(e) => update("lastName", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Email" type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Password" type="password" value={formData.password} onChange={(e) => update("password", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <select value={formData.role} onChange={(e) => update("role", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500">
          <option value="USER">User</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select value={formData.tier} onChange={(e) => update("tier", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500">
          <option value="JUNIOR">Junior</option>
          <option value="ENGINEER">Engineer</option>
          <option value="SENIOR">Senior</option>
          <option value="TEAM_LEAD">Team Lead</option>
          <option value="SECTION_HEAD">Head of Department</option>
        </select>
        <input placeholder="Job Title" value={formData.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
        <input placeholder="Employee ID" value={formData.employeeId} onChange={(e) => update("employeeId", e.target.value)} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
      </div>
      <button onClick={() => onSubmit(formData)} disabled={isLoading} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {isLoading ? "Creating..." : "Create User"}
      </button>
    </div>
  )
}
