"use client"

import { useTeamMembers } from "@/hooks/useTeam"
import { useActivePeriod } from "@/hooks/usePeriods"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"
import { TIER_LABELS, PILLARS } from "@/lib/constants"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { PillarCode } from "@/types"

export default function TeamOverviewPage() {
  const router = useRouter()
  const { data: members, isLoading: membersLoading } = useTeamMembers()
  const { data: activePeriod } = useActivePeriod()

  const { data: allScores } = useQuery({
    queryKey: ["scoring", "all", activePeriod?.id],
    queryFn: async () => {
      if (!members?.length || !activePeriod?.id) return []
      const results = await Promise.all(
        members.map(async (m: { id: string }) => {
          const res = await fetch(`/api/kpis/scoring?userId=${m.id}&evalPeriodId=${activePeriod.id}`)
          if (!res.ok) return { userId: m.id, scores: [] }
          const json = await res.json()
          return { userId: m.id, scores: json.data || [] }
        })
      )
      return results
    },
    enabled: !!members?.length && !!activePeriod?.id,
  })

  if (membersLoading) return <LoadingSpinner />

  const pillars: PillarCode[] = ["A", "B", "C", "D", "E", "F"]

  return (
    <div>
      <PageHeader
        title="Team Overview"
        description={`${members?.length || 0} members — ${activePeriod?.name || "No period"}`}
      />

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary">
              <th className="px-4 py-3 font-medium text-foreground-secondary">Member</th>
              <th className="px-4 py-3 font-medium text-foreground-secondary">Tier</th>
              {pillars.map((p) => (
                <th key={p} className="px-3 py-3 text-center font-medium text-foreground-secondary" style={{ color: PILLARS[p].color }}>
                  {p}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-medium text-foreground-secondary">Overall</th>
              <th className="px-4 py-3 text-center font-medium text-foreground-secondary">Band</th>
            </tr>
          </thead>
          <tbody>
            {(members || []).map((member: { id: string; firstName: string; lastName: string; tier: string; isActive: boolean }) => {
              const userScores = allScores?.find((s: { userId: string }) => s.userId === member.id)?.scores || []
              const overall = userScores.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")

              return (
                <tr
                  key={member.id}
                  onClick={() => router.push(`/manager/members/${member.id}`)}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-card-hover"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary text-xs">
                    {TIER_LABELS[member.tier as keyof typeof TIER_LABELS]}
                  </td>
                  {pillars.map((p) => {
                    const snap = userScores.find((s: { pillarCode: string }) => s.pillarCode === p)
                    return (
                      <td key={p} className="px-3 py-3 text-center font-mono text-sm">
                        {snap ? `${Math.round(snap.pillarPercent)}%` : "—"}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                    {overall ? `${Math.round(overall.overallScore)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {overall?.appraisalBand ? (
                      <Badge variant={overall.appraisalBand === "EXCEEDS" || overall.appraisalBand === "STRONG" ? "success" : overall.appraisalBand === "MEETS" ? "warning" : "danger"}>
                        {overall.appraisalBand}
                      </Badge>
                    ) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
