"use client"

import "@/styles/views/dashboard.css"
import { Fragment, useMemo, useState, type KeyboardEvent } from "react"
import { ChevronDown, ListChecks } from "lucide-react"
import { PILLARS } from "@/lib/constants"
import { ActualStatusChip, TagPill } from "@/components/ui/StatusChip"
import { PillarTag, ScoreBadge } from "@/components/ui/KpiMarks"
import { EmptyState } from "@/components/shared/EmptyState"
import type { PillarCode } from "@/types"

export interface KpiRow {
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
  /** Heading of the list card. */
  title?: string
}

/** Target / actual as shown in the tables: numbers as %, words as they are. */
export function formatKpiValue(value: number | string | null): string {
  if (value === null || value === undefined) return "—"
  return typeof value === "number" ? `${value}%` : value
}

export function kpiCountLabel(n: number): string {
  return `${n} KPI${n === 1 ? "" : "s"}`
}

/** A body row of a KPI table; a real keyboard target when it opens something. */
export function KpiTableRow({ kpi, onClick }: { kpi: KpiRow; onClick?: (code: string) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onClick) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(kpi.code)
    }
  }
  return (
    <tr
      className={onClick ? "clickable" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? () => onClick(kpi.code) : undefined}
      onKeyDown={onClick ? onKeyDown : undefined}
    >
      <td>
        <span className="kpi-code">{kpi.code}</span>
      </td>
      <td className="clip" title={kpi.name}>
        {kpi.name}
      </td>
      <td className="num muted">{formatKpiValue(kpi.target)}</td>
      <td className="num">{formatKpiValue(kpi.actual)}</td>
      <td>
        <ScoreBadge score={kpi.score} />
      </td>
      <td>
        <ActualStatusChip status={kpi.status} />
      </td>
    </tr>
  )
}

export function KpiTableHead() {
  return (
    <thead>
      <tr>
        <th scope="col">Code</th>
        <th scope="col">KPI</th>
        <th scope="col" className="num">
          Target
        </th>
        <th scope="col" className="num">
          Actual
        </th>
        <th scope="col">Score</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
  )
}

function getPillarFromCode(kpiCode: string): PillarCode {
  const letter = kpiCode.charAt(0).toUpperCase()
  if (letter in PILLARS) return letter as PillarCode
  return "A"
}

export function KpiStatusGrid({ kpis, onRowClick, title = "All KPIs" }: KpiStatusGridProps) {
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set(Object.keys(PILLARS)))

  const grouped = useMemo(
    () =>
      kpis.reduce<Record<string, KpiRow[]>>((acc, kpi) => {
        const pillar = getPillarFromCode(kpi.code)
        if (!acc[pillar]) acc[pillar] = []
        acc[pillar].push(kpi)
        return acc
      }, {}),
    [kpis]
  )

  const pillarCodes = useMemo(
    () => (Object.keys(PILLARS) as PillarCode[]).filter((code) => grouped[code]?.length),
    [grouped]
  )

  const togglePillar = (code: string) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <section className="card list-card" aria-labelledby="kpi-grid-title">
      <div className="card-head">
        <h2 className="card-title" id="kpi-grid-title">
          {title}
        </h2>
        <TagPill>{kpiCountLabel(kpis.length)}</TagPill>
      </div>

      {kpis.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No KPIs assigned for this period"
          description="KPIs assigned for the selected period appear here, grouped by pillar."
        />
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} by pillar`}>
          <table className="data-table">
            <KpiTableHead />
            <tbody>
              {pillarCodes.map((pillarCode) => {
                const pillar = PILLARS[pillarCode]
                const pillarKpis = grouped[pillarCode] || []
                const isExpanded = expandedPillars.has(pillarCode)
                const scoredKpis = pillarKpis.filter((k) => k.score !== null)
                const avgScore =
                  scoredKpis.length > 0
                    ? scoredKpis.reduce((sum, k) => sum + (k.score ?? 0), 0) / scoredKpis.length
                    : 0
                const completedCount = pillarKpis.filter((k) => k.status === "APPROVED").length
                const facts = [kpiCountLabel(pillarKpis.length), `${completedCount} approved`]
                if (scoredKpis.length > 0) facts.push(`Average ${avgScore.toFixed(1)} of 5`)

                return (
                  <Fragment key={pillarCode}>
                    <tr className="group-row">
                      <td colSpan={6}>
                        <button
                          type="button"
                          className="group-toggle"
                          aria-expanded={isExpanded}
                          onClick={() => togglePillar(pillarCode)}
                        >
                          <ChevronDown className="group-chev" size={16} strokeWidth={1.7} aria-hidden="true" />
                          <PillarTag code={pillarCode} />
                          <span className="group-name">{pillar.name}</span>
                          <span className="group-facts">{facts.join(" · ")}</span>
                        </button>
                      </td>
                    </tr>
                    {isExpanded &&
                      pillarKpis.map((kpi) => <KpiTableRow key={kpi.code} kpi={kpi} onClick={onRowClick} />)}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
