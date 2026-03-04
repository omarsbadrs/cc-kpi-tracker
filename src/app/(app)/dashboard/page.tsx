"use client"

import { useSession } from "next-auth/react"
import { useActivePeriod } from "@/hooks/usePeriods"
import { useMyScores } from "@/hooks/useScoring"
import { useMyAssignments } from "@/hooks/useKpis"
import { OverallScoreCard } from "@/components/dashboard/OverallScoreCard"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { TIER_LABELS } from "@/lib/constants"
import type { PillarCode } from "@/types"
import type { AppraisalBand } from "@prisma/client"

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: activePeriod, isLoading: periodLoading } = useActivePeriod()
  const periodId = activePeriod?.id
  const { data: scores, isLoading: scoresLoading } = useMyScores(periodId)
  const { data: assignments, isLoading: assignmentsLoading } = useMyAssignments(periodId)

  if (periodLoading || scoresLoading || assignmentsLoading) {
    return <LoadingSpinner />
  }

  const overallSnapshot = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  const kpiRows = (assignments || []).map((a: {
    kpiDefinition: { code: string; name: string };
    targetOverride: number | null;
    actuals: Array<{ actualValue: number | null; binaryValue: boolean | null; score: number | null; status: string }>;
  }) => ({
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? "—",
    actual: a.actuals?.[0]?.actualValue ?? (a.actuals?.[0]?.binaryValue !== null ? (a.actuals?.[0]?.binaryValue ? "Pass" : "Fail") : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session?.user?.firstName || "User"}`}
        description={`${TIER_LABELS[session?.user?.tier || "ENGINEER"]} — ${activePeriod?.name || "No active period"}`}
      />

      {/* Score Overview */}
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
              />
            )
          })}
        </div>
      </div>

      {/* KPI Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">My KPIs</h2>
        <KpiStatusGrid kpis={kpiRows} />
      </div>
    </div>
  )
}
