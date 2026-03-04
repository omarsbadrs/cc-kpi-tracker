"use client"

import { SCORE_COLORS } from "@/lib/constants"
import { Badge } from "@/components/shared/Badge"

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

export function KpiStatusGrid({ kpis, onRowClick }: KpiStatusGridProps) {
  if (kpis.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-foreground-muted">
        No KPIs assigned for this period
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-background-secondary">
            <th className="px-4 py-3 font-medium text-foreground-secondary">Code</th>
            <th className="px-4 py-3 font-medium text-foreground-secondary">KPI Name</th>
            <th className="px-4 py-3 font-medium text-foreground-secondary text-right">Target</th>
            <th className="px-4 py-3 font-medium text-foreground-secondary text-right">Actual</th>
            <th className="px-4 py-3 font-medium text-foreground-secondary text-center">Score</th>
            <th className="px-4 py-3 font-medium text-foreground-secondary text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => (
            <tr
              key={kpi.code}
              onClick={() => onRowClick?.(kpi.code)}
              className={`border-b border-border transition-colors hover:bg-card-hover ${onRowClick ? "cursor-pointer" : ""}`}
            >
              <td className="px-4 py-3 font-mono text-xs text-foreground-muted">{kpi.code}</td>
              <td className="px-4 py-3 text-foreground">{kpi.name}</td>
              <td className="px-4 py-3 text-right font-mono text-foreground-secondary">
                {typeof kpi.target === "number" ? `${kpi.target}%` : kpi.target}
              </td>
              <td className="px-4 py-3 text-right font-mono text-foreground">
                {kpi.actual !== null
                  ? typeof kpi.actual === "number"
                    ? `${kpi.actual}%`
                    : kpi.actual
                  : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                {kpi.score !== null ? (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: SCORE_COLORS[kpi.score as keyof typeof SCORE_COLORS] || SCORE_COLORS[0] }}
                  >
                    {kpi.score}
                  </span>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={statusVariant[kpi.status] || "neutral"}>
                  {kpi.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
