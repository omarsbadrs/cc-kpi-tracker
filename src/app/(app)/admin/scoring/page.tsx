"use client"

import React, { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useRunScoring } from "@/hooks/useScoring"
import { PILLARS, TIER_LABELS } from "@/lib/constants"
import { ScoringMethodologyPanel } from "@/components/shared/ScoringMethodologyPanel"
import { PageHead } from "@/components/ui/PageHead"
import { Field, SelectWrap } from "@/components/ui/Field"
import { StatGrid, StatTile } from "@/components/ui/StatGrid"
import { StatusChip, ActualStatusChip, BandChip } from "@/components/ui/StatusChip"
import { PillarTag, ScoreBadge } from "@/components/ui/KpiMarks"
import { ConfirmDialog } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { EmptyState } from "@/components/shared/EmptyState"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lock,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import type { AppraisalBand, KpiDirection, Tier } from "@prisma/client"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

interface KpiDetail {
  kpiCode: string
  kpiName: string
  pillarCode: string
  pillarName: string
  direction: KpiDirection
  targetValue: number
  targetOperator: string
  actualValue: number | null
  binaryValue: boolean | null
  actualStatus: string | null
  subWeight: number
  kpiScore: number
}

interface PillarResult {
  pillarCode: string
  score5: number
  percent: number
  kpiScores: Array<{ kpiCode: string; score: number; weight: number }>
}

interface ScoringResult {
  userId: string
  userName: string
  userTier: Tier
  evalPeriodId: string
  overallScore: number
  appraisalBand: AppraisalBand
  pillarResults: PillarResult[]
  pillarWeightsUsed: Array<{ pillarCode: string; weight: number }>
  kpiDetail: KpiDetail[]
}

interface PeriodOption {
  id: string
  name: string
  isClosed: boolean
}

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

const PILLAR_CODES = ["A", "B", "C", "D", "E", "F"] as const

const DIRECTION_LABEL: Record<KpiDirection, string> = {
  HIGHER: "Higher",
  LOWER: "Lower",
  BINARY: "Pass/fail",
}

function DirectionCell({ direction }: { direction: KpiDirection }) {
  const Icon = direction === "HIGHER" ? TrendingUp : direction === "LOWER" ? TrendingDown : Minus
  return (
    <span className="inline-flex items-center gap-1 nowrap">
      <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
      {DIRECTION_LABEL[direction]}
    </span>
  )
}

function formatActual(k: KpiDetail): string {
  if (k.direction === "BINARY") {
    if (k.binaryValue === null) return "–"
    return k.binaryValue ? "Pass" : "Fail"
  }
  if (k.actualValue === null) return "–"
  return String(k.actualValue)
}

// ─────────────────────────────────────
// Per-user expanded breakdown
// ─────────────────────────────────────

