"use client"

import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from "react"
import { useSession } from "next-auth/react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMyAssignments, useAllAssignments } from "@/hooks/useKpis"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { StatGrid, StatTile } from "@/components/ui/StatGrid"
import { Field, SelectWrap, SearchInput } from "@/components/ui/Field"
import { ActualStatusChip, TagPill } from "@/components/ui/StatusChip"
import { ScoreBadge, PillarTag, Meter } from "@/components/ui/KpiMarks"
import { useToast } from "@/components/ui/Toast"
import { UserAvatar } from "@/components/layout/UserMenu"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Upload, ChevronDown, ChevronRight, AlertTriangle, Check, ClipboardList, SearchX } from "lucide-react"
import { PILLARS, PILLAR_CODES, ROLE_LABELS, TIER_SHORT } from "@/lib/constants"

interface Period {
  id: string
  name: string
  isActive: boolean
  isClosed: boolean
}

interface AssignmentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  tier: string
  role: string
}

interface AssignmentActual {
  actualValue: number | null
  binaryValue: boolean | null
  score: number | null
  status: string
  reviewComment?: string | null
}

interface AssignmentRow {
  id: string
  user?: AssignmentUser
  kpiDefinition: {
    code: string
    name: string
    direction: string
    unit: string
    pillar: { code: string; name: string }
    targets?: Array<{ tier: string; targetValue: number }>
  }
  targetOverride: number | null
  actuals: AssignmentActual[]
}

// ─── Formatting ───

function formatTarget(target: number | null | undefined, direction: string, unit: string): string {
  if (target === null || target === undefined) return "—"
  if (direction === "BINARY") return "Pass"
  return `${target}${unit === "PERCENTAGE" ? "%" : ""}`
}

function formatActual(actual: AssignmentActual | undefined, unit: string): string {
  if (actual?.actualValue !== null && actual?.actualValue !== undefined) {
    return `${actual.actualValue}${unit === "PERCENTAGE" ? "%" : ""}`
  }
  if (actual?.binaryValue !== null && actual?.binaryValue !== undefined) {
    return actual.binaryValue ? "Pass" : "Fail"
  }
  return "—"
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function isSubmitted(a: AssignmentRow) {
  const s = a.actuals?.[0]?.status
  return s === "SUBMITTED" || s === "APPROVED"
}

function groupByPillar(rows: AssignmentRow[]) {
  const map = new Map<string, AssignmentRow[]>()
  for (const a of rows) {
    const pc = a.kpiDefinition.pillar.code
    if (!map.has(pc)) map.set(pc, [])
    map.get(pc)!.push(a)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function pillarName(code: string, fallback?: string) {
  return PILLARS[code as keyof typeof PILLARS]?.name ?? fallback ?? `Pillar ${code}`
}

/** Enter/Space on a focusable table row follows its link. */
function rowKeys(go: () => void) {
  return (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      go()
    }
  }
}

const PILLAR_OPTIONS = [
  { value: "", label: "All pillars" },
  ...PILLAR_CODES.map((c) => ({ value: c, label: `${c} · ${PILLARS[c].name}` })),
]

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "JUNIOR", label: "Junior" },
  { value: "ENGINEER", label: "Engineer" },
  { value: "SENIOR", label: "Senior" },
  { value: "TEAM_LEAD", label: "Team lead" },
  { value: "SECTION_HEAD", label: "Section head" },
]

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "USER", label: "User" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
]

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft or pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
]

