"use client"

import { useKpiDefinitions } from "@/hooks/useKpis"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"
import { useRouter } from "next/navigation"

export default function KpiLibraryPage() {
  const router = useRouter()
  const { data: kpis, isLoading } = useKpiDefinitions()

  if (isLoading) return <LoadingSpinner />

  // Group by pillar
  const grouped = (kpis || []).reduce((acc: Record<string, typeof kpis>, kpi: { pillar: { code: string } }) => {
    const code = kpi.pillar.code
    if (!acc[code]) acc[code] = []
    acc[code].push(kpi)
    return acc
  }, {} as Record<string, typeof kpis>)

  return (
    <div>
      <PageHeader
        title="KPI Library"
        description={`${kpis?.length || 0} KPI definitions across 6 pillars`}
      />

      {Object.entries(grouped).map(([pillarCode, pillarKpis]) => (
        <div key={pillarCode} className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground-secondary">
            Pillar {pillarCode}: {(pillarKpis as Array<{ pillar: { name: string } }>)[0]?.pillar?.name}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary">
                  <th className="px-4 py-2 font-medium text-foreground-secondary">Code</th>
                  <th className="px-4 py-2 font-medium text-foreground-secondary">Name</th>
                  <th className="px-4 py-2 font-medium text-foreground-secondary">Unit</th>
                  <th className="px-4 py-2 font-medium text-foreground-secondary">Direction</th>
                  <th className="px-4 py-2 font-medium text-foreground-secondary">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {(pillarKpis as Array<{ id: string; code: string; name: string; unit: string; direction: string; frequency: string }>).map((kpi) => (
                  <tr
                    key={kpi.id}
                    onClick={() => router.push(`/admin/kpi-library/${kpi.id}`)}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-card-hover"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-foreground-muted">{kpi.code}</td>
                    <td className="px-4 py-2 text-foreground">{kpi.name}</td>
                    <td className="px-4 py-2"><Badge variant="neutral">{kpi.unit}</Badge></td>
                    <td className="px-4 py-2"><Badge variant={kpi.direction === "HIGHER" ? "success" : kpi.direction === "LOWER" ? "danger" : "warning"}>{kpi.direction}</Badge></td>
                    <td className="px-4 py-2 text-xs text-foreground-muted">{kpi.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
