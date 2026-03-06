"use client"

import { useState, useEffect } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMyAssignments } from "@/hooks/useKpis"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { useRouter } from "next/navigation"

interface Period {
  id: string
  name: string
  isActive: boolean
  isClosed: boolean
}

export default function MyKpisPage() {
  const router = useRouter()
  const { data: periods, isLoading: periodsLoading } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  useEffect(() => {
    if (periods?.length && !selectedPeriodId) {
      const activeOpen = periods.find((p: Period) => p.isActive && !p.isClosed)
      setSelectedPeriodId(activeOpen?.id || periods[0]?.id || "")
    }
  }, [periods, selectedPeriodId])

  const selectedPeriod = periods?.find((p: Period) => p.id === selectedPeriodId)
  const { data: assignments, isLoading } = useMyAssignments(selectedPeriodId || undefined)

  if (periodsLoading || isLoading) return <LoadingSpinner />

  const kpiRows = (assignments || []).map((a: {
    id: string;
    kpiDefinition: { code: string; name: string; targets?: Array<{ targetValue: number }> };
    targetOverride: number | null;
    actuals: Array<{ actualValue: number | null; binaryValue: boolean | null; score: number | null; status: string }>;
  }) => ({
    id: a.id,
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? "—",
    actual: a.actuals?.[0]?.actualValue ?? (a.actuals?.[0]?.binaryValue !== null ? (a.actuals?.[0]?.binaryValue ? "Pass" : "Fail") : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  }))

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="My KPIs"
          description={`Evaluation Period: ${selectedPeriod?.name || "None"}`}
        />
        {periods && periods.length > 1 && (
          <div className="shrink-0 pb-4">
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
            >
              {(periods || []).map((p: Period) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isClosed ? "(Closed)" : p.isActive ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
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
