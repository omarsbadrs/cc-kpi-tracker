"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS } from "@/lib/constants"
import {
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  Mail,
  GraduationCap,
  Globe,
  UserCircle,
  Pencil,
  X,
  Check,
  Loader2,
} from "lucide-react"

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  role: string
  tier: string
  jobTitle: string | null
  isActive: boolean
  avatarUrl: string | null
  managerId: string | null
  nationality: string | null
  graduationYear: number | null
  lastLoginAt: string | null
}

interface ManagerWithReports extends Member {
  reports: Member[]
}

interface TeamData {
  managers?: ManagerWithReports[]
  unassigned?: Member[]
  allUsers?: Member[]
  reports?: Member[]
}

const tierOrder: Record<string, number> = {
  SECTION_HEAD: 5,
  TEAM_LEAD: 4,
  SENIOR: 3,
  ENGINEER: 2,
  JUNIOR: 1,
}

const tierColors: Record<string, { bg: string; text: string; dot: string; avatar: string }> = {
  SECTION_HEAD: { bg: "bg-violet-500/10", text: "text-violet-500", dot: "bg-violet-500", avatar: "from-violet-500 to-purple-600" },
  TEAM_LEAD: { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500", avatar: "from-blue-500 to-indigo-600" },
  SENIOR: { bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500", avatar: "from-emerald-500 to-teal-600" },
  ENGINEER: { bg: "bg-sky-500/10", text: "text-sky-500", dot: "bg-sky-500", avatar: "from-sky-500 to-blue-600" },
  JUNIOR: { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500", avatar: "from-amber-500 to-orange-600" },
}

const defaultTierColor = { bg: "bg-sky-500/10", text: "text-sky-500", dot: "bg-sky-500", avatar: "from-sky-500 to-blue-600" }

export default function TeamMembersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAdmin = session?.user?.role === "ADMIN"
  const [search, setSearch] = useState("")
  const [editSearch, setEditSearch] = useState("")
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team", "hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/team")
      if (!res.ok) throw new Error("Failed to fetch team")
      return (await res.json()).data
    },
  })

  const reassignMutation = useMutation({
    mutationFn: async (payload: { userId: string; managerId: string | null } | { userIds: string[]; managerId: string | null }) => {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to reassign")
      }
      return res.json()
    },
    onMutate: (payload) => setPendingId("userId" in payload ? payload.userId : "bulk"),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", "hierarchy"] })
    },
  })

  if (isLoading) return <LoadingSpinner />

  const toggleManager = (id: string) => {
    setExpandedManagers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    if (data?.managers) setExpandedManagers(new Set(data.managers.map((m) => m.id)))
  }

  const collapseAll = () => setExpandedManagers(new Set())

  const matchesSearch = (m: Member, q: string) => {
    if (!q) return true
    const lower = q.toLowerCase()
    return (
      m.firstName.toLowerCase().includes(lower) ||
      m.lastName.toLowerCase().includes(lower) ||
      m.email.toLowerCase().includes(lower) ||
      m.jobTitle?.toLowerCase().includes(lower) ||
      m.employeeId?.toLowerCase().includes(lower) ||
      false
    )
  }

  // ── Manager view ──
  if (!isAdmin && data?.reports) {
    const filtered = data.reports.filter((m) => matchesSearch(m, search))
    return (
      <div>
        <PageHeader
          title="My Team"
          description={`${data.reports.length} direct report${data.reports.length !== 1 ? "s" : ""}`}
        />
        <SearchBar value={search} onChange={setSearch} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <MemberCard key={member.id} member={member} onClick={() => router.push(`/manager/members/${member.id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-foreground-muted">No team members found</div>
          )}
        </div>
      </div>
    )
  }

  // ── Admin view ──
  const managers = data?.managers || []
  const unassigned = data?.unassigned || []
  const allUsers = data?.allUsers || []
  const allExpanded = managers.length > 0 && expandedManagers.size === managers.length
  const totalReports = managers.reduce((sum, m) => sum + m.reports.length, 0)

  // Build a set of manager IDs (the accordion headers) so we can identify them in the list
  const managerIdSet = new Set(managers.map((m) => m.id))

  // In edit mode: for each manager, show all users except themselves
  const getEmployeesForManager = (managerId: string) => {
    return allUsers.filter((u) => u.id !== managerId)
  }

  const getAssignedIds = (managerId: string) => {
    const mgr = managers.find((m) => m.id === managerId)
    return new Set(mgr?.reports.map((r) => r.id) || [])
  }

  const handleToggleAssignment = (employeeId: string, managerId: string, isCurrentlyAssigned: boolean) => {
    reassignMutation.mutate({
      userId: employeeId,
      managerId: isCurrentlyAssigned ? null : managerId,
    })
  }

  return (
    <div>
      <PageHeader
        title="Team Directory"
        description={`${managers.length} managers, ${totalReports} team members, ${unassigned.length} unassigned`}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={editMode ? editSearch : search} onChange={editMode ? setEditSearch : setSearch} />
        <div className="flex gap-2">
          {!editMode && (
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground-secondary transition-colors hover:bg-card-hover"
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          )}
          <button
            onClick={() => { setEditMode(!editMode); setEditSearch(""); setExpandedManagers(new Set()) }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              editMode
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "border border-border text-foreground-secondary hover:bg-card-hover"
            }`}
          >
            {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editMode ? "Done" : "Edit Assignments"}
          </button>
        </div>
      </div>

      {/* ── EDIT MODE ── */}
      {editMode ? (
        <div className="space-y-5">
          {managers.map((manager) => {
            const assignedIds = getAssignedIds(manager.id)
            const employees = getEmployeesForManager(manager.id)
            const filtered = employees.filter((e) => matchesSearch(e, editSearch))
            const assignedFiltered = filtered.filter((e) => assignedIds.has(e.id))
            const unassignedFiltered = filtered.filter((e) => !assignedIds.has(e.id))

            return (
              <div key={manager.id} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {/* Manager header */}
                <div className="flex items-center gap-4 p-4 border-b border-border">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tierColors[manager.tier]?.avatar ?? defaultTierColor.avatar} text-sm font-bold text-white shadow-sm`}>
                    {manager.firstName[0]}{manager.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {manager.firstName} {manager.lastName}
                      </h3>
                      <TierBadge tier={manager.tier} />
                    </div>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {manager.jobTitle || TIER_LABELS[manager.tier as keyof typeof TIER_LABELS]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1">
                      <Users className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.5} />
                      <span className="text-xs font-semibold text-blue-500">{assignedIds.size}</span>
                    </div>
                    {/* Select All / Deselect All */}
                    {unassignedFiltered.length > 0 && (
                      <button
                        disabled={reassignMutation.isPending}
                        onClick={() => {
                          const ids = unassignedFiltered.map((e) => e.id)
                          reassignMutation.mutate({ userIds: ids, managerId: manager.id })
                        }}
                        className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Select All
                      </button>
                    )}
                    {assignedFiltered.length > 0 && (
                      <button
                        disabled={reassignMutation.isPending}
                        onClick={() => {
                          const ids = assignedFiltered.map((e) => e.id)
                          reassignMutation.mutate({ userIds: ids, managerId: null })
                        }}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Deselect All
                      </button>
                    )}
                  </div>
                </div>

                {/* Employee list with checkboxes */}
                <div className="max-h-[420px] overflow-y-auto">
                  {/* Assigned first */}
                  {assignedFiltered.length > 0 && (
                    <div>
                      <div className="sticky top-0 z-[1] bg-card-bg/95 backdrop-blur-sm px-4 py-2 border-b border-border">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
                          Assigned ({assignedFiltered.length})
                        </p>
                      </div>
                      {assignedFiltered
                        .sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0))
                        .map((emp) => (
                          <EmployeeCheckRow
                            key={emp.id}
                            employee={emp}
                            isAssigned={true}
                            isPending={pendingId === emp.id}
                            onToggle={() => handleToggleAssignment(emp.id, manager.id, true)}
                          />
                        ))}
                    </div>
                  )}

                  {/* Unassigned */}
                  {unassignedFiltered.length > 0 && (
                    <div>
                      <div className="sticky top-0 z-[1] bg-card-bg/95 backdrop-blur-sm px-4 py-2 border-b border-border">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                          Available ({unassignedFiltered.length})
                        </p>
                      </div>
                      {unassignedFiltered
                        .sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0))
                        .map((emp) => (
                          <EmployeeCheckRow
                            key={emp.id}
                            employee={emp}
                            isAssigned={false}
                            isPending={pendingId === emp.id}
                            onToggle={() => handleToggleAssignment(emp.id, manager.id, false)}
                          />
                        ))}
                    </div>
                  )}

                  {filtered.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-foreground-muted">
                      No employees match your search
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── VIEW MODE ── */
        <div className="space-y-4">
          {managers.map((manager) => {
            const isExpanded = expandedManagers.has(manager.id)
            const filteredReports = manager.reports.filter((m) => matchesSearch(m, search))
            const managerMatches = matchesSearch(manager, search)

            if (search && !managerMatches && filteredReports.length === 0) return null

            const showReports = search ? true : isExpanded

            return (
              <div key={manager.id} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                {/* Manager header */}
                <button
                  onClick={() => toggleManager(manager.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-card-hover"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tierColors[manager.tier]?.avatar ?? defaultTierColor.avatar} text-sm font-bold text-white shadow-sm`}>
                    {manager.firstName[0]}{manager.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {manager.firstName} {manager.lastName}
                      </h3>
                      <TierBadge tier={manager.tier} />
                    </div>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {manager.jobTitle || TIER_LABELS[manager.tier as keyof typeof TIER_LABELS]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden items-center gap-1.5 rounded-full bg-background-secondary px-3 py-1 sm:flex">
                      <Users className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-foreground-secondary">{manager.reports.length}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-foreground-muted" /> : <ChevronRight className="h-4 w-4 text-foreground-muted" />}
                  </div>
                </button>

                {/* Team members */}
                {showReports && (
                  <div className="border-t border-border bg-background/50 p-3">
                    {(search ? filteredReports : manager.reports).length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-foreground-muted">
                        {search ? "No matching team members" : "No direct reports"}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(search ? filteredReports : manager.reports)
                          .sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0))
                          .map((member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              compact
                              onClick={() => router.push(`/manager/members/${member.id}`)}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Unassigned members */}
          {unassigned.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground-muted/10">
                  <UserCircle className="h-5 w-5 text-foreground-muted" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Unassigned Members</h3>
                  <p className="text-xs text-foreground-muted">Not assigned to any manager</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1">
                  <span className="text-xs font-medium text-amber-500">{unassigned.filter((m) => matchesSearch(m, search)).length}</span>
                </div>
              </div>
              <div className="p-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.filter((m) => matchesSearch(m, search)).map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    compact
                    onClick={() => router.push(`/manager/members/${member.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {managers.length === 0 && unassigned.length === 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center text-foreground-muted">
              No team data found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Components ───

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" strokeWidth={1.5} />
      <input
        type="text"
        placeholder="Search by name, email, title, or ID..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-foreground-muted outline-none transition-colors focus:border-blue-500"
      />
    </div>
  )
}

function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "xs" }) {
  const colors = tierColors[tier] ?? defaultTierColor
  const label = TIER_LABELS[tier as keyof typeof TIER_LABELS] || tier
  if (size === "xs") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
        <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
        {label}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  )
}

function EmployeeCheckRow({
  employee,
  isAssigned,
  isPending,
  onToggle,
}: {
  employee: Member
  isAssigned: boolean
  isPending: boolean
  onToggle: () => void
}) {
  const colors = tierColors[employee.tier] ?? defaultTierColor

  return (
    <button
      onClick={onToggle}
      disabled={isPending}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 hover:bg-card-hover disabled:opacity-60 ${
        isAssigned ? "bg-emerald-500/[0.03]" : ""
      }`}
    >
      {/* Checkbox */}
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
        isAssigned
          ? "border-emerald-500 bg-emerald-500"
          : "border-border-hover bg-transparent"
      }`}>
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-white" />
        ) : isAssigned ? (
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        ) : null}
      </div>

      {/* Mini avatar */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${colors.avatar} text-[10px] font-bold text-white`}>
        {employee.firstName[0]}{employee.lastName[0]}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {employee.firstName} {employee.lastName}
          </p>
          <TierBadge tier={employee.tier} size="xs" />
        </div>
        <p className="truncate text-xs text-foreground-muted">
          {employee.jobTitle || TIER_LABELS[employee.tier as keyof typeof TIER_LABELS] || employee.tier}
        </p>
      </div>

      {/* Current assignment indicator */}
      {isAssigned ? (
        <span className="shrink-0 text-[10px] font-medium text-emerald-500">Assigned</span>
      ) : employee.managerId ? (
        <span className="shrink-0 text-[10px] font-medium text-foreground-muted">Other team</span>
      ) : (
        <span className="shrink-0 text-[10px] font-medium text-amber-500">Unassigned</span>
      )}
    </button>
  )
}

function MemberCard({
  member,
  compact,
  onClick,
}: {
  member: Member
  compact?: boolean
  onClick: () => void
}) {
  const tierLabel = TIER_LABELS[member.tier as keyof typeof TIER_LABELS] || member.tier
  const colors = tierColors[member.tier] ?? defaultTierColor

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border border-card-border bg-card-bg transition-all hover:border-border-hover hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.avatar} text-xs font-bold text-white shadow-sm`}>
          {member.firstName[0]}{member.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-blue-500 transition-colors">
              {member.firstName} {member.lastName}
            </p>
            {!member.isActive && (
              <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-foreground-muted">
            {member.jobTitle || tierLabel}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <TierBadge tier={member.tier} />
            {member.employeeId && (
              <span className="rounded-md bg-background-secondary px-2 py-0.5 text-[11px] font-mono text-foreground-muted">
                #{member.employeeId}
              </span>
            )}
          </div>

          {!compact && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                <Mail className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.5} />
                <span className="truncate">{member.email}</span>
              </div>
              {member.nationality && (
                <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                  <Globe className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.5} />
                  <span>{member.nationality}</span>
                </div>
              )}
              {member.graduationYear && (
                <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                  <GraduationCap className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.5} />
                  <span>Class of {member.graduationYear}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
