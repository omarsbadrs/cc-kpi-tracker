"use client"

import { useTeamMembers } from "@/hooks/useTeam"
import { useActivePeriod } from "@/hooks/usePeriods"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, PILLARS, APPRAISAL_BANDS } from "@/lib/constants"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import type { PillarCode } from "@/types"

function getPillarCellStyle(percent: number): { bg: string; text: string } {
  if (percent >= 90) return { bg: "rgba(34,197,94,0.15)",  text: "#22c55e" }
  if (percent >= 80) return { bg: "rgba(132,204,22,0.15)", text: "#84cc16" }
  if (percent >= 70) return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" }
  if (percent >= 60) return { bg: "rgba(249,115,22,0.15)", text: "#f97316" }
  if (percent >= 40) return { bg: "rgba(239,68,68,0.15)",  text: "#ef4444" }
  return                      { bg: "rgba(153,27,27,0.20)", text: "#fca5a5" }
}

export default function TeamOverviewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { data: allMembers, isLoading: membersLoading } = useTeamMembers()
  const { data: activePeriod } = useActivePeriod()

  // Exclude the current manager/admin from the list — they are the viewer, not a report
  const members = (allMembers ?? []).filter(
    (m) => m.id !== session?.user?.id && m.role !== "ADMIN"
  )

  const { data: allScores } = useQuery({
    queryKey: ["scoring", "all", activePeriod?.id, members.map((m) => m.id)],
    queryFn: async () => {
      if (!members.length || !activePeriod?.id) return []
      const results = await Promise.all(
        members.map(async (m) => {
          const res = await fetch(`/api/kpis/scoring?userId=${m.id}&evalPeriodId=${activePeriod.id}`)
          if (!res.ok) return { userId: m.id, scores: [] }
          const json = await res.json()
          return { userId: m.id, scores: json.data || [] }
        })
      )
      return results
    },
    enabled: !!members.length && !!activePeriod?.id,
  })

  if (membersLoading) return <LoadingSpinner />

  const pillars: PillarCode[] = ["A", "B", "C", "D", "E", "F"]

  return (
    <div>
      <PageHeader
        title="Team Overview"
        description={`${members.length} active member${members.length !== 1 ? "s" : ""} — ${activePeriod?.name || "No active period"}`}
      />

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-card-border bg-card-bg py-16 text-center">
          <p className="text-sm text-foreground-muted">No team members found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background-secondary">
                <th className="px-4 py-3 font-medium text-foreground-secondary">Member</th>
                <th className="px-4 py-3 font-medium text-foreground-secondary">Tier</th>
                {pillars.map((p) => (
                  <th
                    key={p}
                    className="px-3 py-3 text-center font-medium"
                    style={{ color: PILLARS[p].color }}
                  >
                    {p}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium text-foreground-secondary">Overall</th>
                <th className="px-4 py-3 text-center font-medium text-foreground-secondary">Band</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const userScores = allScores?.find((s) => s.userId === member.id)?.scores || []
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
                    <td className="px-4 py-3 text-xs text-foreground-secondary">
                      {TIER_LABELS[member.tier as keyof typeof TIER_LABELS]}
                    </td>
                    {pillars.map((p) => {
                      const snap = userScores.find((s: { pillarCode: string }) => s.pillarCode === p)
                      if (!snap) {
                        return (
                          <td key={p} className="px-3 py-3 text-center text-foreground-muted">—</td>
                        )
                      }
                      const { bg, text } = getPillarCellStyle(snap.pillarPercent)
                      return (
                        <td key={p} className="px-2 py-2 text-center">
                          <div
                            className="inline-flex flex-col items-center rounded-lg px-2.5 py-1.5"
                            style={{ backgroundColor: bg }}
                          >
                            <span className="font-mono text-sm font-bold leading-tight" style={{ color: text }}>
                              {Math.round(snap.pillarPercent)}%
                            </span>
                            <span className="font-mono text-xs leading-tight" style={{ color: text, opacity: 0.75 }}>
                              {(snap.pillarScore as number).toFixed(1)}/5
                            </span>
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center">
                      {overall ? (() => {
                        const { bg, text } = getPillarCellStyle(overall.overallScore)
                        return (
                          <div
                            className="inline-flex items-center rounded-lg px-3 py-1.5"
                            style={{ backgroundColor: bg }}
                          >
                            <span className="font-mono text-sm font-bold" style={{ color: text }}>
                              {Math.round(overall.overallScore)}%
                            </span>
                          </div>
                        )
                      })() : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {overall?.appraisalBand ? (() => {
                        const bandInfo = APPRAISAL_BANDS[overall.appraisalBand as keyof typeof APPRAISAL_BANDS]
                        return (
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: bandInfo.color + "20", color: bandInfo.color }}
                          >
                            {bandInfo.label}
                          </span>
                        )
                      })() : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
