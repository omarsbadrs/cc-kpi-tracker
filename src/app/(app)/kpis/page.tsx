"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMyAssignments, useAllAssignments } from "@/hooks/useKpis"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Upload, ChevronDown, ChevronRight, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { PILLARS } from "@/lib/constants"

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
  actuals: Array<{
    actualValue: number | null
    binaryValue: boolean | null
    score: number | null
    status: string
  }>
}

// ─── Score color helper ───
function scoreColor(score: number | null): string {
  if (score === null) return "text-foreground-muted"
  if (score === 5) return "text-green-400"
  if (score === 4) return "text-lime-400"
  if (score === 3) return "text-amber-400"
  if (score === 2) return "text-orange-400"
  return "text-red-400"
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    APPROVED: "bg-green-500/15 text-green-400 border-green-500/20",
    SUBMITTED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    REJECTED: "bg-red-500/15 text-red-400 border-red-500/20",
    DRAFT: "bg-foreground-muted/10 text-foreground-muted border-border",
  }
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[status] || styles.DRAFT)}>
      {status}
    </span>
  )
}

const PILLAR_OPTIONS = [
  { value: "", label: "All Pillars" },
  { value: "A", label: "A — Delivery" },
  { value: "B", label: "B — Data Quality" },
  { value: "C", label: "C — Forecasting" },
  { value: "D", label: "D — Communication" },
  { value: "E", label: "E — Attendance" },
  { value: "F", label: "F — Growth" },
]

const TIER_OPTIONS = [
  { value: "", label: "All Tiers" },
  { value: "JUNIOR", label: "Junior" },
  { value: "ENGINEER", label: "Engineer" },
  { value: "SENIOR", label: "Senior" },
  { value: "TEAM_LEAD", label: "Team Lead" },
  { value: "SECTION_HEAD", label: "Section Head" },
]

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "USER", label: "User" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
]

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft / Pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
]

