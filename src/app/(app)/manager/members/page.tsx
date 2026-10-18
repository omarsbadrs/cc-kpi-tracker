"use client"

import { useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Mail, Network, Users } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { StatGrid, StatTile } from "@/components/ui/StatGrid"
import { SearchInput } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_LABELS, TIER_SHORT } from "@/lib/constants"
import { useTeamReportPdf } from "@/hooks/useTeamReportPdf"
import { useActivePeriod } from "@/hooks/usePeriods"
import "@/styles/views/org-chart.css"

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

interface Assignment {
  userId: string
  actuals: { status: string }[]
}

interface TreeNode {
  member: Member
  children: TreeNode[]
}

// Tier display order (seniority)
const TIER_ORDER = ["SECTION_HEAD", "TEAM_LEAD", "SENIOR", "ENGINEER", "JUNIOR"] as const

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function jobTitleOf(m: Member): string {
  return m.jobTitle || TIER_LABELS[m.tier as keyof typeof TIER_LABELS] || ""
}

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
// Team analytics
// ─────────────────────────────────────

/** A count in a table cell; a missing count reads as a dash, not a zero. */
function CountCell({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return (
      <td className="num muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">None</span>
      </td>
    )
  }
  return <td className="num">{value}</td>
}

type SortField = "name" | "tier" | "email"

