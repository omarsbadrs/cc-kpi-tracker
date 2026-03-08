"use client"

import { useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, TIER_SHORT } from "@/lib/constants"
import {
  Search, Network, Mail, UserCircle, Download, Users,
  ChevronDown, ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { useTeamReportPdf } from "@/hooks/useTeamReportPdf"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

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

interface TeamData {
  managers?: (Member & { reports: Member[] })[]
  unassigned?: Member[]
  allUsers?: Member[]
}

interface TreeNode {
  member: Member
  children: TreeNode[]
}

// ─────────────────────────────────────
// Tier colours
// ─────────────────────────────────────

const tierColors: Record<string, { bg: string; text: string; dot: string; avatar: string; border: string }> = {
  SECTION_HEAD: { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-500", avatar: "from-violet-500 to-purple-600", border: "border-violet-500/30" },
  TEAM_LEAD:    { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-500",   avatar: "from-blue-500 to-indigo-600",  border: "border-blue-500/30"   },
  SENIOR:       { bg: "bg-emerald-500/10",text: "text-emerald-400",dot: "bg-emerald-500", avatar: "from-emerald-500 to-teal-600", border: "border-emerald-500/30" },
  ENGINEER:     { bg: "bg-sky-500/10",    text: "text-sky-400",    dot: "bg-sky-500",     avatar: "from-sky-500 to-blue-600",     border: "border-sky-500/30"     },
  JUNIOR:       { bg: "bg-amber-500/10",  text: "text-amber-400",  dot: "bg-amber-500",   avatar: "from-amber-500 to-orange-600", border: "border-amber-500/30"   },
}
const defaultColor: { bg: string; text: string; dot: string; avatar: string; border: string } = {
  bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-500",
  avatar: "from-sky-500 to-blue-600", border: "border-sky-500/30",
}

// Tier display order (seniority)
const TIER_ORDER = ["SECTION_HEAD", "TEAM_LEAD", "SENIOR", "ENGINEER", "JUNIOR"] as const

// ─────────────────────────────────────
// Tree builder
// ─────────────────────────────────────

function buildTree(members: Member[]): TreeNode[] {
  const map = new Map(members.map(m => [m.id, m]))
  const roots: Member[] = []

  for (const m of members) {
    if (!m.managerId || !map.has(m.managerId)) roots.push(m)
  }

  function buildNode(m: Member): TreeNode {
    return {
      member: m,
      children: members.filter(r => r.managerId === m.id).map(buildNode),
    }
  }

  return roots.map(buildNode)
}

// ─────────────────────────────────────
// Team Analytics Section
// ─────────────────────────────────────

function TeamAnalyticsSection({
  members,
  isAdmin,
  managerName,
  kpiCountByUser,
}: {
  members: Member[]
  isAdmin: boolean
  managerName: string
  kpiCountByUser: Map<string, number>
}) {
  const [dirExpanded, setDirExpanded] = useState(true)
  const [sortField, setSortField] = useState<"name" | "tier" | "email">("tier")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Exclude admins from staff analytics
  const staff = useMemo(() => members.filter(m => m.role !== "ADMIN"), [members])

  // Tier breakdown
  const tierBreakdown = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      count: staff.filter(m => m.tier === tier).length,
      members: staff.filter(m => m.tier === tier),
    })).filter(t => t.count > 0)
  }, [staff])

  // Sorted directory
  const sorted = useMemo(() => {
    const copy = [...staff]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortField === "name") cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      else if (sortField === "email") cmp = a.email.localeCompare(b.email)
      else if (sortField === "tier") cmp = TIER_ORDER.indexOf(a.tier as typeof TIER_ORDER[number]) - TIER_ORDER.indexOf(b.tier as typeof TIER_ORDER[number])
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [staff, sortField, sortDir])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-blue-400" />
      : <ChevronDown className="h-3 w-3 text-blue-400" />
  }

  return (
    <div className="space-y-4">
      {/* ── Summary banner ── */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Headcount */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {isAdmin ? "Total Headcount" : "Team Under Your Authority"}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-foreground">{staff.length}</p>
            {!isAdmin && (
              <p className="mt-0.5 text-sm text-foreground-muted">{managerName}</p>
            )}
          </div>

          {/* Tier breakdown chips */}
          <div className="flex flex-wrap gap-2">
            {tierBreakdown.map(({ tier, count }) => {
              const c = tierColors[tier] ?? defaultColor
              return (
                <div
                  key={tier}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${c.bg} ${c.border}`}
                >
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <div>
                    <p className={`text-xs font-semibold ${c.text}`}>{TIER_SHORT[tier] ?? tier}</p>
                    <p className={`text-xl font-bold tabular-nums leading-tight ${c.text}`}>{count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Member Directory Table ── */}
      <div className="glass-card overflow-hidden">
        {/* Table header — collapsible */}
        <button
          onClick={() => setDirExpanded(e => !e)}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-card-hover transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-foreground-muted" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-foreground">
              Member Directory
            </span>
            <span className="rounded-full bg-background-secondary px-2 py-0.5 text-xs font-medium text-foreground-muted">
              {staff.length}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-foreground-muted transition-transform duration-200 ${dirExpanded ? "rotate-180" : ""}`}
            strokeWidth={1.5}
          />
        </button>

        {dirExpanded && (
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary/50">
                  <th className="w-8 px-4 py-2.5 text-xs font-medium text-foreground-muted">#</th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors"
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("email")}
                      className="flex items-center gap-1 text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors"
                    >
                      Email <SortIcon field="email" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("tier")}
                      className="flex items-center gap-1 text-xs font-medium text-foreground-secondary hover:text-foreground transition-colors"
                    >
                      Tier <SortIcon field="tier" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Job Title</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Employee ID</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary text-right">Assigned KPIs</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => {
                  const c = tierColors[m.tier] ?? defaultColor
                  return (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3 text-xs text-foreground-muted/50 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${c.avatar} text-[11px] font-bold text-white`}>
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <Link
                            href={`/manager/members/${m.id}`}
                            className="text-sm font-medium text-foreground hover:text-blue-400 transition-colors"
                          >
                            {m.firstName} {m.lastName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-foreground-muted/50" strokeWidth={1.5} />
                          <span className="font-mono text-xs">{m.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.bg} ${c.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                          {TIER_SHORT[m.tier] ?? m.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground-muted">
                        {m.jobTitle || TIER_LABELS[m.tier as keyof typeof TIER_LABELS] || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground-muted">
                        {m.employeeId ? `#${m.employeeId}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const cnt = kpiCountByUser.get(m.id)
                          if (cnt === undefined) return <span className="text-xs text-foreground-muted/40">—</span>
                          return (
                            <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-blue-400">
                              {cnt}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Page
// ─────────────────────────────────────

export default function TeamMembersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === "ADMIN"
  const [search, setSearch] = useState("")
  const { exportReport, isExporting } = useTeamReportPdf()

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team", "hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/team")
      if (!res.ok) throw new Error("Failed to fetch team")
      return (await res.json()).data
    },
  })

  const { data: assignmentsData } = useQuery<{ data: { userId: string }[] }>({
    queryKey: ["team", "assignments", "kpi-counts"],
    queryFn: async () => {
      const res = await fetch("/api/kpis/assignments?myTeam=true&pageSize=5000")
      if (!res.ok) throw new Error("Failed to fetch assignments")
      return res.json()
    },
    enabled: !isLoading,
  })

  if (isLoading) return <LoadingSpinner />

  const allUsers = data?.allUsers || []
  const unassigned = data?.unassigned || []
  const searchLower = search.toLowerCase()

  // The manager's own entry (for MANAGER role)
  const managerEntry = !isAdmin
    ? allUsers.find(u => u.id === session?.user?.id)
    : null
  const managerName = managerEntry
    ? `${managerEntry.firstName} ${managerEntry.lastName}`
    : ""

  // All team members excluding the current manager (for count/analytics)
  const teamMembers = isAdmin ? allUsers : allUsers.filter(u => u.id !== session?.user?.id)

  // Build userId → assigned KPI count map
  const kpiCountByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assignmentsData?.data ?? []) {
      map.set(a.userId, (map.get(a.userId) ?? 0) + 1)
    }
    return map
  }, [assignmentsData])

  function nodeMatchesSearch(node: TreeNode): boolean {
    if (!search) return true
    if (matchesSearch(node.member, search)) return true
    return node.children.some(nodeMatchesSearch)
  }

  const roots = buildTree(allUsers)
  const teamCount = teamMembers.length

  return (
    <div className="space-y-4">
      <PageHeader
        title={isAdmin ? "Team Directory" : "My Team"}
        description={isAdmin ? `${allUsers.length} members` : `${teamCount} member${teamCount !== 1 ? "s" : ""} in your hierarchy`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportReport({
                analyticsMembers: teamMembers,
                orgChartMembers: allUsers,
                managerName,
                isAdmin,
              })}
              disabled={isExporting || allUsers.length === 0}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Generating…" : "Export PDF"}
            </button>
            {isAdmin && (
              <Link
                href="/admin/org-chart"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-card-hover hover:text-foreground"
              >
                <Network className="h-4 w-4" />
                Edit Org Chart
              </Link>
            )}
          </div>
        }
      />

      {/* Search (excluded from PDF) */}
      <SearchBar value={search} onChange={setSearch} />

      <div className="space-y-6">

        {/* Analytics section */}
        {allUsers.length > 0 && (
          <TeamAnalyticsSection
            members={teamMembers}
            isAdmin={isAdmin}
            managerName={managerName}
            kpiCountByUser={kpiCountByUser}
          />
        )}

        {/* Org chart tree */}
        <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg p-8">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Network className="h-4 w-4 text-foreground-muted" strokeWidth={1.5} />
            Reporting Structure
          </div>
          {roots.length === 0 ? (
            <div className="py-12 text-center text-foreground-muted">
              <UserCircle className="mx-auto mb-3 h-10 w-10 text-foreground-muted/30" />
              {isAdmin ? (
                <>
                  No team structure found. Build it in the{" "}
                  <Link href="/admin/org-chart" className="text-blue-400 hover:underline">Org Chart</Link>.
                </>
              ) : (
                "No team members found under your hierarchy."
              )}
            </div>
          ) : (
            <div className="flex min-w-max items-start justify-center gap-8">
              {roots.filter(nodeMatchesSearch).map(root => (
                <TreeNodeView
                  key={root.member.id}
                  node={root}
                  searchLower={searchLower}
                  onClickMember={(id) => router.push(`/manager/members/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Unassigned — admin only */}
        {unassigned.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground-secondary">
              <UserCircle className="h-4 w-4 text-amber-400" />
              <span>Unassigned ({unassigned.filter(m => matchesSearch(m, search)).length})</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {unassigned.filter(m => matchesSearch(m, search)).map(m => (
                <MemberCard key={m.id} member={m} compact onClick={() => router.push(`/manager/members/${m.id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Tree rendering
// ─────────────────────────────────────

function TreeNodeView({
  node,
  searchLower,
  onClickMember,
}: {
  node: TreeNode
  searchLower: string
  onClickMember: (id: string) => void
}) {
  const colors = tierColors[node.member.tier] ?? defaultColor
  const isHighlighted = searchLower && matchesSearch(node.member, searchLower)
  const visibleChildren = searchLower
    ? node.children.filter(c => nodeMatchesSearchDeep(c, searchLower))
    : node.children

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <button
        onClick={() => onClickMember(node.member.id)}
        className={`group w-52 rounded-xl border bg-card-bg p-3 text-left shadow-sm transition-all hover:shadow-md hover:shadow-black/10 ${
          isHighlighted
            ? "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30"
            : colors.border + " hover:border-opacity-60"
        }`}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.avatar} text-xs font-bold text-white shadow-sm`}>
            {node.member.firstName[0]}{node.member.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">
              {node.member.firstName} {node.member.lastName}
            </p>
            {!node.member.isActive && (
              <span className="text-[10px] font-medium text-red-400">Inactive</span>
            )}
          </div>
        </div>

        {/* Tier badge */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
            <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
            {TIER_SHORT[node.member.tier] ?? node.member.tier}
          </span>
          {node.children.length > 0 && (
            <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
              {node.children.length} report{node.children.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Job title */}
        {node.member.jobTitle && (
          <p className="mt-1.5 truncate text-[11px] text-foreground-muted">{node.member.jobTitle}</p>
        )}

        {/* Email */}
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground-muted/70">
          <Mail className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{node.member.email}</span>
        </div>
      </button>

      {/* Children */}
      {visibleChildren.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Line down from card */}
          <div className="h-6 w-px bg-border" />

          {/* Horizontal connector row */}
          <div className="relative flex items-start gap-6">
            {visibleChildren.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{ left: "calc(104px)", right: "calc(104px)" }}
              />
            )}
            {visibleChildren.map(child => (
              <div key={child.member.id} className="flex flex-col items-center">
                <div className="h-6 w-px bg-border" />
                <TreeNodeView
                  node={child}
                  searchLower={searchLower}
                  onClickMember={onClickMember}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────
// Helpers & sub-components
// ─────────────────────────────────────

function matchesSearch(m: Member, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    m.firstName.toLowerCase().includes(lower) ||
    m.lastName.toLowerCase().includes(lower) ||
    m.email.toLowerCase().includes(lower) ||
    (m.jobTitle?.toLowerCase().includes(lower) ?? false) ||
    (m.employeeId?.toLowerCase().includes(lower) ?? false)
  )
}

function nodeMatchesSearchDeep(node: TreeNode, q: string): boolean {
  if (matchesSearch(node.member, q)) return true
  return node.children.some(c => nodeMatchesSearchDeep(c, q))
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" strokeWidth={1.5} />
      <input
        type="text"
        placeholder="Search by name, email, title, or ID..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-foreground-muted outline-none transition-colors focus:border-blue-500"
      />
    </div>
  )
}

function MemberCard({ member, compact, onClick }: { member: Member; compact?: boolean; onClick: () => void }) {
  const colors = tierColors[member.tier] ?? defaultColor
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border bg-card-bg transition-all hover:shadow-md hover:shadow-black/10 ${colors.border} ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.avatar} text-xs font-bold text-white`}>
          {member.firstName[0]}{member.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">
            {member.firstName} {member.lastName}
          </p>
          <p className="truncate text-xs text-foreground-muted">{member.jobTitle || TIER_LABELS[member.tier as keyof typeof TIER_LABELS]}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
          <span className={`h-1 w-1 rounded-full ${colors.dot}`} />
          {TIER_SHORT[member.tier] ?? member.tier}
        </span>
      </div>
    </div>
  )
}