// ─── Admin Hub View ───
function AdminKpiHub({ periodId, periodName }: { periodId: string; periodName: string }) {
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

    // Filter by role
    if (filterRole) {
      groups = groups.filter((g) => g.user.role === filterRole)
    }

    // Filter by tier
    if (filterTier) {
      groups = groups.filter((g) => g.user.tier === filterTier)
    }

    // Filter by search
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
  const totalSubmitted = allFiltered.filter((a) => {
    const s = a.actuals?.[0]?.status
    return s === "SUBMITTED" || s === "APPROVED"
  }).length
  const totalPending = totalAssignments - totalSubmitted

  return (
    <div>
      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Users", value: totalUsers },
          { label: "Total KPIs", value: totalAssignments },
          { label: "Submitted", value: totalSubmitted },
          { label: "Pending", value: totalPending },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl px-4 py-3">
            <p className="text-xs text-foreground-muted">{s.label}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
          />
          <button onClick={expandAll} className="text-xs text-foreground-muted hover:text-foreground transition-colors whitespace-nowrap">
            Expand All
          </button>
          <button onClick={collapseAll} className="text-xs text-foreground-muted hover:text-foreground transition-colors whitespace-nowrap">
            Collapse All
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: filterRole, setter: setFilterRole, options: ROLE_OPTIONS },
            { value: filterTier, setter: setFilterTier, options: TIER_OPTIONS },
            { value: filterPillar, setter: setFilterPillar, options: PILLAR_OPTIONS },
            { value: filterStatus, setter: setFilterStatus, options: STATUS_OPTIONS },
          ].map(({ value, setter, options }, i) => (
            <select
              key={i}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-colors",
                value
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                  : "border-border bg-input text-foreground-muted"
              )}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-foreground-muted">
          {searchTerm ? "No users match your search" : "No KPI assignments for this period"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map(({ user, assignments }) => {
            const isExpanded = expandedUsers.has(user.id)
            const submitted = assignments.filter((a) => {
              const s = a.actuals?.[0]?.status
              return s === "SUBMITTED" || s === "APPROVED"
            }).length
            const total = assignments.length
            const pct = total > 0 ? Math.round((submitted / total) * 100) : 0

            return (
              <div key={user.id} className="glass-card rounded-xl overflow-hidden">
                {/* User header row */}
                <button
                  onClick={() => toggleUser(user.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-hover transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                  )}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-xs font-bold text-foreground-secondary">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="rounded-md bg-foreground-muted/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">
                        {user.tier.replace("_", " ")}
                      </span>
                      {user.role !== "USER" && (
                        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                          {user.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-muted truncate">{user.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-foreground">{submitted}/{total}</p>
                    <div className="mt-1 h-1.5 w-20 rounded-full bg-foreground-muted/10">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Expanded: KPIs grouped by pillar */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {(() => {
                      // Group assignments by pillar code
                      const pillarGroups = new Map<string, AssignmentRow[]>()
                      for (const a of assignments) {
                        const pc = a.kpiDefinition.pillar.code
                        if (!pillarGroups.has(pc)) pillarGroups.set(pc, [])
                        pillarGroups.get(pc)!.push(a)
                      }
                      // Sort pillars A-F
                      const sortedPillars = Array.from(pillarGroups.entries()).sort(([a], [b]) => a.localeCompare(b))

                      return sortedPillars.map(([pillarCode, pillarAssignments]) => {
                        const pillarInfo = PILLARS[pillarCode as keyof typeof PILLARS]
                        const pillarSubmitted = pillarAssignments.filter((a) => {
                          const s = a.actuals?.[0]?.status
                          return s === "SUBMITTED" || s === "APPROVED"
                        }).length

                        return (
                          <div key={pillarCode}>
                            {/* Pillar header */}
                            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card-bg/50">
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: pillarInfo?.color || "#888" }}
                              />
                              <span className="text-xs font-bold" style={{ color: pillarInfo?.color || "#888" }}>
                                Pillar {pillarCode}
                              </span>
                              <span className="text-xs text-foreground-muted">— {pillarInfo?.name || pillarAssignments[0]?.kpiDefinition.pillar.name}</span>
                              <span className="ml-auto text-[10px] text-foreground-muted">
                                {pillarSubmitted}/{pillarAssignments.length}
                              </span>
                            </div>
                            {/* KPI rows under this pillar */}
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-foreground-muted/60">
                                  <th className="pl-8 pr-2 py-1 w-16 text-left font-medium">Code</th>
                                  <th className="px-2 py-1 text-left font-medium">KPI Name</th>
                                  <th className="px-2 py-1 text-right font-medium w-20">Target</th>
                                  <th className="px-2 py-1 text-right font-medium w-20">Actual</th>
                                  <th className="px-2 py-1 text-center font-medium w-12">Score</th>
                                  <th className="px-4 py-1 text-center font-medium w-24">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pillarAssignments
                                  .sort((a, b) => a.kpiDefinition.code.localeCompare(b.kpiDefinition.code))
                                  .map((a) => {
                                    const actual = a.actuals?.[0]
                                    const tierTarget = a.kpiDefinition.targets?.find((t) => t.tier === user.tier)
                                    const target = a.targetOverride ?? tierTarget?.targetValue ?? null
                                    const isBinary = a.kpiDefinition.direction === "BINARY"
                                    const targetDisplay = target != null
                                      ? (isBinary ? "Pass" : `${target}${a.kpiDefinition.unit === "PERCENTAGE" ? "%" : ""}`)
                                      : "—"
                                    const actualDisplay = actual?.actualValue != null
                                      ? `${actual.actualValue}${a.kpiDefinition.unit === "PERCENTAGE" ? "%" : ""}`
                                      : actual?.binaryValue != null
                                        ? (actual.binaryValue ? "Pass" : "Fail")
                                        : "—"
                                    return (
                                      <tr
                                        key={a.id}
                                        className="border-b border-border/30 last:border-b-0 hover:bg-card-hover/50 cursor-pointer transition-colors"
                                        onClick={() => router.push(`/kpis/${a.id}`)}
                                      >
                                        <td className="pl-8 pr-2 py-1.5 w-16 font-medium text-foreground text-xs">{a.kpiDefinition.code}</td>
                                        <td className="px-2 py-1.5 text-foreground-secondary text-xs truncate max-w-[200px]">
                                          {a.kpiDefinition.name}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-foreground-muted text-xs w-20">
                                          {targetDisplay}
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-medium text-foreground text-xs w-20">
                                          {actualDisplay}
                                        </td>
                                        <td className={cn("px-2 py-1.5 text-center font-bold text-xs w-12", scoreColor(actual?.score ?? null))}>
                                          {actual?.score != null ? actual.score : "—"}
                                        </td>
                                        <td className="px-4 py-1.5 text-center w-24">
                                          {statusBadge(actual?.status || "DRAFT")}
                                        </td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───
export default function MyKpisPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
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
    if (!res.ok) return
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
      } else {
        setImportResult({ imported: 0, errors: [{ row: 0, field: "", message: json.error?.message || "Import failed" }], skipped: 0, total: 0 })
      }
    } catch {
      setImportResult({ imported: 0, errors: [{ row: 0, field: "", message: "Network error" }], skipped: 0, total: 0 })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (periodsLoading || (!isAdmin && isLoading)) return <LoadingSpinner />

  // User view: map assignments to KPI rows
  const kpiRows = isAdmin ? [] : (assignments || []).map((a: {
    id: string;
    kpiDefinition: { code: string; name: string; targets?: Array<{ targetValue: number }> };
    targetOverride: number | null;
    actuals: Array<{ actualValue: number | null; binaryValue: boolean | null; score: number | null; status: string }>;
  }) => ({
    id: a.id,
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? "—",
    actual: a.actuals?.[0]?.actualValue ?? (a.actuals?.[0]?.binaryValue !== null ? (a.actuals?.[0]?.binaryValue ? "Pass" : "Fail") : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  }))

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title={isAdmin ? "KPI Actuals Hub" : "My KPIs"}
          description={isAdmin
            ? `All users' KPI assignments — ${selectedPeriod?.name || "No period selected"}`
            : `Evaluation Period: ${selectedPeriod?.name || "None"}`
          }
        />
        <div className="flex flex-wrap items-center gap-3 shrink-0 pb-4">
          {isAdmin && selectedPeriodId && (
            <>
              <button
                onClick={handleExportTemplate}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card-bg px-3 py-2 text-sm font-medium text-foreground-secondary hover:bg-card-hover transition-colors"
              >
                <Download className="h-4 w-4" />
                Export Template
              </button>
              <label
                className={`inline-flex items-center gap-2 rounded-lg border border-border bg-card-bg px-3 py-2 text-sm font-medium text-foreground-secondary hover:bg-card-hover transition-colors cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importing..." : "Upload Actuals"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCsv}
                  disabled={importing}
                />
              </label>
            </>
          )}
          {periods && periods.length > 1 && (
            <select
              value={selectedPeriodId}
              onChange={(e) => { setSelectedPeriodId(e.target.value); setImportResult(null) }}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
            >
              {(periods || []).map((p: Period) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isClosed ? "(Closed)" : p.isActive ? "(Active)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${importResult.errors.length > 0 ? "border-amber-500/20 bg-amber-500/10" : "border-green-500/20 bg-green-500/10"}`}>
          <p className="font-medium text-foreground">
            Import complete: {importResult.imported} actuals imported
            {importResult.skipped > 0 && `, ${importResult.skipped} rows skipped (no new values)`}
          </p>
          {importResult.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-amber-400">{importResult.errors.length} error(s):</p>
              {importResult.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-xs text-foreground-muted">
                  {err.row > 0 ? `Row ${err.row}` : "Error"}{err.field ? ` [${err.field}]` : ""}: {err.message}
                </p>
              ))}
              {importResult.errors.length > 10 && (
                <p className="text-xs text-foreground-muted">...and {importResult.errors.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin ? (
        <AdminKpiHub periodId={selectedPeriodId} periodName={selectedPeriod?.name || ""} />
      ) : (
        <KpiStatusGrid
          kpis={kpiRows}
          onRowClick={(code: string) => {
            const assignment = assignments?.find((a: { kpiDefinition: { code: string } }) => a.kpiDefinition.code === code)
            if (assignment) router.push(`/kpis/${assignment.id}`)
          }}
        />
      )}
    </div>
  )
}