function TeamAnalyticsSection({
  members,
  isAdmin,
  managerName,
  kpiAssignedByUser,
  kpiActualsByUser,
  kpiApprovedByUser,
}: {
  members: Member[]
  isAdmin: boolean
  managerName: string
  kpiAssignedByUser: Map<string, number>
  kpiActualsByUser: Map<string, number>
  kpiApprovedByUser: Map<string, number>
}) {
  const [dirExpanded, setDirExpanded] = useState(true)
  const [sortField, setSortField] = useState<SortField>("tier")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Exclude admins from staff analytics
  const staff = useMemo(() => members.filter(m => m.role !== "ADMIN"), [members])

  // KPI totals across all staff
  const totalAssigned = useMemo(() =>
    staff.reduce((s, m) => s + (kpiAssignedByUser.get(m.id) ?? 0), 0),
    [staff, kpiAssignedByUser]
  )
  const totalActuals = useMemo(() =>
    staff.reduce((s, m) => s + (kpiActualsByUser.get(m.id) ?? 0), 0),
    [staff, kpiActualsByUser]
  )
  const totalApproved = useMemo(() =>
    staff.reduce((s, m) => s + (kpiApprovedByUser.get(m.id) ?? 0), 0),
    [staff, kpiApprovedByUser]
  )

  // Tier breakdown with per-tier KPI totals
  const tierBreakdown = useMemo(() => {
    return TIER_ORDER.map((tier) => {
      const tierMembers = staff.filter(m => m.tier === tier)
      return {
        tier,
        count: tierMembers.length,
        members: tierMembers,
        assigned: tierMembers.reduce((s, m) => s + (kpiAssignedByUser.get(m.id) ?? 0), 0),
        actuals:  tierMembers.reduce((s, m) => s + (kpiActualsByUser.get(m.id)  ?? 0), 0),
        approved: tierMembers.reduce((s, m) => s + (kpiApprovedByUser.get(m.id) ?? 0), 0),
      }
    }).filter(t => t.count > 0)
  }, [staff, kpiAssignedByUser, kpiActualsByUser, kpiApprovedByUser])

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

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const ariaSort = (field: SortField): "ascending" | "descending" | "none" =>
    sortField !== field ? "none" : sortDir === "asc" ? "ascending" : "descending"

  const SortHead = ({ field, label }: { field: SortField; label: string }) => {
    const Icon = sortField !== field ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown
    return (
      <th scope="col" aria-sort={ariaSort(field)}>
        <button type="button" className="sort-btn" onClick={() => toggleSort(field)}>
          {label}
          <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </th>
    )
  }

  return (
    <>
      {/* Summary strip */}
      <StatGrid>
        <StatTile
          label={isAdmin ? "Total headcount" : "Team size"}
          value={staff.length}
          sub={!isAdmin && managerName ? managerName : undefined}
        />
        <StatTile label="Assigned KPIs" value={totalAssigned} />
        <StatTile label="KPI actuals" value={totalActuals} />
        <StatTile label="Approved" value={totalApproved} />
      </StatGrid>

      {/* By tier */}
      {tierBreakdown.length > 0 && (
        <section className="card list-card">
          <div className="card-head">
            <h2 className="card-title">By tier</h2>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="KPI counts by tier">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col" className="num">Members</th>
                  <th scope="col" className="num">Assigned</th>
                  <th scope="col" className="num">Actuals</th>
                  <th scope="col" className="num">Approved</th>
                </tr>
              </thead>
              <tbody>
                {tierBreakdown.map(({ tier, count, assigned, actuals, approved }) => (
                  <tr key={tier}>
                    <th scope="row" className="nowrap" style={{ fontWeight: 550 }}>
                      {TIER_SHORT[tier] ?? tier}
                    </th>
                    <td className="num">{count}</td>
                    <td className="num">{assigned}</td>
                    <td className="num">{actuals}</td>
                    <td className="num">{approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Member directory */}
      <section className="card list-card">
        <div className="card-head">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="card-title">Member directory</h2>
            <TagPill>{staff.length}</TagPill>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setDirExpanded(e => !e)}
            aria-expanded={dirExpanded}
            aria-controls="member-directory"
            aria-label={dirExpanded ? "Hide member directory" : "Show member directory"}
            title={dirExpanded ? "Hide member directory" : "Show member directory"}
          >
            {dirExpanded
              ? <ChevronUp size={17} aria-hidden="true" />
              : <ChevronDown size={17} aria-hidden="true" />}
          </button>
        </div>

        {dirExpanded && (
          <div
            id="member-directory"
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Member directory"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="num">#</th>
                  <SortHead field="name" label="Name" />
                  <SortHead field="email" label="Email" />
                  <SortHead field="tier" label="Tier" />
                  <th scope="col">Job title</th>
                  <th scope="col">Employee ID</th>
                  <th scope="col" className="num">Assigned KPIs</th>
                  <th scope="col" className="num">KPI actuals</th>
                  <th scope="col" className="num">Approved</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => (
                  <tr key={m.id} className="hover">
                    <td className="num muted">{i + 1}</td>
                    <td className="nowrap">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar firstName={m.firstName} lastName={m.lastName} avatarUrl={m.avatarUrl} />
                        <Link href={`/manager/members/${m.id}`} style={{ fontWeight: 550 }}>
                          {m.firstName} {m.lastName}
                        </Link>
                      </div>
                    </td>
                    <td className="muted clip">{m.email}</td>
                    <td><TagPill>{TIER_SHORT[m.tier] ?? m.tier}</TagPill></td>
                    <td className="muted clip">{jobTitleOf(m) || "—"}</td>
                    <td className="muted nowrap">
                      {m.employeeId ? <span className="kpi-code">#{m.employeeId}</span> : "—"}
                    </td>
                    <CountCell value={kpiAssignedByUser.get(m.id)} />
                    <CountCell value={kpiActualsByUser.get(m.id)} />
                    <CountCell value={kpiApprovedByUser.get(m.id)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

// ─────────────────────────────────────
// Page
// ─────────────────────────────────────

export default function TeamMembersPage() {
  const { data: session } = useSession()
  const toast = useToast()
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

  const { data: activePeriod } = useActivePeriod()

  const { data: assignmentsData } = useQuery<{ data: Assignment[] }>({
    queryKey: ["team", "assignments", "kpi-counts", activePeriod?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ myTeam: "true", pageSize: "5000" })
      if (activePeriod?.id) params.set("evalPeriodId", activePeriod.id)
      const res = await fetch(`/api/kpis/assignments?${params}`)
      if (!res.ok) throw new Error("Failed to fetch assignments")
      return res.json()
    },
    enabled: !isLoading,
  })

  // Build three per-user maps from the same assignments query (must be before early return)
  const { kpiAssignedByUser, kpiActualsByUser, kpiApprovedByUser } = useMemo(() => {
    const assigned = new Map<string, number>()
    const actuals  = new Map<string, number>()
    const approved = new Map<string, number>()
    for (const a of assignmentsData?.data ?? []) {
      assigned.set(a.userId, (assigned.get(a.userId) ?? 0) + 1)
      if (a.actuals.length > 0) {
        actuals.set(a.userId, (actuals.get(a.userId) ?? 0) + 1)
        if (a.actuals[0]!.status === "APPROVED") {
          approved.set(a.userId, (approved.get(a.userId) ?? 0) + 1)
        }
      }
    }
    return { kpiAssignedByUser: assigned, kpiActualsByUser: actuals, kpiApprovedByUser: approved }
  }, [assignmentsData])

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
  const staffCount = teamMembers.filter(u => u.role !== "ADMIN").length

  function nodeMatchesSearch(node: TreeNode): boolean {
    if (!search) return true
    if (matchesSearch(node.member, search)) return true
    return node.children.some(nodeMatchesSearch)
  }

  const roots = buildTree(allUsers)
  const visibleRoots = roots.filter(nodeMatchesSearch)
  const teamCount = teamMembers.length
  const visibleUnassigned = unassigned.filter(m => matchesSearch(m, search))

  const subFacts = [
    isAdmin ? plural(staffCount, "member") : `${plural(teamCount, "member")} in your hierarchy`,
    activePeriod?.name,
  ].filter(Boolean).join(" · ")

  const handleExport = async () => {
    if (isExporting) return
    try {
      await exportReport({
        analyticsMembers: teamMembers,
        orgChartMembers: allUsers,
        managerName,
        isAdmin,
      })
    } catch {
      toast("Could not export the PDF. Try again", { icon: "alert" })
    }
  }

  return (
    <>
      <PageHead
        title={isAdmin ? "Team directory" : "My team"}
        sub={subFacts}
        actions={
          <>
            {isAdmin && (
              <Link href="/admin/org-chart" className="btn">
                <Network size={16} strokeWidth={1.7} aria-hidden="true" />
                Edit org chart
              </Link>
            )}
            <button
              type="button"
              className="btn"
              onClick={handleExport}
              disabled={allUsers.length === 0}
              title={allUsers.length === 0 ? "Nobody to export yet" : undefined}
              aria-disabled={isExporting ? "true" : undefined}
            >
              <Download size={16} strokeWidth={1.7} aria-hidden="true" />
              {isExporting ? "Generating…" : "Export PDF"}
            </button>
          </>
        }
      />

      {/* Analytics section */}
      {allUsers.length > 0 && (
        <TeamAnalyticsSection
          members={teamMembers}
          isAdmin={isAdmin}
          managerName={managerName}
          kpiAssignedByUser={kpiAssignedByUser}
          kpiActualsByUser={kpiActualsByUser}
          kpiApprovedByUser={kpiApprovedByUser}
        />
      )}

      {/* Reporting structure */}
      <h2 className="section-head">Reporting structure</h2>

      {/* Search filters the tree and the unassigned list below it */}
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, title or ID"
          aria-label="Search the reporting structure"
        />
      </div>

      <section className="card list-card">
        {roots.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No reporting lines yet"
            description={
              isAdmin
                ? "Set who reports to whom in the org chart."
                : "Nobody reports to you in the hierarchy yet."
            }
            action={
              isAdmin ? (
                <Link href="/admin/org-chart" className="btn">Open org chart</Link>
              ) : undefined
            }
          />
        ) : visibleRoots.length === 0 ? (
          <EmptyState
            title="No matches"
            description="Nobody in the reporting structure matches that search."
          />
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Reporting structure">
            <div className="org-tree">
              <ul>
                {visibleRoots.map(root => (
                  <TreeNodeView key={root.member.id} node={root} searchLower={searchLower} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Unassigned — admin only */}
      {unassigned.length > 0 && (
        <>
          <div className="section-head flex items-center gap-2">
            <h2>Unassigned</h2>
            <TagPill>{visibleUnassigned.length}</TagPill>
          </div>
          {visibleUnassigned.length === 0 ? (
            <div className="card-list">
              <EmptyState title="No matches" description="Nobody unassigned matches that search." />
            </div>
          ) : (
            <div className="client-grid">
              {visibleUnassigned.map(m => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────
// Tree rendering
// ─────────────────────────────────────

function TreeNodeView({
  node,
  searchLower,
}: {
  node: TreeNode
  searchLower: string
}) {
  const m = node.member
  const isHighlighted = searchLower && matchesSearch(m, searchLower)
  const visibleChildren = searchLower
    ? node.children.filter(c => nodeMatchesSearchDeep(c, searchLower))
    : node.children

  return (
    <li>
      <Link href={`/manager/members/${m.id}`} className={`org-node${isHighlighted ? " match" : ""}`}>
        <span className="org-node-head">
          <UserAvatar firstName={m.firstName} lastName={m.lastName} avatarUrl={m.avatarUrl} />
          <span className="org-node-text">
            <span className="org-node-name">{m.firstName} {m.lastName}</span>
            {m.jobTitle && <span className="org-node-sub">{m.jobTitle}</span>}
          </span>
        </span>

        <span className="org-node-tags">
          <TagPill>{TIER_SHORT[m.tier] ?? m.tier}</TagPill>
          {node.children.length > 0 && (
            <span className="org-node-count">{plural(node.children.length, "report")}</span>
          )}
          {!m.isActive && <StatusChip tone="bad" small>Inactive</StatusChip>}
        </span>

        <span className="org-node-meta">
          <Mail size={13} strokeWidth={1.6} aria-hidden="true" />
          <span>{m.email}</span>
        </span>
      </Link>

      {visibleChildren.length > 0 && (
        <ul>
          {visibleChildren.map(child => (
            <TreeNodeView key={child.member.id} node={child} searchLower={searchLower} />
          ))}
        </ul>
      )}
    </li>
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

function MemberCard({ member }: { member: Member }) {
  return (
    <Link href={`/manager/members/${member.id}`} className="card client-card">
      <div className="client-card-head">
        <UserAvatar firstName={member.firstName} lastName={member.lastName} avatarUrl={member.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="client-name">{member.firstName} {member.lastName}</div>
          <div className="client-sub">{jobTitleOf(member)}</div>
        </div>
      </div>
      <div className="org-node-tags">
        <TagPill>{TIER_SHORT[member.tier] ?? member.tier}</TagPill>
      </div>
    </Link>
  )
}
