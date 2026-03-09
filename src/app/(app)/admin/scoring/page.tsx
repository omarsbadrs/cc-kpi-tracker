"use client"

import React, { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useRunScoring } from "@/hooks/useScoring"
import { PageHeader } from "@/components/shared/PageHeader"
import { APPRAISAL_BANDS, PILLARS, TIER_LABELS } from "@/lib/constants"
import { ScoringMethodologyPanel } from "@/components/shared/ScoringMethodologyPanel"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
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

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

const PILLAR_CODES = ["A", "B", "C", "D", "E", "F"] as const

function scoreColor(score: number) {
  if (score >= 5) return "text-emerald-400"
  if (score >= 4) return "text-lime-400"
  if (score >= 3) return "text-amber-400"
  if (score >= 2) return "text-orange-400"
  if (score >= 1) return "text-red-400"
  return "text-red-600"
}

function bandColor(band: AppraisalBand) {
  return APPRAISAL_BANDS[band]?.color ?? "#94a3b8"
}

function directionIcon(direction: KpiDirection) {
  if (direction === "HIGHER") return <TrendingUp className="h-3 w-3 text-emerald-400" />
  if (direction === "LOWER") return <TrendingDown className="h-3 w-3 text-red-400" />
  return <Minus className="h-3 w-3 text-amber-400" />
}

function formatActual(k: KpiDetail) {
  if (k.direction === "BINARY") {
    if (k.binaryValue === null) return <span className="text-foreground-muted/50">—</span>
    return (
      <span className={k.binaryValue ? "text-emerald-400" : "text-red-400"}>
        {k.binaryValue ? "Pass" : "Fail"}
      </span>
    )
  }
  if (k.actualValue === null) return <span className="text-foreground-muted/50">—</span>
  return <span>{k.actualValue}</span>
}


// ─────────────────────────────────────
// Per-user expanded breakdown
// ─────────────────────────────────────

