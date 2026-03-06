"use client"

import { useState, useMemo } from "react"
import { PILLARS, SCORE_COLORS } from "@/lib/constants"
import { Badge } from "@/components/shared/Badge"
import { ChevronDown, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { PillarCode } from "@/types"

interface KpiRow {
  code: string
  name: string
  target: number | string
  actual: number | string | null
  score: number | null
  status: string
}

interface KpiStatusGridProps {
  kpis: KpiRow[]
  onRowClick?: (code: string) => void
}

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SUBMITTED: "default",
  APPROVED: "success",
  REJECTED: "danger",
}

function getPillarFromCode(kpiCode: string): PillarCode {
  const letter = kpiCode.charAt(0).toUpperCase()
  if (letter in PILLARS) return letter as PillarCode
  return "A"
}

function getScoreIcon(score: number | null) {
  if (score === null) return <Minus className="h-3.5 w-3.5 text-foreground-muted" />
  if (score >= 4) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (score >= 3) return <Minus className="h-3.5 w-3.5 text-amber-500" />
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
}

export function KpiStatusGrid({ kpis, onRowClick }: KpiStatusGridProps) {
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set(Object.keys(PILLARS)))

  const grouped = useMemo(() => kpis.reduce<Record<string, KpiRow[]>>((acc, kpi) => {
    const pillar = getPillarFromCode(kpi.code)
    if (!acc[pillar]) acc[pillar] = []
    acc[pillar].push(kpi)
    return acc
  }, {}), [kpis])

  const pillarCodes = useMemo(() => (Object.keys(PILLARS) as PillarCode[]).filter((code) => grouped[code]?.length), [grouped])

  const togglePillar = (code: string) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  if (kpis.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-foreground-muted">
        No KPIs assigned for this period
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pillarCodes.map((pillarCode) => {
        const pillar = PILLARS[pillarCode]
        const pillarKpis = grouped[pillarCode] || []
        const isExpanded = expandedPillars.has(pillarCode)
        const scoredKpis = pillarKpis.filter((k) => k.score !== null)
        const avgScore = scoredKpis.length > 0
          ? scoredKpis.reduce((sum, k) => sum + (k.score ?? 0), 0) / scoredKpis.length
          : 0
        const completedCount = pillarKpis.filter((k) => k.status === "APPROVED").length

        return (
          <div key={pillarCode} className="glass-card overflow-hidden">
            {/* Pillar header */}
            <button
              onClick={() => togglePillar(pillarCode)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-card-hover"
              style={{ borderRadius: 20 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                  style={{ backgroundColor: pillar.color }}
                >
                  {pillarCode}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{pillar.name}</h3>
                  <p className="text-xs text-foreground-muted">
                    {pillarKpis.length} KPI{pillarKpis.length !== 1 ? "s" : ""} &middot; {completedCount} approved
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {scoredKpis.length > 0 && (
                  <span
                    className="pill hidden sm:inline-flex"
                    style={{ background: pillar.color + "12", color: pillar.color, borderColor: pillar.color + "20" }}
                  >
                    Avg {avgScore.toFixed(1)}/5
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-foreground-muted transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </div>
            </button>

            {/* KPI cards */}
            {isExpanded && (
              <div className="border-t border-border">
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pillarKpis.map((kpi) => (
                    <div
                      key={kpi.code}
                      onClick={() => onRowClick?.(kpi.code)}
                      className={`glass-inner p-4 ${onRowClick ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: pillar.color }}
                        >
                          {kpi.code}
                        </span>
                        <Badge variant={statusVariant[kpi.status] || "neutral"}>
                          {kpi.status}
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-foreground leading-tight mb-3 line-clamp-2 min-h-[2.5rem]">
                        {kpi.name}
                      </p>

                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 rounded-xl bg-background-secondary p-2">
                          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">Target</p>
                          <p className="text-sm font-semibold text-foreground-secondary font-mono">
                            {typeof kpi.target === "number" ? `${kpi.target}%` : kpi.target}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
                        <div className="flex-1 rounded-xl bg-background-secondary p-2">
                          <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">Actual</p>
                          <p className="text-sm font-semibold text-foreground font-mono">
                            {kpi.actual !== null
                              ? typeof kpi.actual === "number"
                                ? `${kpi.actual}%`
                                : kpi.actual
                              : "\u2014"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getScoreIcon(kpi.score)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-foreground-muted">Score</span>
                            <span className="text-xs font-bold text-foreground">
                              {kpi.score !== null ? `${kpi.score}/5` : "\u2014"}
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: 4 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: kpi.score !== null ? `${(kpi.score / 5) * 100}%` : "0%",
                                backgroundColor: kpi.score !== null
                                  ? SCORE_COLORS[kpi.score as keyof typeof SCORE_COLORS] || SCORE_COLORS[0]
                                  : "transparent",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
