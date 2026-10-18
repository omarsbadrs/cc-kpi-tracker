"use client"

import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { useSubmitActual } from "@/hooks/useKpis"
import { useActivePeriod } from "@/hooks/usePeriods"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { Field } from "@/components/ui/Field"
import { Segmented } from "@/components/ui/Segmented"
import { ActualStatusChip, StatusChip } from "@/components/ui/StatusChip"
import { ScoreBadge, PillarTag } from "@/components/ui/KpiMarks"
import { useToast } from "@/components/ui/Toast"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_SHORT } from "@/lib/constants"
import { AlertTriangle, ArrowDown, ArrowUp, FileQuestion, CircleDot } from "lucide-react"
import { useState, type FormEvent } from "react"

const DIRECTION_LABEL: Record<string, string> = {
  HIGHER: "Higher is better",
  LOWER: "Lower is better",
  BINARY: "Pass or fail",
}

const UNIT_LABEL: Record<string, string> = {
  PERCENTAGE: "Percentage",
  COUNT: "Count",
  SCORE: "Score",
  BINARY: "Pass or fail",
  DAYS: "Days",
}

function sentence(value: string | null | undefined) {
  if (!value) return "—"
  const s = value.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function DirectionText({ direction }: { direction: string }) {
  const Icon = direction === "HIGHER" ? ArrowUp : direction === "LOWER" ? ArrowDown : CircleDot
  return (
    <span className="row" style={{ gap: 6 }}>
      <Icon size={15} strokeWidth={1.8} className="muted" style={{ flex: "none" }} aria-hidden="true" />
      {DIRECTION_LABEL[direction] ?? sentence(direction)}
    </span>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
}

export default function KpiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const { data: session } = useSession()
  const assignmentId = params.id as string
  const { data: period } = useActivePeriod()

  const canSubmit = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER"

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/assignments/${assignmentId}`)
      if (!res.ok) throw new Error("Failed to fetch assignment")
      const json = await res.json()
      return json.data ?? null
    },
    enabled: !!assignmentId,
  })

  const submitActual = useSubmitActual()

  const [actualValue, setActualValue] = useState("")
  const [binaryValue, setBinaryValue] = useState<boolean | null>(null)

  if (isLoading) return <LoadingSpinner />
  if (!assignment) {
    return (
      <>
        <PageHead title="KPI not found" back={{ href: "/kpis", label: "My KPIs" }} />
        <div className="card-list">
          <EmptyState
            icon={FileQuestion}
            title="This assignment isn't available"
            description="It may have been removed, or it belongs to someone else."
            action={
              <button type="button" className="btn" onClick={() => router.back()}>
                Go back
              </button>
            }
          />
        </div>
      </>
    )
  }

  const kpi = assignment.kpiDefinition
  const latest = assignment.actuals?.[0]
  const isBinary = kpi.direction === "BINARY"
  const isPercent = kpi.unit === "PERCENTAGE"
  const assignedUser = assignment.user
  const userTier = assignedUser?.tier
  const tierTarget = kpi.targets?.find((t: { tier: string }) => t.tier === userTier)
  const targetValue = assignment.targetOverride ?? tierTarget?.targetValue ?? null

  const targetDisplay =
    targetValue != null
      ? isBinary
        ? targetValue === 1 ? "Pass" : "Fail"
        : `${targetValue}${isPercent ? "%" : ""}`
      : "—"

  const latestDisplay = latest
    ? latest.actualValue != null
      ? `${latest.actualValue}${isPercent ? "%" : ""}`
      : latest.binaryValue ? "Pass" : "Fail"
    : "—"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitActual.isPending) return

    if (!period?.id) {
      toast("No active evaluation period. Ask an admin to open one", { icon: "alert" })
      return
    }

    try {
      await submitActual.mutateAsync({
        assignmentId,
        evalPeriodId: period.id,
        ...(isBinary
          ? { binaryValue: binaryValue === true }
          : { actualValue: parseFloat(actualValue) }),
      })
      toast("Actual submitted")
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : "Could not submit. Check your connection", {
        icon: "alert",
      })
    }
  }

  const tierLabel = userTier ? TIER_SHORT[userTier] ?? sentence(userTier) : null

  return (
    <>
      <PageHead
        back={{ href: "/kpis", label: "My KPIs" }}
        title={`${kpi.code} ${kpi.name}`}
        titleAside={
          latest ? <ActualStatusChip status={latest.status} small={false} /> : <StatusChip tone="neutral">Not submitted</StatusChip>
        }
        sub={[kpi.pillar?.name, sentence(kpi.frequency), DIRECTION_LABEL[kpi.direction] ?? sentence(kpi.direction)]
          .filter(Boolean)
          .join(" · ")}
      />

      {latest?.status === "REJECTED" && (
        <div className="sample-banner offline-banner" role="status">
          <span className="sample-banner-ic">
            <AlertTriangle size={14} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="grow">
            This actual was rejected{latest.reviewComment ? `: ${latest.reviewComment}` : ""}. Submit a corrected value.
          </span>
        </div>
      )}

      <div className="detail-grid">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Definition</h2>
            {kpi.pillar?.code && (
              <span className="row" style={{ gap: 8, marginBottom: 12 }}>
                <PillarTag code={kpi.pillar.code} />
                <span className="side-note">Pillar {kpi.pillar.code}</span>
              </span>
            )}
          </div>

          <div className="kv-grid">
            {kpi.formula && (
              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <span className="kv-label">Formula</span>
                <span className="kv-value" style={{ fontWeight: 450 }}>{kpi.formula}</span>
              </div>
            )}
            <div className="kv">
              <span className="kv-label">Target{tierLabel ? ` for ${tierLabel.toLowerCase()}` : ""}</span>
              <span className="kv-value tabular">{targetDisplay}</span>
            </div>
            <div className="kv">
              <span className="kv-label">Direction</span>
              <span className="kv-value"><DirectionText direction={kpi.direction} /></span>
            </div>
            <div className="kv">
              <span className="kv-label">Frequency</span>
              <span className="kv-value">{sentence(kpi.frequency)}</span>
            </div>
            <div className="kv">
              <span className="kv-label">Unit</span>
              <span className="kv-value">{UNIT_LABEL[kpi.unit] ?? sentence(kpi.unit)}</span>
            </div>
            {kpi.sla && (
              <div className="kv">
                <span className="kv-label">SLA</span>
                <span className="kv-value">{kpi.sla}</span>
              </div>
            )}
            {kpi.dataSource && (
              <div className="kv">
                <span className="kv-label">Data source</span>
                <span className="kv-value">{kpi.dataSource}</span>
              </div>
            )}
          </div>

          <h3 className="form-section" style={{ marginTop: 18 }}>Submit actual</h3>
          {canSubmit ? (
            <form onSubmit={handleSubmit}>
              {isBinary ? (
                <div className="field">
                  <span className="field-label" id="binary-label">Result</span>
                  <Segmented<"" | "pass" | "fail">
                    label="Result"
                    value={binaryValue === true ? "pass" : binaryValue === false ? "fail" : ""}
                    onChange={(v) => setBinaryValue(v === "pass")}
                    options={[
                      { value: "pass", label: "Pass" },
                      { value: "fail", label: "Fail" },
                    ]}
                  />
                </div>
              ) : (
                <Field label="Actual value" hint={isPercent ? "in %" : undefined} htmlFor="actualValue">
                  <input
                    id="actualValue"
                    className="input amount-input tabular"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                    required
                    style={{ maxWidth: 240 }}
                  />
                </Field>
              )}

              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-disabled={submitActual.isPending || undefined}
                >
                  {submitActual.isPending ? "Submitting…" : "Submit actual"}
                </button>
              </div>
            </form>
          ) : (
            <p className="side-note">Actual values are submitted by your manager or admin.</p>
          )}
        </section>

        <div className="detail-side">
          <section className="card side-card">
            <div className="card-head">
              <h2 className="card-title">Latest actual</h2>
            </div>
            {latest ? (
              <div className="kv-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div className="kv">
                  <span className="kv-label">Actual</span>
                  <span className="kv-value tabular">{latestDisplay}</span>
                </div>
                <div className="kv">
                  <span className="kv-label">Score</span>
                  <span className="kv-value">
                    <ScoreBadge score={latest.score} />
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-label">Status</span>
                  <span className="kv-value">
                    <ActualStatusChip status={latest.status} />
                  </span>
                </div>
                {formatDate(latest.submittedAt) && (
                  <div className="kv">
                    <span className="kv-label">Submitted</span>
                    <span className="kv-value tabular">{formatDate(latest.submittedAt)}</span>
                  </div>
                )}
                {latest.reviewComment && latest.status !== "REJECTED" && (
                  <div className="kv" style={{ gridColumn: "1 / -1" }}>
                    <span className="kv-label">Reviewer comment</span>
                    <span className="kv-value" style={{ fontWeight: 450 }}>{latest.reviewComment}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="side-note">Nothing submitted for this KPI yet.</p>
            )}
          </section>

          {assignedUser && (
            <section className="card side-card">
              <div className="card-head">
                <h2 className="card-title">Assigned to</h2>
              </div>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <UserAvatar firstName={assignedUser.firstName} lastName={assignedUser.lastName} />
                <div className="grow">
                  <div style={{ fontWeight: 550 }}>
                    {assignedUser.firstName} {assignedUser.lastName}
                  </div>
                  <div className="side-note" style={{ overflowWrap: "anywhere" }}>
                    {[assignedUser.email, tierLabel].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
