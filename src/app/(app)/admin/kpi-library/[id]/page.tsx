"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS } from "@/lib/constants"

export default function KpiDetailAdminPage() {
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
  if (!kpi) return <div className="py-12 text-center text-foreground-muted">KPI not found</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`${kpi.code} — ${kpi.name}`}
        description={`${kpi.pillar?.name} | ${kpi.unit} | ${kpi.direction} | ${kpi.frequency}`}
      />

      <div className="rounded-xl border border-card-border bg-card-bg p-6 space-y-3">
        {kpi.description && <div><span className="text-xs text-foreground-muted">Description</span><p className="text-sm text-foreground">{kpi.description}</p></div>}
        {kpi.formula && <div><span className="text-xs text-foreground-muted">Formula</span><p className="text-sm text-foreground">{kpi.formula}</p></div>}
        {kpi.sla && <div><span className="text-xs text-foreground-muted">SLA</span><p className="text-sm text-foreground">{kpi.sla}</p></div>}
        {kpi.dataSource && <div><span className="text-xs text-foreground-muted">Data Source</span><p className="text-sm text-foreground">{kpi.dataSource}</p></div>}
      </div>

      {/* Targets by Tier */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground-muted">Targets by Tier</h3>
        <div className="grid gap-3 sm:grid-cols-5">
          {kpi.targets?.map((t: { id: string; tier: string; targetValue: number; targetOperator: string }) => (
            <div key={t.id} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-foreground-muted">{TIER_LABELS[t.tier as keyof typeof TIER_LABELS]}</p>
              <p className="mt-1 text-lg font-bold text-foreground">{t.targetOperator}{t.targetValue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-KPI Weights by Tier */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground-muted">Sub-KPI Weights by Tier</h3>
        <div className="grid gap-3 sm:grid-cols-5">
          {kpi.subKpiWeights?.map((w: { id: string; tier: string; weight: number }) => (
            <div key={w.id} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-foreground-muted">{TIER_LABELS[w.tier as keyof typeof TIER_LABELS]}</p>
              <p className="mt-1 text-lg font-bold text-foreground">{w.weight}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
