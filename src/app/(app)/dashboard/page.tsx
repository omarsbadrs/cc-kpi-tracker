"use client"

import { useState, useEffect } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMyScores } from "@/hooks/useScoring"
import { useMyAssignments } from "@/hooks/useKpis"
import { ProfileCard } from "@/components/dashboard/ProfileCard"
import { OverallScoreCard } from "@/components/dashboard/OverallScoreCard"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { PillarKpiDetail } from "@/components/dashboard/PillarKpiDetail"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import type { PillarCode } from "@/types"
import type { AppraisalBand } from "@prisma/client"

interface Period {
  id: string
  name: string
  isActive: boolean
  isClosed: boolean
}

interface Assignment {
  id: string
  kpiDefinition: {
    code: string
    name: string
    pillar?: { code: string; name: string }
    targets?: Array<{ targetValue: number }>
  }
  targetOverride: number | null
  actuals: Array<{
    actualValue: number | null
    binaryValue: boolean | null
    score: number | null
    status: string
  }>
}

export default function DashboardPage() {
  const { data: periods, isLoading: periodsLoading } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  // Auto-select the first active+open period, or the first period available
  useEffect(() => {
    if (periods?.length && !selectedPeriodId) {
      const activeOpen = periods.find((p: Period) => p.isActive && !p.isClosed)
      setSelectedPeriodId(activeOpen?.id || periods[0]?.id || "")
    }
  }, [periods, selectedPeriodId])

  const periodId = selectedPeriodId || undefined
  const selectedPeriod = periods?.find((p: Period) => p.id === selectedPeriodId)
  const { data: scores, isLoading: scoresLoading } = useMyScores(periodId)
  const { data: assignments, isLoading: assignmentsLoading } = useMyAssignments(periodId)
  const [expandedPillar, setExpandedPillar] = useState<PillarCode | null>(null)

  if (periodsLoading || scoresLoading || assignmentsLoading) {
    return <LoadingSpinner />
  }

  const overallSnapshot = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  const toKpiRow = (a: Assignment) => ({
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? "\u2014",
    actual: a.actuals?.[0]?.actualValue ?? (a.actuals?.[0]?.binaryValue !== null ? (a.actuals?.[0]?.binaryValue ? "Pass" : "Fail") : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  })

  const allKpiRows = (assignments || []).map((a: Assignment) => toKpiRow(a))

  const expandedPillarKpis = expandedPillar
    ? (assignments || [])
        .filter((a: Assignment) => a.kpiDefinition.code.startsWith(expandedPillar))
        .map((a: Assignment) => toKpiRow(a))
    : []

  const handlePillarClick = (code: PillarCode) => {
    setExpandedPillar(expandedPillar === code ? null : code)
  }

  return (
    <div className="space-y-6">
      {/* Profile Card + Period Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <ProfileCard periodName={selectedPeriod?.name} />
        </div>
        {periods && periods.length > 1 && (
          <div className="shrink-0">
            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
              Evaluation Period
            </label>
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

      {/* Score overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <OverallScoreCard
            score={overallSnapshot?.overallScore ?? 0}
            band={(overallSnapshot?.appraisalBand as AppraisalBand) ?? "UNSATISFACTORY"}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
          {(["A", "B", "C", "D", "E", "F"] as PillarCode[]).map((code) => {
            const snap = pillarSnapshots.find((s: { pillarCode: string }) => s.pillarCode === code)
            return (
              <PillarCard
                key={code}
                pillarCode={code}
                percent={snap?.pillarPercent ?? 0}
                score5={snap?.pillarScore ?? 0}
                isExpanded={expandedPillar === code}
                onClick={() => handlePillarClick(code)}
              />
            )
          })}
        </div>
      </div>

      {/* Expanded pillar detail */}
      {expandedPillar && (
        <PillarKpiDetail
          pillarCode={expandedPillar}
          kpis={expandedPillarKpis}
        />
      )}

      {/* KPI grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Your top KPIs in this period</h2>
        <KpiStatusGrid kpis={allKpiRows} />
      </div>
    </div>
  )
}
