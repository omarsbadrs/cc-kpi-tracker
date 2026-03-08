"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useActivePeriod, usePeriods } from "@/hooks/usePeriods"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_SHORT, PILLARS } from "@/lib/constants"
import { CheckCircle2, XCircle, FileText, Clock, ChevronDown, ChevronUp } from "lucide-react"
import type { PillarCode } from "@/types"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

interface EvidenceFile {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  storagePath: string
}

interface ActualEntry {
  id: string
  actualValue: number | null
  binaryValue: boolean | null
  score: number | null
  status: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewComment: string | null
  evidenceFiles: EvidenceFile[]
}

interface KpiTarget {
  tier: string
  targetValue: number
  targetOperator: string
}

// Data shape returned by /api/kpis/assignments?myTeam=true
interface AssignmentRow {
  id: string
  userId: string
  targetOverride: number | null
  user: {
    id: string
    firstName: string
    lastName: string
    tier: string
  }
  kpiDefinition: {
    code: string
    name: string
    unit: string
    direction: string
    pillar: { code: string; name: string }
    targets?: KpiTarget[]
  }
  actuals: ActualEntry[]
}

type StatusFilter = "SUBMITTED" | "APPROVED" | "REJECTED" | "DRAFT" | ""

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

function getActualStatus(row: AssignmentRow): string {
  return row.actuals[0]?.status ?? "DRAFT"
}

function formatValue(row: AssignmentRow): string {
  const actual = row.actuals[0]
  if (!actual) return "—"
  if (actual.binaryValue !== null) return actual.binaryValue ? "Pass" : "Fail"
  if (actual.actualValue === null) return "—"
  if (row.kpiDefinition.unit === "PERCENTAGE") return `${actual.actualValue}%`
  if (row.kpiDefinition.unit === "SCORE") return `${actual.actualValue}/5`
  return String(actual.actualValue)
}

