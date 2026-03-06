"use client"

import { PILLARS, SCORE_COLORS } from "@/lib/constants"
import type { PillarCode } from "@/types"
import { Badge } from "@/components/shared/Badge"
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react"

interface KpiRow {
  code: string
  name: string
  target: number | string
  actual: number | string | null
  score: number | null
  status: string
}

interface PillarKpiDetailProps {
  pillarCode: PillarCode
  kpis: KpiRow[]
  onKpiClick?: (code: string) => void
}

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  SUBMITTED: "default",
  APPROVED: "success",
  REJECTED: "danger",
}

function getScoreIcon(score: number | null) {
  if (score === null) return <Minus className="h-3.5 w-3.5 text-foreground-muted" />
  if (score >= 4) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (score >= 3) return <Minus className="h-3.5 w-3.5 text-amber-500" />
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
}

export function PillarKpiDetail({ pillarCode, kpis, onKpiClick }: PillarKpiDetailProps) {
  const pillar = PILLARS[pillarCode]
  if (!pillar) return null

  if (kpis.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-sm text-foreground-muted">
        No KPIs assigned for this pillar
      </div>
    )
  }

  return (
    <div
      className="glass-card overflow-hidden animate-card-in"
      style={{ borderColor: pillar.color + "30" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ backgroundColor: pillar.color + "06" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white"
          style={{ backgroundColor: pillar.color }}
        >
          {pillarCode}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{pillar.name}</h3>
          <p className="text-xs text-foreground-muted">{kpis.length} KPI{kpis.length !== 1 ? "s" : ""} assigned</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.code}
            onClick={() => onKpiClick?.(kpi.code)}
            className={`glass-inner p-4 ${onKpiClick ? "cursor-pointer" : ""}`}
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
  )
}
