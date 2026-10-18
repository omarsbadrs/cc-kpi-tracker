"use client"

import { useState, useCallback, type KeyboardEvent } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Clock, UserCog, UserPlus, UserMinus, Shield, SlidersHorizontal, X, Plus, Users } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { Field, SelectWrap, SearchInput } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { Modal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Pagination } from "@/components/shared/Pagination"
import { EmptyState } from "@/components/shared/EmptyState"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
import "@/styles/views/admin-users.css"

interface Filters {
  search: string
  role: string
  tier: string
  isActive: string
  departmentId: string
  managerId: string
  sortBy: string
  sortOrder: string
}

const INITIAL_FILTERS: Filters = {
  search: "",
  role: "",
  tier: "",
  isActive: "true",
  departmentId: "",
  managerId: "",
  sortBy: "createdAt",
  sortOrder: "desc",
}

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date created" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "role", label: "Role" },
  { value: "tier", label: "Tier" },
  { value: "lastLoginAt", label: "Last sign-in" },
]

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export default function AdminUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    setPage(1)
  }, [])

  const activeFilterCount = [filters.role, filters.tier, filters.isActive, filters.departmentId, filters.managerId]
    .filter(Boolean).length
  // Role and tier sit in the toolbar; the rest live behind "More filters".
  const moreFilterCount = [filters.isActive, filters.departmentId, filters.managerId].filter(Boolean).length

  // Fetch departments for filter dropdown
  const { data: deptData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) return { data: [] }
      return res.json()
    },
  })
  const departments: Array<{ id: string; name: string }> = deptData?.data || []

  // Fetch managers for filter dropdown
  const { data: mgrData } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const res = await fetch("/api/users?role=MANAGER&pageSize=100")
      if (!res.ok) return { data: [] }
      const json = await res.json()
      // Also include admins and team leads who can be managers
      const res2 = await fetch("/api/users?role=ADMIN&pageSize=100")
      const json2 = res2.ok ? await res2.json() : { data: [] }
      return { data: [...(json.data || []), ...(json2.data || [])] }
    },
  })
  const managers: Array<{ id: string; firstName: string; lastName: string; role?: string; isActive?: boolean }> =
    mgrData?.data || []
  const adminCount = mgrData ? managers.filter((m) => m.role === "ADMIN" && m.isActive !== false).length : null

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" })
      if (filters.search) params.set("search", filters.search)
      if (filters.role) params.set("role", filters.role)
      if (filters.tier) params.set("tier", filters.tier)
      if (filters.isActive) params.set("isActive", filters.isActive)
      if (filters.departmentId) params.set("departmentId", filters.departmentId)
      if (filters.managerId) params.set("managerId", filters.managerId)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder)
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
      toast("User created")
    },
    onError: (err: Error) => {
      toast(err.message || "Could not create the user. Check your connection", { icon: "alert" })
    },
  })

  const users: UserRow[] = data?.data || []
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined

  const openUser = (id: string) => router.push(`/admin/users/${id}`)
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      openUser(id)
    }
  }

  const subFacts: string[] = []
  if (meta) subFacts.push(plural(meta.total, "person", "people"))
  if (adminCount !== null) subFacts.push(plural(adminCount, "admin", "admins"))
  if (filters.isActive === "true") subFacts.push("active accounts")
  else if (filters.isActive === "false") subFacts.push("inactive accounts")

  const managerName = (id: string) => {
    const m = managers.find((x) => x.id === id)
    return m ? `${m.firstName} ${m.lastName}` : "…"
  }

  return (
    <div>
      <PageHead
        title="Users"
        sub={subFacts.length ? subFacts.join(" · ") : "Loading…"}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            New user
          </button>
        }
      />

      {/* Search + role/tier + more filters */}
      <div className="toolbar wrap">
        <SearchInput
          placeholder="Search name, email or employee ID"
          aria-label="Search users"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
        <div className="toolbar-select">
          <SelectWrap>
            <select
              className="select"
              aria-label="Role"
              value={filters.role}
              onChange={(e) => updateFilter("role", e.target.value)}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="USER">User</option>
            </select>
          </SelectWrap>
        </div>
        <div className="toolbar-select">
          <SelectWrap>
            <select
              className="select"
              aria-label="Tier"
              value={filters.tier}
              onChange={(e) => updateFilter("tier", e.target.value)}
            >
              <option value="">All tiers</option>
              {Object.entries(TIER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </SelectWrap>
        </div>
        <button
          type="button"
          className="btn"
          aria-expanded={showFilters}
          aria-controls="user-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          More filters
          {moreFilterCount > 0 && <TagPill>{moreFilterCount}</TagPill>}
        </button>
      </div>

      {/* More filters */}
      {showFilters && (
        <section className="card mb-3" id="user-filters" aria-label="More filters">
          <div className="field-grid">
            <Field label="Status" htmlFor="filter-status">
              <SelectWrap>
                <select
                  id="filter-status"
                  className="select"
                  value={filters.isActive}
                  onChange={(e) => updateFilter("isActive", e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </SelectWrap>
            </Field>
            <Field label="Department" htmlFor="filter-department">
              <SelectWrap>
                <select
                  id="filter-department"
                  className="select"
                  value={filters.departmentId}
                  onChange={(e) => updateFilter("departmentId", e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Reports to" htmlFor="filter-manager">
              <SelectWrap>
                <select
                  id="filter-manager"
                  className="select"
                  value={filters.managerId}
                  onChange={(e) => updateFilter("managerId", e.target.value)}
                >
                  <option value="">All managers</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Sort by" htmlFor="filter-sort">
              <SelectWrap>
                <select
                  id="filter-sort"
                  className="select"
                  value={filters.sortBy}
                  onChange={(e) => updateFilter("sortBy", e.target.value)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Order" htmlFor="filter-order">
              <SelectWrap>
                <select
                  id="filter-order"
                  className="select"
                  value={filters.sortOrder}
                  onChange={(e) => updateFilter("sortOrder", e.target.value)}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </SelectWrap>
            </Field>
          </div>
        </section>
      )}

      {/* Active filters: never filter invisibly */}
      {activeFilterCount > 0 && (
        <div className="chip-row" role="group" aria-label="Active filters">
          {filters.role && (
            <FilterTag
              label={`Role: ${ROLE_LABELS[filters.role as keyof typeof ROLE_LABELS]}`}
              onRemove={() => updateFilter("role", "")}
            />
          )}
          {filters.tier && (
            <FilterTag
              label={`Tier: ${TIER_LABELS[filters.tier as keyof typeof TIER_LABELS]}`}
              onRemove={() => updateFilter("tier", "")}
            />
          )}
          {filters.isActive && (
            <FilterTag
              label={`Status: ${filters.isActive === "true" ? "Active" : "Inactive"}`}
              onRemove={() => updateFilter("isActive", "")}
            />
          )}
          {filters.departmentId && (
            <FilterTag
              label={`Department: ${departments.find((d) => d.id === filters.departmentId)?.name || "…"}`}
              onRemove={() => updateFilter("departmentId", "")}
            />
          )}
          {filters.managerId && (
            <FilterTag
              label={`Reports to: ${managerName(filters.managerId)}`}
              onRemove={() => updateFilter("managerId", "")}
            />
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Users table */}
      <section className="card list-card">
        <div className="card-head">
          <div className="flex items-center gap-2">
            <h2 className="card-title">People</h2>
            {meta && <TagPill>{meta.total}</TagPill>}
          </div>
        </div>
        {isLoading ? (
          <LoadingSpinner label="Loading users…" />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users match these filters"
            description="Try a different search, or clear the filters to see everyone."
            action={
              activeFilterCount > 0 || filters.search ? (
                <button type="button" className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Users">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Employee ID</th>
                    <th scope="col">Role</th>
                    <th scope="col">Tier</th>
                    <th scope="col">Department</th>
                    <th scope="col">Manager</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const name = `${user.firstName} ${user.lastName}`
                    return (
                      <tr
                        key={user.id}
                        className="clickable"
                        tabIndex={0}
                        aria-label={`Open ${name}`}
                        onClick={() => openUser(user.id)}
                        onKeyDown={(e) => onRowKey(e, user.id)}
                      >
                        <td>
                          <div className="person-cell">
                            <UserAvatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} />
                            <div className="person-text">
                              <span className="person-name">{name}</span>
                              <span className="person-sub">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="nowrap">
                          {user.employeeId ? <span className="kpi-code">{user.employeeId}</span> : <span className="muted">—</span>}
                        </td>
                        <td>
                          <TagPill>{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}</TagPill>
                        </td>
                        <td className="nowrap ink-2">{TIER_LABELS[user.tier as keyof typeof TIER_LABELS] ?? user.tier}</td>
                        <td className="clip muted">{user.department?.name || "—"}</td>
                        <td className="clip muted">
                          {user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "—"}
                        </td>
                        <td>
                          <StatusChip tone={user.isActive ? "ok" : "neutral"} small>
                            {user.isActive ? "Active" : "Inactive"}
                          </StatusChip>
                        </td>
                        <td className="num">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="btn btn-sm"
                            aria-label={`Edit ${name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
              <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
            )}
          </>
        )}
      </section>

      {/* Global audit trail */}
      <GlobalAuditTrail />

      <Modal
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="New user"
        wide
        locked={createUser.isPending}
      >
        <CreateUserForm
          onSubmit={(formData) => createUser.mutate(formData)}
          onCancel={() => setShowCreateForm(false)}
          isLoading={createUser.isPending}
        />
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────
// Types & Helper Components
// ─────────────────────────────────────

interface UserRow {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId?: string | null
  avatarUrl?: string | null
  role: string
  tier: string
  isActive: boolean
  department?: { id: string; name: string } | null
  manager?: { id: string; firstName: string; lastName: string } | null
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="chip active" aria-pressed="true" aria-label={`Remove filter ${label}`} title="Remove filter" onClick={onRemove}>
      {label}
      <X size={14} aria-hidden="true" />
    </button>
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
  const logMeta = data?.meta as { page: number; totalPages: number; total: number } | undefined

  return (
    <>
      <h2 className="section-head">Audit log</h2>
      <section className="card list-card" aria-label="Audit log">
        <div className="card-head">
          <div className="flex min-w-0 items-center gap-2">
            <span className="card-title">Changes to user accounts</span>
            {logMeta?.total != null && <TagPill>{logMeta.total}</TagPill>}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={expanded}
            aria-controls="global-audit-log"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide log" : "Show log"}
          </button>
        </div>

        {expanded && (
          <div id="global-audit-log">
            {isLoading ? (
              <LoadingSpinner label="Loading audit log…" />
            ) : logs.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No changes logged yet"
                description="Creating, editing or deactivating a user adds an entry here."
              />
            ) : (
              <>
                <div className="audit-list">
                  {logs.map((log) => {
                    const config = ACTION_CONFIG[log.action] || { label: log.action, icon: UserCog }
                    const Icon = config.icon
                    const targetName = getTargetUserName(log)
                    const changedFields = log.oldValue && log.newValue
                      ? Object.keys(log.newValue).filter((k) => k !== "name")
                      : []

                    return (
                      <div key={log.id} className="audit-row">
                        <span className="audit-ic">
                          <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                        </span>
                        <div className="audit-main">
                          <span className="audit-title">
                            {config.label}
                            {targetName && <span className="audit-target"> · {targetName}</span>}
                          </span>
                          <span className="audit-sub">
                            <span className="kpi-code">{log.action}</span>
                            {" · "}by {log.user.firstName} {log.user.lastName}
                            {" · "}
                            <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                          </span>

                          {/* Changed fields for updates */}
                          {changedFields.length > 0 && log.action !== "CREATE_USER" && (
                            <div className="audit-changes">
                              {changedFields.map((field) => (
                                <div key={field} className="audit-change">
                                  <span className="audit-field">{FIELD_LABELS[field] || field}</span>
                                  <span className="audit-vals">
                                    <del>{formatAuditValue(field, log.oldValue?.[field])}</del>
                                    <span className="audit-arrow" aria-label="changed to">→</span>
                                    {formatAuditValue(field, log.newValue?.[field])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Created values */}
                          {log.action === "CREATE_USER" && log.newValue && (
                            <div className="audit-changes">
                              {Object.entries(log.newValue).map(([field, val]) => (
                                <div key={field} className="audit-change">
                                  <span className="audit-field">{FIELD_LABELS[field] || field}</span>
                                  <span className="audit-vals">{formatAuditValue(field, val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {logMeta && logMeta.totalPages > 1 && (
                  <Pagination page={logMeta.page} totalPages={logMeta.totalPages} onPageChange={setLogPage} />
                )}
              </>
            )}
          </div>
        )}
      </section>
    </>
  )
}

// ─────────────────────────────────────
// Create User Form
// ─────────────────────────────────────

function CreateUserForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: Record<string, string>) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    email: "", password: "", firstName: "", lastName: "",
    role: "USER", tier: "ENGINEER", jobTitle: "", employeeId: "",
  })

  const update = (key: string, value: string) => setFormData({ ...formData, [key]: value })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isLoading) onSubmit(formData)
      }}
    >
      <h3 className="form-section" style={{ borderTop: 0, paddingTop: 0 }}>Identity</h3>
      <div className="field-grid">
        <Field label="First name" htmlFor="new-first-name">
          <input id="new-first-name" className="input" autoComplete="off" value={formData.firstName} onChange={(e) => update("firstName", e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="new-last-name">
          <input id="new-last-name" className="input" autoComplete="off" value={formData.lastName} onChange={(e) => update("lastName", e.target.value)} />
        </Field>
        <Field label="Employee ID" htmlFor="new-employee-id">
          <input id="new-employee-id" className="input" placeholder="e.g. 5684" value={formData.employeeId} onChange={(e) => update("employeeId", e.target.value)} />
        </Field>
      </div>

      <h3 className="form-section">Sign-in</h3>
      <div className="field-grid">
        <Field label="Email" htmlFor="new-email">
          <input id="new-email" className="input" type="email" autoComplete="off" value={formData.email} onChange={(e) => update("email", e.target.value)} />
        </Field>
        <Field
          label="Password"
          hint="8+ characters with upper and lower case, a number and a symbol"
          htmlFor="new-password"
        >
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={formData.password} onChange={(e) => update("password", e.target.value)} />
        </Field>
      </div>

      <h3 className="form-section">Role and tier</h3>
      <div className="field-grid">
        <Field label="Role" htmlFor="new-role">
          <SelectWrap>
            <select id="new-role" className="select" value={formData.role} onChange={(e) => update("role", e.target.value)}>
              <option value="USER">User</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </SelectWrap>
        </Field>
        <Field label="Tier" htmlFor="new-tier">
          <SelectWrap>
            <select id="new-tier" className="select" value={formData.tier} onChange={(e) => update("tier", e.target.value)}>
              <option value="JUNIOR">Junior</option>
              <option value="ENGINEER">Engineer</option>
              <option value="SENIOR">Senior</option>
              <option value="TEAM_LEAD">Team lead</option>
              <option value="SECTION_HEAD">Head of department</option>
            </select>
          </SelectWrap>
        </Field>
        <Field label="Job title" htmlFor="new-job-title">
          <input id="new-job-title" className="input" value={formData.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} />
        </Field>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" aria-disabled={isLoading || undefined}>
          {isLoading ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  )
}
