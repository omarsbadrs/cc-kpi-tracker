"use client"

import { useParams } from "next/navigation"
import { useUserDetail } from "@/hooks/useTeam"
import { useUserScores } from "@/hooks/useScoring"
import { useActivePeriod } from "@/hooks/usePeriods"
import { OverallScoreCard } from "@/components/dashboard/OverallScoreCard"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS } from "@/lib/constants"
import type { PillarCode } from "@/types"
import type { AppraisalBand } from "@prisma/client"

export default function MemberDetailPage() {
  const { id } = useParams() as { id: string }
  const { data: user, isLoading: userLoading } = useUserDetail(id)
  const { data: period } = useActivePeriod()
  const { data: scores, isLoading: scoresLoading } = useUserScores(id, period?.id)

  if (userLoading || scoresLoading) return <LoadingSpinner />

  const overall = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user?.firstName} ${user?.lastName}`}
        description={`${TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier} — ${user?.jobTitle || ""}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <OverallScoreCard
          score={overall?.overallScore ?? 0}
          band={(overall?.appraisalBand as AppraisalBand) ?? "UNSATISFACTORY"}
        />
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
    </div>
  )
}
