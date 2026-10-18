"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useActivePeriod, usePeriods } from "@/hooks/usePeriods"
import { PageHead } from "@/components/ui/PageHead"
import { StatGrid, StatTile } from "@/components/ui/StatGrid"
import { ChipRow } from "@/components/ui/Segmented"
import { SelectWrap } from "@/components/ui/Field"
import { StatusChip, ActualStatusChip } from "@/components/ui/StatusChip"
import { ScoreBadge, PillarTag } from "@/components/ui/KpiMarks"
import { Modal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { UserAvatar } from "@/components/layout/UserMenu"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { TIER_SHORT, PILLARS } from "@/lib/constants"
import { Check, ChevronDown, ClipboardCheck, FileText, Paperclip, X } from "lucide-react"
import type { PillarCode } from "@/types"
import "@/styles/views/manager-review.css"

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

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
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

// ─────────────────────────────────────
// Reject dialog (one actual, or every waiting actual in view)
// ─────────────────────────────────────

function RejectDialog({
  open,
  title,
  message,
  confirmLabel,
  placeholder,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  placeholder: string
  isPending: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const toast = useToast()
  const [comment, setComment] = useState("")
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setComment("")
  }, [open])

  const submit = () => {
    if (isPending) return
    const text = comment.trim()
    if (text.length < 3) {
      toast("Add a reason so they know what to fix", { icon: "alert" })
      fieldRef.current?.focus()
      return
    }
    onConfirm(text)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} locked={isPending}>
      <p style={{ color: "var(--ink-2)", marginBottom: 14, fontSize: 14 }}>{message}</p>
      <div className="field">
        <label className="field-label" htmlFor="reject-comment">
          Reason
          <span className="field-hint"> shown to the submitter</span>
        </label>
        <textarea
          ref={fieldRef}
          id="reject-comment"
          className="textarea"
          rows={3}
          placeholder={placeholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          aria-disabled={isPending || undefined}
          onClick={submit}
        >
          {isPending ? "Rejecting…" : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────
// Row (uses AssignmentRow as data source)
// ─────────────────────────────────────

const COLUMN_COUNT = 9

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
  const detailId = `evidence-${row.id}`
  const fullName = `${row.user.firstName} ${row.user.lastName}`

  return (
    <>
      <tr>
        {/* Member */}
        <td>
          <div className="review-person">
            <UserAvatar firstName={row.user.firstName} lastName={row.user.lastName} />
            <div className="min-w-0">
              <span className="review-person-name">{fullName}</span>
              <span className="review-sub">{TIER_SHORT[row.user.tier] ?? row.user.tier}</span>
            </div>
          </div>
        </td>

        {/* KPI */}
        <td>
          <span className="kpi-code">{kpi.code}</span>
          <span className="review-kpi-name" title={kpi.name}>{kpi.name}</span>
        </td>

        <td className="num ink-2">{formatTarget(row)}</td>
        <td className="num" style={{ fontWeight: 600 }}>{formatValue(row)}</td>
        <td className="num">{actual ? <ScoreBadge score={actual.score} /> : <span className="muted">—</span>}</td>

        {/* Submitted at */}
        <td className="nowrap muted">{actual?.submittedAt ? formatDate(actual.submittedAt) : "—"}</td>

        {/* Status */}
        <td>
          {actual ? (
            <ActualStatusChip status={status} />
          ) : (
            <StatusChip tone="neutral" small>Not submitted</StatusChip>
          )}
        </td>

        {/* Evidence */}
        <td>
          {evidenceFiles.length > 0 ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              aria-expanded={expanded}
              aria-controls={detailId}
              aria-label={`${expanded ? "Hide" : "Show"} ${plural(evidenceFiles.length, "evidence file")}`}
              onClick={() => setExpanded((e) => !e)}
            >
              <Paperclip size={15} strokeWidth={1.6} aria-hidden="true" />
              <span className="tabular">{evidenceFiles.length}</span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                style={{ transform: expanded ? "rotate(180deg)" : undefined }}
              />
            </button>
          ) : (
            <span className="muted">—</span>
          )}
        </td>

        {/* Actions */}
        <td>
          {isPending && actual ? (
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                aria-disabled={isReviewing || undefined}
                onClick={() => {
                  if (!isReviewing) onReject(actual.id)
                }}
              >
                <X size={15} strokeWidth={1.8} aria-hidden="true" />
                Reject
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                aria-disabled={isReviewing || undefined}
                onClick={() => {
                  if (!isReviewing) onApprove(actual.id)
                }}
              >
                <Check size={15} strokeWidth={1.8} aria-hidden="true" />
                Approve
              </button>
            </div>
          ) : actual?.reviewComment ? (
            <span className="review-comment" title={actual.reviewComment}>
              {actual.reviewComment}
            </span>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      </tr>

      {/* Evidence drawer */}
      {expanded && evidenceFiles.length > 0 && (
        <tr className="detail-row" id={detailId}>
          <td colSpan={COLUMN_COUNT}>
            <ul className="evidence-list" aria-label={`Evidence for ${kpi.code}, ${fullName}`}>
              {evidenceFiles.map((f) => (
                <li key={f.id} className="evidence-item">
                  <FileText size={15} strokeWidth={1.6} aria-hidden="true" />
                  <span title={f.fileName}>{f.fileName}</span>
                  <span className="evidence-size">· {(f.fileSize / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────
// Pillar group (collapsible list card)
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
  const pillarName = pillar?.name ?? `Pillar ${pillarCode}`
  const pendingCount = rows.filter((r) => r.actuals[0]?.status === "SUBMITTED").length
  const approvedCount = rows.filter((r) => r.actuals[0]?.status === "APPROVED").length
  const bodyId = `review-pillar-${pillarCode}`

  return (
    <section className="card list-card" aria-label={pillarName}>
      <div className="card-head flex-wrap" style={expanded ? undefined : { borderBottom: 0 }}>
        <div className="flex min-w-0 items-center gap-3">
          <PillarTag code={pillarCode} big />
          <div className="min-w-0">
            <h2 className="card-title">{pillarName}</h2>
            <p className="side-note tabular">
              {plural(rows.length, "KPI")} · {approvedCount} approved
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {pendingCount > 0 && (
            <StatusChip tone="warn" small>{pendingCount} waiting</StatusChip>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Hide" : "Show"}
            <ChevronDown
              size={15}
              aria-hidden="true"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div
          id={bodyId}
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${pillarName} actuals`}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">KPI</th>
                <th scope="col" className="num">Target</th>
                <th scope="col" className="num">Actual</th>
                <th scope="col" className="num">Score</th>
                <th scope="col">Submitted</th>
                <th scope="col">Status</th>
                <th scope="col">Evidence</th>
                <th scope="col">Actions</th>
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
      )}
    </section>
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
  const toast = useToast()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")
  const [pillarFilter, setPillarFilter] = useState("")
  const [tierFilter, setTierFilter] = useState("")
  const [memberFilter, setMemberFilter] = useState("")
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectShownId, setRejectShownId] = useState<string | null>(null)
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
      setRejectTarget(null)
      toast(vars.status === "APPROVED" ? "Actual approved" : "Actual rejected")
    },
    onError: (err: Error) => {
      toast(`Could not save the review. ${err.message}`, { icon: "alert" })
    },
  })

  const handleApprove = (id: string) => reviewMutation.mutate({ id, status: "APPROVED" })
  const handleRejectConfirm = (id: string, comment: string) =>
    reviewMutation.mutate({ id, status: "REJECTED", comment })

  const allRows = useMemo(() => data ?? [], [data])

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
  const approvedTotal = allRows.filter((r) => r.actuals[0]?.status === "APPROVED").length
  const rejectedTotal = allRows.filter((r) => r.actuals[0]?.status === "REJECTED").length
  const notSubmittedTotal = allRows.filter((r) => getActualStatus(r) === "DRAFT").length

  // Bulk approve all pending in current view — single API call
  const handleBulkApprove = async () => {
    if (pendingVisible.length === 0 || isBulkPending) return
    setIsBulkPending(true)
    try {
      const ids = pendingVisible.map((r) => r.actuals[0]!.id)
      const res = await fetch("/api/kpis/actuals/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "APPROVED" }),
      })
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
      if (res.ok) toast(`${plural(ids.length, "actual")} approved`)
      else toast("Could not approve them all. Refresh and try again", { icon: "alert" })
    } catch {
      toast("Could not approve. Check your connection", { icon: "alert" })
    } finally {
      setIsBulkPending(false)
    }
  }

  // Bulk reject all pending in current view — single API call
  const handleBulkRejectConfirm = async (comment: string) => {
    if (pendingVisible.length === 0) return
    setIsBulkPending(true)
    try {
      const ids = pendingVisible.map((r) => r.actuals[0]!.id)
      const res = await fetch("/api/kpis/actuals/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "REJECTED", reviewComment: comment }),
      })
      queryClient.invalidateQueries({ queryKey: ["review-queue"] })
      setBulkRejectOpen(false)
      if (res.ok) toast(`${plural(ids.length, "actual")} rejected`)
      else toast("Could not reject them all. Refresh and try again", { icon: "alert" })
    } catch {
      toast("Could not reject. Check your connection", { icon: "alert" })
    } finally {
      setIsBulkPending(false)
    }
  }

  const pillars: PillarCode[] = ["A", "B", "C", "D", "E", "F"]
  const filterCount = [statusFilter, pillarFilter, tierFilter, memberFilter].filter(Boolean).length
  const isReviewing = reviewMutation.isPending || isBulkPending

  // `rejectShownId` outlives `rejectTarget` so the dialog keeps its text
  // while it animates closed.
  const shownRejectRow = useMemo(
    () => (rejectShownId ? allRows.find((r) => r.actuals[0]?.id === rejectShownId) ?? null : null),
    [allRows, rejectShownId]
  )

  const subFacts = isLoading
    ? ["Loading…"]
    : [
        visibleRows.length === allRows.length
          ? plural(allRows.length, "KPI")
          : `${visibleRows.length} of ${plural(allRows.length, "KPI")} shown`,
        `${totalPending} waiting`,
        `${rejectedTotal} rejected`,
        ...(!isAdmin ? ["Full team hierarchy"] : []),
      ]

  return (
    <>
      <PageHead title="Review queue" sub={subFacts.join(" · ")} />

      <StatGrid>
        <StatTile
          label="Waiting for review"
          value={totalPending}
          sub="Submitted, not reviewed"
          onClick={() => setStatusFilter("SUBMITTED")}
        />
        <StatTile label="Approved" value={approvedTotal} onClick={() => setStatusFilter("APPROVED")} />
        <StatTile label="Rejected" value={rejectedTotal} onClick={() => setStatusFilter("REJECTED")} />
        <StatTile label="Not submitted" value={notSubmittedTotal} sub="Draft or no actual yet" />
      </StatGrid>

      <ChipRow<StatusFilter>
        label="Status"
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "", label: "All" },
          { value: "SUBMITTED", label: totalPending > 0 ? `Waiting · ${totalPending}` : "Waiting" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
        ]}
      />

      <div className="toolbar flex-wrap items-center">
        {periods && periods.length > 0 && (
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <label className="sr-only" htmlFor="review-period">Period</label>
            <SelectWrap>
              <select
                id="review-period"
                className="select"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">All periods</option>
                {(periods as Array<{ id: string; name: string; isActive: boolean; isClosed: boolean }>).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isClosed ? " (closed)" : p.isActive ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </div>
        )}

        <div className="min-w-[160px] flex-1 sm:flex-none">
          <label className="sr-only" htmlFor="review-pillar">Pillar</label>
          <SelectWrap>
            <select
              id="review-pillar"
              className="select"
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value)}
            >
              <option value="">All pillars</option>
              {pillars.map((p) => (
                <option key={p} value={p}>{p} · {PILLARS[p]?.name}</option>
              ))}
            </select>
          </SelectWrap>
        </div>

        {uniqueTiers.length > 1 && (
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <label className="sr-only" htmlFor="review-tier">Tier</label>
            <SelectWrap>
              <select
                id="review-tier"
                className="select"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="">All tiers</option>
                {uniqueTiers.map((t) => (
                  <option key={t} value={t}>{TIER_SHORT[t] ?? t}</option>
                ))}
              </select>
            </SelectWrap>
          </div>
        )}

        {uniqueMembers.length > 1 && (
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <label className="sr-only" htmlFor="review-member">Member</label>
            <SelectWrap>
              <select
                id="review-member"
                className="select"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
              >
                <option value="">All members</option>
                {uniqueMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} · {TIER_SHORT[u.tier] ?? u.tier}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </div>
        )}

        {filterCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setStatusFilter(""); setPillarFilter(""); setTierFilter(""); setMemberFilter("") }}
          >
            Clear {plural(filterCount, "filter")}
          </button>
        )}
      </div>

      {/* ── Pillar-grouped content ── */}
      {isLoading ? (
        <LoadingSpinner />
      ) : visibleRows.length === 0 ? (
        <div className="card-list">
          <EmptyState
            icon={ClipboardCheck}
            title={statusFilter === "SUBMITTED" ? "Nothing waiting for review" : "No actuals to show"}
            description={
              filterCount > 0
                ? "Try another status, pillar or member, or clear the filters."
                : "Submitted actuals from your team appear here."
            }
          />
        </div>
      ) : (
        <div>
          {activePillarCodes.map((code) => (
            <PillarGroup
              key={code}
              pillarCode={code}
              rows={groupedByPillar.get(code) ?? []}
              onApprove={handleApprove}
              onReject={(id) => {
                setRejectShownId(id)
                setRejectTarget(id)
              }}
              isReviewing={isReviewing}
            />
          ))}
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      {pendingCount > 0 && (
        <div className="review-bulk" role="region" aria-label="Review everything waiting in this view">
          <span>
            <b>{pendingCount}</b> waiting in this view
            {visibleRows.length > pendingCount && ` · ${plural(visibleRows.length, "KPI")} shown`}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-danger"
              aria-disabled={isReviewing || undefined}
              onClick={() => {
                if (!isReviewing) setBulkRejectOpen(true)
              }}
            >
              Reject all {pendingCount}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={isReviewing || undefined}
              onClick={() => {
                if (!isReviewing) void handleBulkApprove()
              }}
            >
              <Check size={16} strokeWidth={1.8} aria-hidden="true" />
              {isBulkPending ? "Saving…" : `Approve all ${pendingCount}`}
            </button>
          </div>
        </div>
      )}

      {/* Single reject dialog */}
      <RejectDialog
        open={rejectTarget !== null}
        title="Reject this actual?"
        message={
          shownRejectRow
            ? `${shownRejectRow.kpiDefinition.code} for ${shownRejectRow.user.firstName} ${shownRejectRow.user.lastName} goes back to them with your reason.`
            : "It goes back to the submitter with your reason."
        }
        confirmLabel="Reject actual"
        placeholder="For example: the value doesn't match the Oracle report"
        isPending={reviewMutation.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={(comment) => {
          if (rejectTarget) handleRejectConfirm(rejectTarget, comment)
        }}
      />

      {/* Bulk reject dialog */}
      <RejectDialog
        open={bulkRejectOpen}
        title={`Reject ${plural(pendingCount, "actual")}?`}
        message={`Every actual waiting in this view goes back with the same reason.`}
        confirmLabel={`Reject ${plural(pendingCount, "actual")}`}
        placeholder="For example: values don't match the Oracle report, please resubmit"
        isPending={isBulkPending}
        onClose={() => setBulkRejectOpen(false)}
        onConfirm={(comment) => void handleBulkRejectConfirm(comment)}
      />
    </>
  )
}
