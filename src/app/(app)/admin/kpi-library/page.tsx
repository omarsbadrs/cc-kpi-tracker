"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, CircleDot, SearchX } from "lucide-react"
import { useKpiDefinitions } from "@/hooks/useKpis"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { SearchInput } from "@/components/ui/Field"
import { ChipRow } from "@/components/ui/Segmented"
import { TagPill } from "@/components/ui/StatusChip"
import { PillarTag } from "@/components/ui/KpiMarks"
import { PILLARS, PILLAR_CODES, TIER_SHORT } from "@/lib/constants"

interface KpiTarget {
  tier: string
  targetValue: number
  targetOperator: string
}

interface KpiDef {
  id: string
  code: string
  name: string
  unit: string
  direction: string
  frequency: string
  pillar: { code: string; name: string }
  targets?: KpiTarget[]
}

const TIERS = ["JUNIOR", "ENGINEER", "SENIOR", "TEAM_LEAD", "SECTION_HEAD"] as const

const UNIT_LABEL: Record<string, string> = {
  PERCENTAGE: "%",
  COUNT: "Count",
  SCORE: "Score",
  BINARY: "Pass/fail",
  DAYS: "Days",
}

function sentence(value: string) {
  const s = value.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTarget(kpi: KpiDef, tier: string) {
  const t = kpi.targets?.find((x) => x.tier === tier)
  if (!t) return "—"
  if (kpi.direction === "BINARY") return "Pass"
  const op = t.targetOperator === "<=" ? "≤" : t.targetOperator === ">=" ? "≥" : ""
  return `${op}${t.targetValue}${kpi.unit === "PERCENTAGE" ? "%" : ""}`
}

function Direction({ direction }: { direction: string }) {
  const Icon = direction === "HIGHER" ? ArrowUp : direction === "LOWER" ? ArrowDown : CircleDot
  const word = direction === "HIGHER" ? "Higher" : direction === "LOWER" ? "Lower" : direction === "BINARY" ? "Pass/fail" : sentence(direction)
  return (
    <span className="row" style={{ gap: 6 }}>
      <Icon size={15} strokeWidth={1.8} className="muted" style={{ flex: "none" }} aria-hidden="true" />
      {word}
    </span>
  )
}

type PillarFilter = "ALL" | (typeof PILLAR_CODES)[number]

export default function AdminKpiLibraryPage() {
  const router = useRouter()
  const { data: kpis, isLoading } = useKpiDefinitions()
  const [search, setSearch] = useState("")
  const [pillar, setPillar] = useState<PillarFilter>("ALL")

  const all = useMemo(() => (kpis || []) as KpiDef[], [kpis])

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const acc: Record<string, KpiDef[]> = {}
    for (const kpi of all) {
      if (pillar !== "ALL" && kpi.pillar.code !== pillar) continue
      if (term && !`${kpi.code} ${kpi.name}`.toLowerCase().includes(term)) continue
      const code = kpi.pillar.code
      if (!acc[code]) acc[code] = []
      acc[code].push(kpi)
    }
    return acc
  }, [all, search, pillar])

  if (isLoading) return <LoadingSpinner />

  const shown = Object.values(grouped).reduce((n, list) => n + list.length, 0)
  const filtered = pillar !== "ALL" || search.trim() !== ""

  return (
    <div>
      <PageHead
        title="KPI library"
        sub={`${all.length} KPI definitions across 6 pillars${filtered ? ` · ${shown} shown` : ""}`}
      />

      <div className="toolbar">
        <div className="grow">
          <SearchInput
            placeholder="Search code or name"
            aria-label="Search KPIs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ChipRow<PillarFilter>
        label="Pillar"
        value={pillar}
        onChange={setPillar}
        options={[
          { value: "ALL", label: "All pillars" },
          ...PILLAR_CODES.map((c) => ({ value: c, label: `${c} · ${PILLARS[c].name.split(/[ ,&]/)[0]}` })),
        ]}
      />

      {shown === 0 ? (
        <div className="card-list" style={{ marginBottom: 16 }}>
          <EmptyState
            icon={SearchX}
            title="No KPIs match"
            description="Try another code or name, or show all pillars."
          />
        </div>
      ) : (
        Object.entries(grouped).map(([pillarCode, pillarKpis]) => {
          const name = PILLARS[pillarCode as keyof typeof PILLARS]?.name ?? pillarKpis[0]?.pillar?.name
          return (
            <section key={pillarCode} className="card list-card">
              <div className="card-head">
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <PillarTag code={pillarCode} />
                  <h2 className="card-title" style={{ minWidth: 0 }}>{name}</h2>
                  <TagPill>{pillarKpis.length} {pillarKpis.length === 1 ? "KPI" : "KPIs"}</TagPill>
                </div>
              </div>
              <div className="table-scroll" tabIndex={0} role="region" aria-label={`${name} KPIs`}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <td colSpan={5} style={{ background: "var(--band)", borderBottom: 0 }} />
                      <th scope="colgroup" colSpan={TIERS.length} style={{ textAlign: "center", borderBottom: 0 }}>
                        Target by tier
                      </th>
                    </tr>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Name</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Direction</th>
                      <th scope="col">Frequency</th>
                      {TIERS.map((t) => (
                        <th key={t} scope="col" className="num">{TIER_SHORT[t]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pillarKpis.map((kpi) => {
                      const go = () => router.push(`/admin/kpi-library/${kpi.id}`)
                      return (
                        <tr
                          key={kpi.id}
                          className="clickable"
                          tabIndex={0}
                          onClick={go}
                          onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              go()
                            }
                          }}
                        >
                          <td><span className="kpi-code">{kpi.code}</span></td>
                          <td className="clip" title={kpi.name}>{kpi.name}</td>
                          <td><TagPill>{UNIT_LABEL[kpi.unit] ?? sentence(kpi.unit)}</TagPill></td>
                          <td className="nowrap"><Direction direction={kpi.direction} /></td>
                          <td className="nowrap ink-2">{sentence(kpi.frequency)}</td>
                          {TIERS.map((t) => (
                            <td key={t} className="num">{formatTarget(kpi, t)}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}

    </div>
  )
}
