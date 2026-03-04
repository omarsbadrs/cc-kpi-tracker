"use client"

import { useActivePeriod } from "@/hooks/usePeriods"
import { useMyAssignments } from "@/hooks/useKpis"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { useRouter } from "next/navigation"

export default function MyKpisPage() {
  const router = useRouter()
  const { data: activePeriod, isLoading: periodLoading } = useActivePeriod()
  const { data: assignments, isLoading } = useMyAssignments(activePeriod?.id)

  if (periodLoading || isLoading) return <LoadingSpinner />

  const kpiRows = (assignments || []).map((a: {
    id: string;
    kpiDefinition: { code: string; name: string };
    targetOverride: number | null;
    actuals: Array<{ actualValue: number | null; binaryValue: boolean | null; score: number | null; status: string }>;
  }) => ({
    id: a.id,
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? "—",
    actual: a.actuals?.[0]?.actualValue ?? (a.actuals?.[0]?.binaryValue !== null ? (a.actuals?.[0]?.binaryValue ? "Pass" : "Fail") : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  }))

  return (
    <div>
      <PageHeader
        title="My KPIs"
        description={`Evaluation Period: ${activePeriod?.name || "None"}`}
      />
      <KpiStatusGrid
        kpis={kpiRows}
        onRowClick={(code: string) => {
          const assignment = assignments?.find((a: { kpiDefinition: { code: string } }) => a.kpiDefinition.code === code)
          if (assignment) router.push(`/kpis/${assignment.id}`)
        }}
      />
    </div>
  )
}