function UserBreakdown({ result }: { result: ScoringResult }) {
  return (
    <div className="bg-background-secondary/50 border-t border-border px-5 pb-5 pt-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {PILLAR_CODES.map((code) => {
          const pillarResult = result.pillarResults.find((pr) => pr.pillarCode === code)
          const pillarWeight = result.pillarWeightsUsed.find((pw) => pw.pillarCode === code)
          const pillarKpis = result.kpiDetail.filter((k) => k.pillarCode === code)
          const pillarInfo = PILLARS[code]

          if (pillarKpis.length === 0) return null

          return (
            <div key={code} className="rounded-xl border border-border bg-card-bg overflow-hidden">
              {/* Pillar header */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  borderBottom: `1px solid ${pillarInfo.color}30`,
                  backgroundColor: pillarInfo.color + "10",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: pillarInfo.color }}
                  >
                    {code}
                  </span>
                  <span className="text-xs font-semibold text-foreground-secondary">
                    {pillarInfo.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {pillarWeight && (
                    <span className="text-foreground-muted">pillar weight: {pillarWeight.weight}%</span>
                  )}
                  <span className="font-bold" style={{ color: pillarInfo.color }}>
                    {pillarResult ? `${pillarResult.percent.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              {/* KPI rows */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-foreground-muted">KPI</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-foreground-muted">Dir</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-foreground-muted">Target</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-foreground-muted">Actual</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-foreground-muted">Wt%</th>
                    <th className="px-3 py-1.5 text-center text-[10px] font-medium text-foreground-muted">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {pillarKpis.map((k) => (
                    <tr key={k.kpiCode} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-mono font-semibold text-foreground-secondary">
                          {k.kpiCode}
                        </span>
                        <span className="ml-1.5 text-[10px] text-foreground-muted">
                          {k.kpiName.length > 28 ? k.kpiName.slice(0, 28) + "…" : k.kpiName}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">{directionIcon(k.direction)}</td>
                      <td className="px-2 py-2 text-center font-mono text-foreground-muted">
                        {k.targetOperator}{k.targetValue}
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {!k.actualStatus ? (
                          <span className="text-foreground-muted/40">—</span>
                        ) : (
                          <span
                            className={
                              k.actualStatus === "APPROVED" ? "text-emerald-400" : "text-amber-400"
                            }
                          >
                            {formatActual(k)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-foreground-muted">{k.subWeight}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold text-sm ${scoreColor(k.kpiScore)}`}>
                          {k.kpiScore}
                        </span>
                        <span className="text-foreground-muted">/5</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pillar formula summary */}
              {pillarResult && (
                <div className="border-t border-border/50 bg-background-secondary/30 px-4 py-2 text-[10px] text-foreground-muted font-mono leading-relaxed">
                  Score = {pillarKpis.map((k) => `(${k.kpiScore}×${k.subWeight}%)`).join(" + ")} ={" "}
                  <span className="text-foreground">{pillarResult.score5.toFixed(2)}/5</span>
                  {" → "}
                  <span className="font-bold text-foreground">{pillarResult.percent.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall calculation */}
      <div className="mt-4 rounded-xl border border-border bg-card-bg px-4 py-3">
        <p className="text-xs font-semibold text-foreground-secondary mb-2">
          Overall Score Calculation
        </p>
        <div className="font-mono text-[11px] text-foreground-muted space-y-1">
          {result.pillarResults.map((pr) => {
            const pw = result.pillarWeightsUsed.find((w) => w.pillarCode === pr.pillarCode)
            if (!pw) return null
            const contrib = (pr.percent * pw.weight) / 100
            return (
              <p key={pr.pillarCode}>
                Pillar {pr.pillarCode}: {pr.percent.toFixed(1)}% × {pw.weight}% ={" "}
                <span className="text-foreground">{contrib.toFixed(2)}</span>
              </p>
            )
          })}
          <p className="border-t border-border/50 pt-1.5 mt-1.5 font-bold text-foreground">
            Overall = {result.overallScore.toFixed(2)}%{" → "}
            <span style={{ color: bandColor(result.appraisalBand) }}>
              {APPRAISAL_BANDS[result.appraisalBand]?.label ?? result.appraisalBand}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────
// Main Page
// ─────────────────────────────────────

export default function ScoringPage() {
  const { data: periods } = usePeriods()
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const runScoringMutation = useRunScoring()
  const [results, setResults] = useState<{
    results: ScoringResult[]
    usersScored: number
    dryRun: boolean
  } | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  async function handleRun(dryRun: boolean) {
    if (!selectedPeriod) return
    const res = await runScoringMutation.mutateAsync({
      evalPeriodId: selectedPeriod,
      dryRun,
    })
    setResults(res.data)
    setExpandedUser(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scoring Engine"
        description="Run the full scoring pipeline — KPI scores → Pillar % → Overall → Appraisal Band"
      />

      {/* Controls */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <label className="mb-2 block text-sm font-medium text-foreground-secondary">
          Evaluation Period
        </label>
        <select
          value={selectedPeriod}
          onChange={(e) => {
            setSelectedPeriod(e.target.value)
            setResults(null)
          }}
          className="w-full max-w-md rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
        >
          <option value="">Select period…</option>
          {(periods || []).map((p: { id: string; name: string; isClosed: boolean }) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isClosed ? "(Closed)" : ""}
            </option>
          ))}
        </select>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => handleRun(true)}
            disabled={!selectedPeriod || runScoringMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-card-hover disabled:opacity-50"
          >
            {runScoringMutation.isPending ? "Running…" : "Preview (Dry Run)"}
          </button>
          <button
            onClick={() => handleRun(false)}
            disabled={!selectedPeriod || runScoringMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
            {runScoringMutation.isPending ? "Running…" : "Run & Save Scores"}
          </button>
        </div>

        {runScoringMutation.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {runScoringMutation.error?.message || "Scoring failed"}
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <span className="text-sm font-medium text-foreground-secondary">
              {results.usersScored} user{results.usersScored !== 1 ? "s" : ""} scored
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                results.dryRun
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-emerald-500/15 text-emerald-400"
              }`}
            >
              {results.dryRun ? "Preview Only — not saved" : "Saved to database"}
            </span>
          </div>

          {results.usersScored === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-foreground-muted">
                No users with active assignments found for this period.
              </p>
              <p className="mt-1 text-xs text-foreground-muted/60">
                Make sure KPIs are assigned and at least one actual has been submitted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/50">
                    <th className="px-5 py-2.5 text-xs font-medium text-foreground-muted" />
                    <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Name</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-foreground-secondary">Tier</th>
                    {PILLAR_CODES.map((code) => (
                      <th
                        key={code}
                        className="px-3 py-2.5 text-center text-xs font-medium"
                        style={{ color: PILLARS[code].color }}
                      >
                        {code}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-foreground-secondary">
                      Overall
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-foreground-secondary">
                      Band
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => {
                    const isExpanded = expandedUser === r.userId
                    const color = bandColor(r.appraisalBand)

                    return (
                      <React.Fragment key={r.userId}>
                        <tr
                          onClick={() => setExpandedUser(isExpanded ? null : r.userId)}
                          className="cursor-pointer border-b border-border/60 transition-colors hover:bg-card-hover"
                        >
                          <td className="pl-5 pr-2 py-3">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-foreground-muted" />
                              : <ChevronRight className="h-3.5 w-3.5 text-foreground-muted" />}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{r.userName}</td>
                          <td className="px-4 py-3 text-xs text-foreground-muted">
                            {TIER_LABELS[r.userTier as keyof typeof TIER_LABELS]}
                          </td>
                          {PILLAR_CODES.map((code) => {
                            const snap = r.pillarResults.find((pr) => pr.pillarCode === code)
                            return (
                              <td key={code} className="px-3 py-3 text-center font-mono text-sm">
                                {snap ? (
                                  <span className={scoreColor(snap.score5)}>
                                    {snap.percent.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="text-foreground-muted/30">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                            {r.overallScore.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                              style={{ backgroundColor: color + "20", color }}
                            >
                              {APPRAISAL_BANDS[r.appraisalBand]?.label ?? r.appraisalBand}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${r.userId}-detail`} className="border-b border-border">
                            <td colSpan={10} className="p-0">
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
        </div>
      )}

      {/* Methodology — always visible */}
      <ScoringMethodologyPanel />
    </div>
  )
}