function formatTarget(row: AssignmentRow): string {
  if (row.targetOverride !== null) {
    return row.kpiDefinition.unit === "PERCENTAGE"
      ? `${row.targetOverride}%`
      : String(row.targetOverride)
  }
  const target = row.kpiDefinition.targets?.find((t) => t.tier === row.user.tier)
  if (!target) return "—"
  const dir = row.kpiDefinition.direction
  const op = dir === "LOWER" ? "≤" : dir === "HIGHER" ? "≥" : ""
  const val = row.kpiDefinition.unit === "PERCENTAGE"
    ? `${target.targetValue}%`
    : row.kpiDefinition.unit === "SCORE"
    ? `${target.targetValue}/5`
    : row.kpiDefinition.unit === "BINARY"
    ? (target.targetValue === 1 ? "Pass" : "Fail")
    : String(target.targetValue)
  return op ? `${op}${val}` : val
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SUBMITTED: { cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20", label: "Pending" },
    APPROVED:  { cls: "bg-green-500/10 text-green-400 border border-green-500/20",  label: "Approved" },
    REJECTED:  { cls: "bg-red-500/10 text-red-400 border border-red-500/20",         label: "Rejected" },
    DRAFT:     { cls: "bg-foreground-muted/10 text-foreground-muted border border-border", label: "Draft" },
    NOT_SUBMITTED: { cls: "bg-foreground-muted/5 text-foreground-muted/60 border border-border/50", label: "Not submitted" },
  }
  const s = map[status] ?? map["DRAFT"]!
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─────────────────────────────────────
// Reject modal
// ─────────────────────────────────────

function RejectModal({
  actualId,
  onClose,
  onConfirm,
  isPending,
}: {
  actualId: string
  onClose: () => void
  onConfirm: (id: string, comment: string) => void
  isPending: boolean
}) {
  const [comment, setComment] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-foreground">Reject Submission</h3>
        <p className="mb-4 text-sm text-foreground-muted">Provide a reason for rejection. The submitter will see this comment.</p>
        <textarea
          autoFocus
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-red-500 resize-none"
          rows={3}
          placeholder="e.g. The actual value doesn't match the Oracle report..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:bg-card-hover"
          >
            Cancel
          </button>
          <button
            disabled={comment.trim().length < 3 || isPending}
            onClick={() => onConfirm(actualId, comment.trim())}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" />
            {isPending ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Row (uses AssignmentRow as data source)
// ─────────────────────────────────────

function ActualRow({
  row,
  onApprove,
  onReject,
  isReviewing,
}: {
  row: AssignmentRow
  onApprove: (actualId: string) => void
  onReject: (actualId: string) => void
  isReviewing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const kpi = row.kpiDefinition
  const actual = row.actuals[0] ?? null
  const status = actual?.status ?? "NOT_SUBMITTED"
  const isPending = status === "SUBMITTED"
  const evidenceFiles = actual?.evidenceFiles ?? []

  return (
    <>
      <tr className={`border-b border-border transition-colors hover:bg-card-hover ${!actual ? "opacity-60" : ""}`}>
        {/* Member */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-xs font-bold text-foreground-secondary">
              {row.user.firstName[0]}{row.user.lastName[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.user.firstName} {row.user.lastName}
              </p>
              <p className="text-[11px] text-foreground-muted">
                {TIER_SHORT[row.user.tier] ?? row.user.tier}
              </p>
            </div>
          </div>
        </td>

        {/* KPI */}
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{kpi.code}</p>
          <p className="mt-0.5 max-w-[200px] truncate text-[11px] text-foreground-muted" title={kpi.name}>{kpi.name}</p>
        </td>

        {/* Target */}
        <td className="px-4 py-3 font-mono text-sm text-foreground-secondary">
          {formatTarget(row)}
        </td>

        {/* Actual value */}
        <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">
          {formatValue(row)}
        </td>

        {/* Submitted at */}
        <td className="px-4 py-3 text-xs text-foreground-muted">
          {actual?.submittedAt ? formatDate(actual.submittedAt) : "—"}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={status} />
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {evidenceFiles.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground-muted transition-colors hover:bg-card-hover hover:text-foreground"
                title="View evidence"
              >
                <FileText className="h-3 w-3" />
                {evidenceFiles.length}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
            {isPending && actual && (
              <>
                <button
                  disabled={isReviewing}
                  onClick={() => onApprove(actual.id)}
                  className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  disabled={isReviewing}
                  onClick={() => onReject(actual.id)}
                  className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </>
            )}
            {!isPending && actual?.reviewComment && (
              <span className="max-w-[160px] truncate text-[11px] text-foreground-muted italic" title={actual.reviewComment}>
                {actual.reviewComment}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Evidence expansion row */}
      {expanded && evidenceFiles.length > 0 && (
        <tr className="border-b border-border bg-background-secondary/30">
          <td colSpan={7} className="px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {evidenceFiles.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card-bg px-3 py-1.5 text-xs text-foreground-muted"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  {f.fileName}
                  <span className="text-foreground-muted/50">· {(f.fileSize / 1024).toFixed(0)} KB</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────
// Pillar group (collapsible section)
// ─────────────────────────────────────

function PillarGroup({
  pillarCode,
  rows,
  onApprove,
  onReject,
  isReviewing,
}: {
  pillarCode: PillarCode
  rows: AssignmentRow[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isReviewing: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const pillar = PILLARS[pillarCode]
  const pendingCount = rows.filter((r) => r.actuals[0]?.status === "SUBMITTED").length
  const approvedCount = rows.filter((r) => r.actuals[0]?.status === "APPROVED").length

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
      {/* Pillar header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-card-hover"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
            style={{ backgroundColor: pillar?.color ?? "#94a3b8" }}
          >
            {pillarCode}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{pillar?.name ?? `Pillar ${pillarCode}`}</h3>
            <p className="text-xs text-foreground-muted">
              {rows.length} KPI{rows.length !== 1 ? "s" : ""} &middot; {approvedCount} approved
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0 text-[10px] font-bold text-white">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>

      {/* Table */}
      {expanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary/50">
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Member</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">KPI</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Target</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Actual</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Submitted</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ActualRow
                    key={row.id}
                    row={row}
                    onApprove={onApprove}
                    onReject={onReject}
                    isReviewing={isReviewing}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────
// Bulk reject modal
// ─────────────────────────────────────

function BulkRejectModal({
  count,
  onClose,
  onConfirm,
  isPending,
}: {
  count: number
  onClose: () => void
  onConfirm: (comment: string) => void
  isPending: boolean
}) {
  const [comment, setComment] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Reject {count} Submission{count !== 1 ? "s" : ""}
        </h3>
        <p className="mb-4 text-sm text-foreground-muted">
          This comment will be applied to all {count} pending submission{count !== 1 ? "s" : ""} in the current view.
        </p>
        <textarea
          autoFocus
          className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-red-500"
          rows={3}
          placeholder="e.g. Values not matching Oracle report — please resubmit with correct data..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:bg-card-hover"
          >
            Cancel
          </button>
          <button
            disabled={comment.trim().length < 3 || isPending}
            onClick={() => onConfirm(comment.trim())}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" />
            {isPending ? "Rejecting…" : `Reject All ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Page
// ─────────────────────────────────────

export default function ReviewQueuePage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const { data: periods } = usePeriods()
  const { data: activePeriod } = useActivePeriod()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")
  const [pillarFilter, setPillarFilter] = useState("")
  const [tierFilter, setTierFilter] = useState("")
  const [memberFilter, setMemberFilter] = useState("")
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [isBulkPending, setIsBulkPending] = useState(false)

  useEffect(() => {
    if (activePeriod && !selectedPeriodId) {
      setSelectedPeriodId(activePeriod.id)
    }
  }, [activePeriod, selectedPeriodId])

  const periodId = selectedPeriodId || undefined

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue", pillarFilter, periodId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("myTeam", "true")
      if (pillarFilter) params.set("pillarCode", pillarFilter)
      if (periodId) params.set("evalPeriodId", periodId)
      params.set("pageSize", "2000")

      const res = await fetch(`/api/kpis/assignments?${params}`)
      if (!res.ok) throw new Error("Failed to fetch assignments")
      const json = await res.json()
      return json.data as AssignmentRow[]
    },
    enabled: true,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: "APPROVED" | "REJECTED"; comment?: string }) => {
      const res = await fetch(`/api/kpis/actuals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewComment: comment }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Review failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
      setRejectTarget(null)
    },
  })

  const handleApprove = (id: string) => reviewMutation.mutate({ id, status: "APPROVED" })
  const handleRejectConfirm = (id: string, comment: string) =>
    reviewMutation.mutate({ id, status: "REJECTED", comment })

  const allRows = data ?? []

  // Derive unique members and tiers for filter dropdowns
  const uniqueMembers = useMemo(() =>
    Array.from(new Map(allRows.map((r) => [r.user.id, r.user])).values())
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [allRows]
  )
  const uniqueTiers = useMemo(() =>
    Array.from(new Set(allRows.map((r) => r.user.tier))).sort(),
    [allRows]
  )

  // Client-side filtering
  const visibleRows = useMemo(() =>
    allRows.filter((r) => {
      const status = getActualStatus(r)
      if (statusFilter && status !== statusFilter) return false
      if (memberFilter && r.user.id !== memberFilter) return false
      if (tierFilter && r.user.tier !== tierFilter) return false
      return true
    }),
    [allRows, statusFilter, memberFilter, tierFilter]
  )

  // Group by pillar (maintaining pillar order A→F)
  const pillarOrder: PillarCode[] = ["A", "B", "C", "D", "E", "F"]
  const groupedByPillar = useMemo(() => {
    const map = new Map<PillarCode, AssignmentRow[]>()
    for (const row of visibleRows) {
      const code = row.kpiDefinition.pillar.code as PillarCode
      if (!map.has(code)) map.set(code, [])
      map.get(code)!.push(row)
    }
    return map
  }, [visibleRows])

  const activePillarCodes = pillarOrder.filter((c) => groupedByPillar.has(c))

  // Rows with a SUBMITTED actual in current view
  const pendingVisible = useMemo(() =>
    visibleRows.filter((r) => r.actuals[0]?.status === "SUBMITTED"),
    [visibleRows]
  )
  const pendingCount = pendingVisible.length
  const totalPending = allRows.filter((r) => r.actuals[0]?.status === "SUBMITTED").length

  // Bulk approve all pending in current view
  const handleBulkApprove = async () => {
    if (pendingVisible.length === 0) return
    setIsBulkPending(true)
    try {
      await Promise.all(
        pendingVisible.map((r) =>
          fetch(`/api/kpis/actuals/${r.actuals[0]!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPROVED" }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
    } finally {
      setIsBulkPending(false)
    }
  }

  // Bulk reject all pending in current view
  const handleBulkRejectConfirm = async (comment: string) => {
    if (pendingVisible.length === 0) return
    setIsBulkPending(true)
    try {
      await Promise.all(
        pendingVisible.map((r) =>
          fetch(`/api/kpis/actuals/${r.actuals[0]!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "REJECTED", reviewComment: comment }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
      setBulkRejectOpen(false)
    } finally {
      setIsBulkPending(false)
    }
  }

  const pillars: PillarCode[] = ["A", "B", "C", "D", "E", "F"]
  const filterCount = [statusFilter, pillarFilter, tierFilter, memberFilter].filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Review Queue"
        description={`${visibleRows.length} KPI${visibleRows.length !== 1 ? "s" : ""}${pendingCount > 0 ? ` · ${pendingCount} pending` : ""}`}
      />

      {reviewMutation.isError && (
        <div className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {reviewMutation.error?.message}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(["", "SUBMITTED", "APPROVED", "REJECTED"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 transition-colors ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "text-foreground-muted hover:bg-card-hover hover:text-foreground"
                }`}
              >
                {s === "" ? "All" : s === "SUBMITTED" ? "Pending" : s.charAt(0) + s.slice(1).toLowerCase()}
                {s === "SUBMITTED" && totalPending > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {totalPending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filterCount > 0 && (
            <button
              onClick={() => { setStatusFilter(""); setPillarFilter(""); setTierFilter(""); setMemberFilter("") }}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground-muted hover:bg-card-hover hover:text-foreground transition-colors"
            >
              Clear filters ({filterCount})
            </button>
          )}

          {!isAdmin && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-foreground-muted">
              <Clock className="h-3.5 w-3.5" />
              Full team hierarchy
            </span>
          )}
        </div>

        {/* Second row — dropdowns */}
        <div className="flex flex-wrap gap-2">
          {/* Period */}
          {periods && periods.length > 0 && (
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
            >
              <option value="">All Periods</option>
              {(periods as Array<{ id: string; name: string; isActive: boolean; isClosed: boolean }>).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isClosed ? " (Closed)" : p.isActive ? " (Active)" : ""}
                </option>
              ))}
            </select>
          )}

          {/* Pillar */}
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
            className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
          >
            <option value="">All Pillars</option>
            {pillars.map((p) => (
              <option key={p} value={p}>Pillar {p} — {PILLARS[p]?.name}</option>
            ))}
          </select>

          {/* Tier */}
          {uniqueTiers.length > 1 && (
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
            >
              <option value="">All Tiers</option>
              {uniqueTiers.map((t) => (
                <option key={t} value={t}>{TIER_SHORT[t] ?? t}</option>
              ))}
            </select>
          )}

          {/* Member */}
          {uniqueMembers.length > 1 && (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
            >
              <option value="">All Members</option>
              {uniqueMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} · {TIER_SHORT[u.tier] ?? u.tier}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Pillar-grouped content ── */}
      {isLoading ? (
        <LoadingSpinner />
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400/30" />
          <p className="text-sm font-medium text-foreground">
            {statusFilter === "SUBMITTED" ? "No pending submissions" : "Nothing to show"}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">Try changing the filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activePillarCodes.map((code) => (
            <PillarGroup
              key={code}
              pillarCode={code}
              rows={groupedByPillar.get(code) ?? []}
              onApprove={handleApprove}
              onReject={(id) => setRejectTarget(id)}
              isReviewing={reviewMutation.isPending || isBulkPending}
            />
          ))}
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      {pendingCount > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border border-card-border bg-card-bg/95 px-5 py-3 shadow-xl backdrop-blur">
          <p className="text-sm text-foreground-muted">
            <span className="font-semibold text-foreground">{pendingCount}</span> pending submission{pendingCount !== 1 ? "s" : ""} in current view
            {visibleRows.length > pendingCount && (
              <span className="ml-1 text-foreground-muted/60">({visibleRows.length} total KPIs shown)</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={isBulkPending || reviewMutation.isPending}
              onClick={handleBulkApprove}
              className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isBulkPending ? "Processing…" : `Approve All ${pendingCount}`}
            </button>
            <button
              disabled={isBulkPending || reviewMutation.isPending}
              onClick={() => setBulkRejectOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" />
              Reject All {pendingCount}
            </button>
          </div>
        </div>
      )}

      {/* Single reject modal */}
      {rejectTarget && (
        <RejectModal
          actualId={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          isPending={reviewMutation.isPending}
        />
      )}

      {/* Bulk reject modal */}
      {bulkRejectOpen && (
        <BulkRejectModal
          count={pendingCount}
          onClose={() => setBulkRejectOpen(false)}
          onConfirm={handleBulkRejectConfirm}
          isPending={isBulkPending}
        />
      )}
    </div>
  )
}
