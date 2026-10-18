"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, CircleDot, FileQuestion } from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { PillarTag } from "@/components/ui/KpiMarks"
import { TIER_LABELS } from "@/lib/constants"

const BACK = { href: "/kpi-library", label: "KPI library" }

const TIERS = ["JUNIOR", "ENGINEER", "SENIOR", "TEAM_LEAD", "SECTION_HEAD"] as const

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

interface Target {
  id: string
  tier: string
  targetValue: number
  targetOperator: string
}

interface Weight {
  id: string
  tier: string
  weight: number
}

function sentence(value: string | null | undefined) {
  if (!value) return "—"
  const s = value.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function opSymbol(op: string) {
  return op === ">=" ? "≥" : op === "<=" ? "≤" : op === "==" ? "" : op
}

export default function KpiDetailPage() {
  const { id } = useParams() as { id: string }

  const { data: kpi, isLoading } = useQuery({
    queryKey: ["kpi", id],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/${id}`)
      if (!res.ok) throw new Error("Failed to fetch KPI")
      return (await res.json()).data
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (!kpi) {
    return (
      <>
        <PageHead title="KPI not found" back={BACK} />
        <div className="card-list">
          <EmptyState
            icon={FileQuestion}
            title="This KPI isn't in the library"
            description="It may have been retired. Pick another KPI from the library."
          />
        </div>
      </>
    )
  }

  const targets: Target[] = kpi.targets ?? []
  const weights: Weight[] = kpi.subKpiWeights ?? []
  const tiers = TIERS.filter((t) => targets.some((x) => x.tier === t) || weights.some((w) => w.tier === t))
  const isPercent = kpi.unit === "PERCENTAGE"
  const DirIcon = kpi.direction === "HIGHER" ? ArrowUp : kpi.direction === "LOWER" ? ArrowDown : CircleDot

  return (
    <>
      <PageHead
        back={BACK}
        title={`${kpi.code} ${kpi.name}`}
        sub={[kpi.pillar?.name, UNIT_LABEL[kpi.unit] ?? sentence(kpi.unit), DIRECTION_LABEL[kpi.direction] ?? sentence(kpi.direction), sentence(kpi.frequency)]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <h2 className="card-title">Definition</h2>
            {kpi.description || kpi.formula || kpi.sla || kpi.dataSource ? (
              <div className="kv-grid">
                {kpi.description && (
                  <div className="kv" style={{ gridColumn: "1 / -1" }}>
                    <span className="kv-label">Description</span>
                    <span className="kv-value" style={{ fontWeight: 450 }}>{kpi.description}</span>
                  </div>
                )}
                {kpi.formula && (
                  <div className="kv" style={{ gridColumn: "1 / -1" }}>
                    <span className="kv-label">Formula</span>
                    <span className="kv-value" style={{ fontWeight: 450 }}>{kpi.formula}</span>
                  </div>
                )}
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
            ) : (
              <p className="side-note">No description, formula or source recorded for this KPI.</p>
            )}
          </section>

          <section className="card list-card" style={{ marginBottom: 0 }}>
            <div className="card-head">
              <h2 className="card-title">Targets and weights by tier</h2>
            </div>
            {tiers.length > 0 ? (
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Targets and weights by tier">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Tier</th>
                      <th scope="col" className="num">Target</th>
                      <th scope="col" className="num">Sub-KPI weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => {
                      const t = targets.find((x) => x.tier === tier)
                      const w = weights.find((x) => x.tier === tier)
                      return (
                        <tr key={tier}>
                          <th scope="row" style={{ fontWeight: 450 }}>{TIER_LABELS[tier]}</th>
                          <td className="num">
                            {t
                              ? kpi.direction === "BINARY"
                                ? "Pass"
                                : `${opSymbol(t.targetOperator)}${t.targetValue}${isPercent ? "%" : ""}`
                              : "—"}
                          </td>
                          <td className="num">{w ? `${w.weight}%` : "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="side-note" style={{ padding: "12px 14px" }}>No targets or weights set for this KPI yet.</p>
            )}
          </section>
        </div>

        <div className="detail-side">
          <section className="card side-card">
            <h2 className="card-title">At a glance</h2>
            <div className="kv-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
              {kpi.pillar && (
                <div className="kv">
                  <span className="kv-label">Pillar</span>
                  <span className="kv-value row" style={{ gap: 8 }}>
                    <PillarTag code={kpi.pillar.code} />
                    <span className="grow">{kpi.pillar.name}</span>
                  </span>
                </div>
              )}
              <div className="kv">
                <span className="kv-label">Unit</span>
                <span className="kv-value">{UNIT_LABEL[kpi.unit] ?? sentence(kpi.unit)}</span>
              </div>
              <div className="kv">
                <span className="kv-label">Direction</span>
                <span className="kv-value row" style={{ gap: 6 }}>
                  <DirIcon size={15} strokeWidth={1.8} className="muted" style={{ flex: "none" }} aria-hidden="true" />
                  {DIRECTION_LABEL[kpi.direction] ?? sentence(kpi.direction)}
                </span>
              </div>
              <div className="kv">
                <span className="kv-label">Frequency</span>
                <span className="kv-value">{sentence(kpi.frequency)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