function UserBreakdown({ result }: { result: ScoringResult }) {
  return (
    <div className="stack" style={{ padding: "14px 0 4px" }}>
      <div className="split even">
        {PILLAR_CODES.map((code) => {
          const pillarResult = result.pillarResults.find((pr) => pr.pillarCode === code)
          const pillarWeight = result.pillarWeightsUsed.find((pw) => pw.pillarCode === code)
          const pillarKpis = result.kpiDetail.filter((k) => k.pillarCode === code)
          const pillarInfo = PILLARS[code]

          if (pillarKpis.length === 0) return null

          return (
            <section key={code} className="card list-card" style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h3 className="card-title flex min-w-0 items-center gap-2">
                  <PillarTag code={code} />
                  <span className="min-w-0">{pillarInfo.name}</span>
                </h3>
                <span className="tabular whitespace-nowrap ink-2" style={{ fontSize: 13 }}>
                  {pillarWeight && <>Weight {pillarWeight.weight}% · </>}
                  <b>{pillarResult ? `${pillarResult.percent.toFixed(1)}%` : "–"}</b>
                </span>
              </div>

              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={`${pillarInfo.name} KPIs for ${result.userName}`}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">KPI</th>
                      <th scope="col">Direction</th>
                      <th scope="col" className="num">Target</th>
                      <th scope="col" className="num">Actual</th>
                      <th scope="col" className="num">Weight</th>
                      <th scope="col" className="num">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pillarKpis.map((k) => (
                      <tr key={k.kpiCode}>
                        <td>
                          <span className="kpi-code">{k.kpiCode}</span>{" "}
                          <span className="muted" title={k.kpiName}>
                            {k.kpiName.length > 28 ? k.kpiName.slice(0, 28) + "…" : k.kpiName}
                          </span>
                        </td>
                        <td className="muted">
                          <DirectionCell direction={k.direction} />
                        </td>
                        <td className="num muted nowrap">
                          {k.targetOperator}
                          {k.targetValue}
                        </td>
                        <td className="num nowrap">
                          {!k.actualStatus ? (
                            <span className="muted">–</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {formatActual(k)}
                              {k.actualStatus !== "APPROVED" && <ActualStatusChip status={k.actualStatus} />}
                            </span>
                          )}
                        </td>
                        <td className="num muted">{k.subWeight}%</td>
                        <td className="num">
                          <ScoreBadge score={k.kpiScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pillar formula summary */}
              {pillarResult && (
                <div className="list-foot">
                  <span className="tabular" style={{ overflowWrap: "anywhere" }}>
                    Score = {pillarKpis.map((k) => `(${k.kpiScore}×${k.subWeight}%)`).join(" + ")} ={" "}
                    <span className="ink-2">{pillarResult.score5.toFixed(2)}/5</span>
                    {" → "}
                    <b className="ink-2">{pillarResult.percent.toFixed(1)}%</b>
                  </span>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Overall calculation */}
      <section className="card">
        <h3 className="card-title">Overall score calculation</h3>
        <div className="tabular ink-2" style={{ fontSize: 13 }}>
          {result.pillarResults.map((pr) => {
            const pw = result.pillarWeightsUsed.find((w) => w.pillarCode === pr.pillarCode)
            if (!pw) return null
            const contrib = (pr.percent * pw.weight) / 100
            return (
              <p key={pr.pillarCode}>
                Pillar {pr.pillarCode}: {pr.percent.toFixed(1)}% × {pw.weight}% = {contrib.toFixed(2)}
              </p>
            )
          })}
          <p
            className="flex flex-wrap items-center gap-2"
            style={{ borderTop: "1px solid var(--hairline)", marginTop: 8, paddingTop: 8, color: "var(--ink)" }}
          >
            <b>Overall = {result.overallScore.toFixed(2)}%</b>
            <BandChip band={result.appraisalBand} small />
          </p>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────
// Main Page
// ─────────────────────────────────────

export default function ScoringPage() {
  const toast = useToast()
  const { data: periods } = usePeriods()
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const [dryRun, setDryRun] = useState(true)
  const [confirmSave, setConfirmSave] = useState(false)
  const runScoringMutation = useRunScoring()
  const [results, setResults] = useState<{
    results: ScoringResult[]
    usersScored: number
    dryRun: boolean
  } | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const periodList: PeriodOption[] = periods || []
  const period = periodList.find((p) => p.id === selectedPeriod)
  const running = runScoringMutation.isPending

  async function handleRun(asDryRun: boolean) {
    if (!selectedPeriod) return
    try {
      const res = await runScoringMutation.mutateAsync({
        evalPeriodId: selectedPeriod,
        dryRun: asDryRun,
      })
      setResults(res.data)
      setExpandedUser(null)
      toast(asDryRun ? "Preview ready" : "Scores saved")
    } catch {
      // The warn banner above the controls carries the message and next step.
    } finally {
      setConfirmSave(false)
    }
  }

  function onRunClick() {
    if (running) return
    if (!selectedPeriod) {
      toast("Choose a period first", { icon: "alert" })
      document.getElementById("scoring-period")?.focus()
      return
    }
    if (dryRun) void handleRun(true)
    else setConfirmSave(true)
  }

  // Summary figures for the stat strip.
  const scored = results?.results ?? []
  const average = scored.length ? scored.reduce((s, r) => s + r.overallScore, 0) / scored.length : 0
  const bandCount = (band: AppraisalBand) => scored.filter((r) => r.appraisalBand === band).length
  const exceeds = bandCount("EXCEEDS")
  const strong = bandCount("STRONG")
  const meets = bandCount("MEETS")
  const needs = bandCount("NEEDS_IMPROVEMENT")
  const unsat = bandCount("UNSATISFACTORY")

  const subFacts = period
    ? [
        period.name,
        period.isClosed ? "Closed" : "Open",
        results ? (results.dryRun ? "Preview, not saved" : "Saved") : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Run the engine for a period, review the results, then save"

  return (
    <>
      <PageHead title="Scoring" sub={subFacts} />

      {/* Running a saving run locks the period on the server. */}
      {running && !dryRun && (
        <div className="sample-banner offline-banner" role="status">
          <span className="sample-banner-ic">
            <Lock size={14} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="grow">
            Scoring is running and this period is locked. New submissions wait until it finishes; you can still
            browse dashboards and reports.
          </span>
        </div>
      )}

      {runScoringMutation.isError && !running && (
        <div className="sample-banner offline-banner" role="alert">
          <span className="sample-banner-ic">
            <AlertCircle size={14} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="grow">
            {runScoringMutation.error?.message || "Scoring failed"}. Check the period and run it again.
          </span>
        </div>
      )}

      {/* Controls */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Run the engine</h2>
        <p className="card-sub">
          Scores each KPI, rolls them into pillar percentages and an overall score, then maps everyone to a band.
        </p>
        <div className="field-grid" style={{ maxWidth: 520 }}>
          <Field label="Evaluation period" htmlFor="scoring-period">
            <SelectWrap>
              <select
                id="scoring-period"
                className="select"
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value)
                  setResults(null)
                }}
              >
                <option value="">Select period…</option>
                {periodList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isClosed ? "(closed)" : ""}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="check-row">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
            />
            <span>Dry run · preview the results without saving</span>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={running || undefined}
            onClick={onRunClick}
          >
            {running ? "Running…" : dryRun ? "Run preview" : "Run scoring"}
          </button>
        </div>
      </section>

      {/* Results */}
      {results && (
        <>
          {results.usersScored > 0 && (
            <StatGrid variant="five">
              <StatTile
                label="People scored"
                value={results.usersScored}
                sub={results.dryRun ? "Preview, not saved" : "Saved"}
              />
              <StatTile label="Average overall" value={`${average.toFixed(1)}%`} sub="Across everyone scored" />
              <StatTile
                label="Strong or better"
                value={exceeds + strong}
                sub={`${exceeds} exceeds · ${strong} strong`}
              />
              <StatTile label="Meets expectations" value={meets} sub="70–79%" />
              <StatTile
                label="Below meets"
                value={needs + unsat}
                sub={`${needs} needs improvement · ${unsat} unsatisfactory`}
                bad={needs + unsat > 0}
              />
            </StatGrid>
          )}

          <section className="card list-card">
            <div className="card-head">
              <h2 className="card-title">Results</h2>
              <StatusChip tone={results.dryRun ? "warn" : "ok"} small>
                {results.dryRun ? "Preview, not saved" : "Saved"}
              </StatusChip>
            </div>

            {results.usersScored === 0 ? (
              <EmptyState
                icon={Users}
                title="Nobody to score yet"
                description="No one has active assignments in this period. Assign KPIs and make sure at least one actual is submitted."
              />
            ) : (
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Scoring results">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Tier</th>
                      {PILLAR_CODES.map((code) => (
                        <th key={code} scope="col" className="num">
                          <PillarTag code={code} />
                          <span className="sr-only">{PILLARS[code].name}</span>
                        </th>
                      ))}
                      <th scope="col" className="num">Overall</th>
                      <th scope="col">Band</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r) => {
                      const isExpanded = expandedUser === r.userId
                      const toggle = () => setExpandedUser(isExpanded ? null : r.userId)

                      return (
                        <React.Fragment key={r.userId}>
                          <tr className="clickable" onClick={toggle}>
                            <th scope="row" style={{ fontWeight: 550 }}>
                              {r.userName}
                            </th>
                            <td className="muted">{TIER_LABELS[r.userTier as keyof typeof TIER_LABELS]}</td>
                            {PILLAR_CODES.map((code) => {
                              const snap = r.pillarResults.find((pr) => pr.pillarCode === code)
                              return (
                                <td key={code} className="num">
                                  {snap ? `${snap.percent.toFixed(0)}%` : <span className="muted">–</span>}
                                </td>
                              )
                            })}
                            <td className="num" style={{ fontWeight: 600 }}>
                              {r.overallScore.toFixed(1)}%
                            </td>
                            <td>
                              <BandChip band={r.appraisalBand} small />
                            </td>
                            <td className="nowrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                aria-expanded={isExpanded}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggle()
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown size={15} aria-hidden="true" />
                                ) : (
                                  <ChevronRight size={15} aria-hidden="true" />
                                )}
                                {isExpanded ? "Hide breakdown" : "Breakdown"}
                                <span className="sr-only"> for {r.userName}</span>
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={11} style={{ background: "var(--band)" }}>
                                <UserBreakdown result={r} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Methodology — always visible */}
      <ScoringMethodologyPanel />

      <ConfirmDialog
        open={confirmSave}
        title="Save scores?"
        message={`Everyone in ${period?.name ?? "this period"} will see the new scores. Earlier scores for this period are replaced.`}
        confirmLabel="Save scores"
        danger={false}
        busy={running}
        onConfirm={() => void handleRun(false)}
        onCancel={() => setConfirmSave(false)}
      />
    </>
  )
}