// ─── Admin hub view ───
function AdminKpiHub({ periodId }: { periodId: string; periodName: string }) {
  const { data: allAssignments, isLoading } = useAllAssignments(periodId)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterTier, setFilterTier] = useState("")
  const [filterPillar, setFilterPillar] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const router = useRouter()

  // Group assignments by user
  const userGroups = useMemo(() => {
    if (!allAssignments) return []
    const map = new Map<string, { user: AssignmentUser; assignments: AssignmentRow[] }>()

    for (const a of allAssignments as AssignmentRow[]) {
      if (!a.user) continue
      const uid = a.user.id
      if (!map.has(uid)) {
        map.set(uid, { user: a.user, assignments: [] })
      }
      map.get(uid)!.assignments.push(a)
    }

    return Array.from(map.values()).sort((a, b) =>
      `${a.user.lastName} ${a.user.firstName}`.localeCompare(`${b.user.lastName} ${b.user.firstName}`)
    )
  }, [allAssignments])

  // Apply all filters
  const filteredGroups = useMemo(() => {
    let groups = userGroups

    if (filterRole) {
      groups = groups.filter((g) => g.user.role === filterRole)
    }

    if (filterTier) {
      groups = groups.filter((g) => g.user.tier === filterTier)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      groups = groups.filter((g) =>
        `${g.user.firstName} ${g.user.lastName} ${g.user.email}`.toLowerCase().includes(term)
      )
    }

    // Filter by pillar / status — filter the assignments within each group
    if (filterPillar || filterStatus) {
      groups = groups
        .map((g) => ({
          ...g,
          assignments: g.assignments.filter((a) => {
            if (filterPillar && a.kpiDefinition.pillar.code !== filterPillar) return false
            if (filterStatus) {
              const actualStatus = a.actuals?.[0]?.status || "DRAFT"
              if (filterStatus !== actualStatus) return false
            }
            return true
          }),
        }))
        .filter((g) => g.assignments.length > 0)
    }

    return groups
  }, [userGroups, searchTerm, filterRole, filterTier, filterPillar, filterStatus])

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const expandAll = () => setExpandedUsers(new Set(filteredGroups.map((g) => g.user.id)))
  const collapseAll = () => setExpandedUsers(new Set())

  const hasActiveFilters = !!(filterRole || filterTier || filterPillar || filterStatus || searchTerm.trim())
  const clearAllFilters = () => {
    setFilterRole("")
    setFilterTier("")
    setFilterPillar("")
    setFilterStatus("")
    setSearchTerm("")
  }

  if (isLoading) return <LoadingSpinner />

  // Summary stats (from filtered data)
  const allFiltered = filteredGroups.flatMap((g) => g.assignments)
  const totalUsers = filteredGroups.length
  const totalAssignments = allFiltered.length
  const totalSubmitted = allFiltered.filter(isSubmitted).length
  const totalPending = totalAssignments - totalSubmitted

  const filters = [
    { id: "hub-role", label: "Role", value: filterRole, setter: setFilterRole, options: ROLE_OPTIONS },
    { id: "hub-tier", label: "Tier", value: filterTier, setter: setFilterTier, options: TIER_OPTIONS },
    { id: "hub-pillar", label: "Pillar", value: filterPillar, setter: setFilterPillar, options: PILLAR_OPTIONS },
    { id: "hub-status", label: "Status", value: filterStatus, setter: setFilterStatus, options: STATUS_OPTIONS },
  ]

  return (
    <div>
      <StatGrid>
        <StatTile label="Users" value={totalUsers} />
        <StatTile label="KPIs" value={totalAssignments} sub="Assigned this period" />
        <StatTile label="Submitted" value={totalSubmitted} sub="Submitted or approved" />
        <StatTile label="Pending" value={totalPending} sub="Not yet submitted" />
      </StatGrid>

      <div className="toolbar">
        <div className="grow">
          <SearchInput
            placeholder="Search name or email"
            aria-label="Search users"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-ghost" onClick={expandAll}>
          Expand all
        </button>
        <button type="button" className="btn btn-ghost" onClick={collapseAll}>
          Collapse all
        </button>
      </div>

      <div className="field-grid">
        {filters.map(({ id, label, value, setter, options }) => (
          <Field key={id} label={label} htmlFor={id}>
            <SelectWrap>
              <select id={id} className="select" value={value} onChange={(e) => setter(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SelectWrap>
          </Field>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="age-filter" role="status">
          <span className="age-filter-text">
            Filtered · {plural(filteredGroups.length, "user")} of {userGroups.length} shown
          </span>
          <button type="button" className="btn btn-ghost btn-sm age-filter-clear" onClick={clearAllFilters}>
            Clear filters
          </button>
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="card-list">
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="No users match these filters"
              description="Try another search or clear the filters to see everyone."
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No KPI assignments for this period"
              description="Assignments made for this period appear here, grouped by person."
            />
          )}
        </div>
      ) : (
        <div>
          {filteredGroups.map(({ user, assignments }) => {
            const isExpanded = expandedUsers.has(user.id)
            const submitted = assignments.filter(isSubmitted).length
            const total = assignments.length
            const panelId = `hub-user-${user.id}`

            return (
              <section key={user.id} className="card list-card">
                <button
                  type="button"
                  className="doc-row"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleUser(user.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={17} className="muted" style={{ flex: "none" }} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={17} className="muted" style={{ flex: "none" }} aria-hidden="true" />
                  )}
                  <UserAvatar firstName={user.firstName} lastName={user.lastName} />
                  <span className="doc-row-main">
                    <span className="doc-row-title">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="doc-row-sub">
                      {TIER_SHORT[user.tier] ?? user.tier}
                      {user.role !== "USER" && ` · ${ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}`}
                      {` · ${user.email}`}
                    </span>
                  </span>
                  <span className="doc-row-end">
                    <span className="doc-row-amount">
                      {submitted} of {total}
                    </span>
                    <span style={{ width: 80 }}>
                      <Meter
                        value={submitted}
                        max={total || 1}
                        label={`${user.firstName} ${user.lastName}: ${submitted} of ${total} submitted`}
                      />
                    </span>
                  </span>
                </button>

                {isExpanded && (
                  <div
                    id={panelId}
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={`KPIs for ${user.firstName} ${user.lastName}`}
                    style={{ borderTop: "1px solid var(--hairline)" }}
                  >
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Code</th>
                          <th scope="col">KPI</th>
                          <th scope="col" className="num">Target</th>
                          <th scope="col" className="num">Actual</th>
                          <th scope="col">Score</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupByPillar(assignments).map(([pillarCode, pillarAssignments]) => {
                          const pillarSubmitted = pillarAssignments.filter(isSubmitted).length
                          return [
                            <tr key={`${pillarCode}-head`} className="group-row">
                              <th scope="colgroup" colSpan={6}>
                                <span className="row" style={{ gap: 8 }}>
                                  <PillarTag code={pillarCode} />
                                  <span className="grow">
                                    {pillarName(pillarCode, pillarAssignments[0]?.kpiDefinition.pillar.name)}
                                  </span>
                                  <span className="muted tabular" style={{ fontWeight: 450 }}>
                                    {pillarSubmitted} of {pillarAssignments.length} submitted
                                  </span>
                                </span>
                              </th>
                            </tr>,
                            ...pillarAssignments
                              .sort((a, b) => a.kpiDefinition.code.localeCompare(b.kpiDefinition.code))
                              .map((a) => {
                                const actual = a.actuals?.[0]
                                const tierTarget = a.kpiDefinition.targets?.find((t) => t.tier === user.tier)
                                const target = a.targetOverride ?? tierTarget?.targetValue ?? null
                                const go = () => router.push(`/kpis/${a.id}`)
                                return (
                                  <tr
                                    key={a.id}
                                    className="clickable"
                                    tabIndex={0}
                                    onClick={go}
                                    onKeyDown={rowKeys(go)}
                                  >
                                    <td><span className="kpi-code">{a.kpiDefinition.code}</span></td>
                                    <td className="clip" title={a.kpiDefinition.name}>{a.kpiDefinition.name}</td>
                                    <td className="num muted">
                                      {formatTarget(target, a.kpiDefinition.direction, a.kpiDefinition.unit)}
                                    </td>
                                    <td className="num">{formatActual(actual, a.kpiDefinition.unit)}</td>
                                    <td><ScoreBadge score={actual?.score ?? null} /></td>
                                    <td><ActualStatusChip status={actual?.status || "DRAFT"} /></td>
                                  </tr>
                                )
                              }),
                          ]
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── My KPIs (user view) ───
function MyKpiList({ assignments }: { assignments: AssignmentRow[] }) {
  const router = useRouter()

  if (assignments.length === 0) {
    return (
      <div className="card-list">
        <EmptyState
          icon={ClipboardList}
          title="No KPIs assigned for this period"
          description="KPIs assigned to you for this period appear here, grouped by pillar."
        />
      </div>
    )
  }

  return (
    <div>
      {groupByPillar(assignments).map(([pillarCode, rows]) => {
        const scored = rows.filter((r) => r.actuals?.[0]?.score !== null && r.actuals?.[0]?.score !== undefined)
        const avg = scored.length
          ? scored.reduce((sum, r) => sum + (r.actuals[0]?.score ?? 0), 0) / scored.length
          : null
        const approved = rows.filter((r) => r.actuals?.[0]?.status === "APPROVED").length
        const name = pillarName(pillarCode, rows[0]?.kpiDefinition.pillar.name)

        return (
          <section key={pillarCode} className="card list-card">
            <div className="card-head">
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <PillarTag code={pillarCode} />
                <h2 className="card-title" style={{ minWidth: 0 }}>{name}</h2>
                <TagPill>{plural(rows.length, "KPI")}</TagPill>
              </div>
              <span className="side-note tabular" style={{ flex: "none" }}>
                {approved} approved{avg !== null && ` · avg ${avg.toFixed(1)} of 5`}
              </span>
            </div>
            <div className="table-scroll" tabIndex={0} role="region" aria-label={`${name} KPIs`}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">KPI</th>
                    <th scope="col" className="num">Target</th>
                    <th scope="col" className="num">Actual</th>
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const actual = a.actuals?.[0]
                    const target = a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? null
                    const status = actual?.status ?? "DRAFT"
                    const go = () => router.push(`/kpis/${a.id}`)
                    return (
                      <tr key={a.id} className="clickable" tabIndex={0} onClick={go} onKeyDown={rowKeys(go)}>
                        <td><span className="kpi-code">{a.kpiDefinition.code}</span></td>
                        <td style={{ minWidth: 200 }}>
                          <div>{a.kpiDefinition.name}</div>
                          {status === "REJECTED" && actual?.reviewComment && (
                            <div className="side-note">Reviewer: {actual.reviewComment}</div>
                          )}
                        </td>
                        <td className="num muted">
                          {formatTarget(target, a.kpiDefinition.direction, a.kpiDefinition.unit)}
                        </td>
                        <td className="num">{formatActual(actual, a.kpiDefinition.unit)}</td>
                        <td><ScoreBadge score={actual?.score ?? null} /></td>
                        <td><ActualStatusChip status={status} /></td>
                        <td className="num">
                          <ChevronRight size={16} className="muted" aria-hidden="true" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─── Main page ───
export default function MyKpisPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: periods, isLoading: periodsLoading } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    errors: { row: number; field: string; message: string }[]
    skipped: number
    total: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (periods?.length && !selectedPeriodId) {
      const activeOpen = periods.find((p: Period) => p.isActive && !p.isClosed)
      setSelectedPeriodId(activeOpen?.id || periods[0]?.id || "")
    }
  }, [periods, selectedPeriodId])

  const selectedPeriod = periods?.find((p: Period) => p.id === selectedPeriodId)

  // Only fetch personal assignments for non-admin users
  const { data: assignments, isLoading } = useMyAssignments(
    !isAdmin ? (selectedPeriodId || undefined) : undefined
  )

  const handleExportTemplate = async () => {
    if (!selectedPeriodId) return
    const res = await fetch(`/api/kpis/actuals/export-template?evalPeriodId=${selectedPeriodId}`)
    if (!res.ok) {
      toast("Could not download the template. Try again", { icon: "alert" })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "kpi_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPeriodId) return

    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("evalPeriodId", selectedPeriodId)

    try {
      const res = await fetch("/api/kpis/actuals/bulk-import", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (res.ok) {
        setImportResult(json.data)
        queryClient.invalidateQueries({ queryKey: ["kpis"] })
        toast(`Imported ${plural(json.data?.imported ?? 0, "actual")}`)
      } else {
        setImportResult({ imported: 0, errors: [{ row: 0, field: "", message: json.error?.message || "Import failed" }], skipped: 0, total: 0 })
        toast("Could not import the file. See the details above the list", { icon: "alert" })
      }
    } catch {
      setImportResult({ imported: 0, errors: [{ row: 0, field: "", message: "Network error" }], skipped: 0, total: 0 })
      toast("Could not import. Check your connection", { icon: "alert" })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (periodsLoading || (!isAdmin && isLoading)) return <LoadingSpinner />

  const myRows = isAdmin ? [] : ((assignments || []) as AssignmentRow[])
  const counts = {
    assigned: myRows.length,
    submitted: myRows.filter((a) => a.actuals?.[0]?.status === "SUBMITTED").length,
    approved: myRows.filter((a) => a.actuals?.[0]?.status === "APPROVED").length,
    rejected: myRows.filter((a) => a.actuals?.[0]?.status === "REJECTED").length,
  }
  const doneCount = myRows.filter(isSubmitted).length

  const periodName = selectedPeriod?.name || "No period selected"
  const sub = isAdmin
    ? `Every person's KPI assignments · ${periodName}`
    : `${periodName} · ${plural(counts.assigned, "KPI")} · ${doneCount} submitted`

  const periodSelect = periods && periods.length > 1 && (
    <div style={{ minWidth: 200 }}>
      <label htmlFor="kpis-period" className="sr-only">Evaluation period</label>
      <SelectWrap>
        <select
          id="kpis-period"
          className="select"
          value={selectedPeriodId}
          onChange={(e) => { setSelectedPeriodId(e.target.value); setImportResult(null) }}
        >
          {(periods || []).map((p: Period) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isClosed ? "(closed)" : p.isActive ? "(active)" : ""}
            </option>
          ))}
        </select>
      </SelectWrap>
    </div>
  )

  return (
    <div>
      <PageHead
        title={isAdmin ? "KPI actuals hub" : "My KPIs"}
        sub={sub}
        actions={
          (periodSelect || (isAdmin && selectedPeriodId)) ? (
            <>
              {periodSelect}
              {isAdmin && selectedPeriodId && (
                <>
                  <button type="button" className="btn" onClick={handleExportTemplate}>
                    <Download size={16} aria-hidden="true" />
                    Export template
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    aria-disabled={importing || undefined}
                    onClick={() => {
                      if (!importing) fileInputRef.current?.click()
                    }}
                  >
                    <Upload size={16} aria-hidden="true" />
                    {importing ? "Importing…" : "Upload actuals"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={handleImportCsv}
                    disabled={importing}
                  />
                </>
              )}
            </>
          ) : undefined
        }
      />

      {importResult && (
        <div
          className={`sample-banner${importResult.errors.length > 0 ? " offline-banner" : ""}`}
          role="status"
        >
          <span className="sample-banner-ic">
            {importResult.errors.length > 0 ? (
              <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Check size={14} strokeWidth={1.8} aria-hidden="true" />
            )}
          </span>
          <div className="grow">
            <span style={{ fontWeight: 550 }}>
              Import complete · {plural(importResult.imported, "actual")} imported
              {importResult.skipped > 0 && ` · ${plural(importResult.skipped, "row")} skipped (no new values)`}
            </span>
            {importResult.errors.length > 0 && (
              <>
                <span style={{ display: "block", marginTop: 6 }}>
                  {plural(importResult.errors.length, "error")}
                </span>
                <ul style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink-2)" }}>
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      {err.row > 0 ? `Row ${err.row}` : "Error"}{err.field ? ` · ${err.field}` : ""}: {err.message}
                    </li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>And {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </>
            )}
          </div>
          <button type="button" onClick={() => setImportResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isAdmin ? (
        <AdminKpiHub periodId={selectedPeriodId} periodName={selectedPeriod?.name || ""} />
      ) : (
        <>
          {counts.assigned > 0 && (
            <StatGrid>
              <StatTile label="Assigned" value={counts.assigned} sub={plural(groupByPillar(myRows).length, "pillar")} />
              <StatTile label="Submitted" value={counts.submitted} sub="Awaiting review" />
              <StatTile label="Approved" value={counts.approved} sub="Count toward your score" />
              <StatTile
                label="Rejected"
                value={counts.rejected}
                sub={counts.rejected > 0 ? "Need a new value" : "Nothing rejected"}
                bad={counts.rejected > 0}
              />
            </StatGrid>
          )}
          <MyKpiList assignments={myRows} />
        </>
      )}
    </div>
  )
}
