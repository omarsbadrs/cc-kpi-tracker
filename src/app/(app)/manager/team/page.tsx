"use client"

import { useState, type KeyboardEvent } from "react"
import { useTeamMembers } from "@/hooks/useTeam"
import { useActivePeriod } from "@/hooks/usePeriods"
import { PageHead } from "@/components/ui/PageHead"
import { ChipRow } from "@/components/ui/Segmented"
import { BandChip, TagPill } from "@/components/ui/StatusChip"
import { PillarTag } from "@/components/ui/KpiMarks"
import { UserAvatar } from "@/components/layout/UserMenu"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { TIER_LABELS, TIER_SHORT, PILLARS, APPRAISAL_BANDS } from "@/lib/constants"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Users } from "lucide-react"
import type { AppraisalBand } from "@prisma/client"
import type { PillarCode } from "@/types"
import "@/styles/views/manager-team.css"

interface ScoreSnap {
  pillarCode: string
  pillarScore: number
  pillarPercent: number
  overallScore: number | null
  appraisalBand: AppraisalBand | null
}

// Short column heads; the full pillar name is the header's title.
const PILLAR_SHORT: Record<PillarCode, string> = {
  A: "Delivery",
  B: "Data quality",
  C: "Forecasting",
  D: "Communication",
  E: "Attendance",
  F: "Growth",
}

// The cell tint follows the appraisal band the % falls in, so it agrees with
// the Band column. The written figure is always the signal.
function heatClass(percent: number): string {
  if (percent >= APPRAISAL_BANDS.EXCEEDS.min) return "heat-ok"
  if (percent >= APPRAISAL_BANDS.STRONG.min) return "heat-info"
  if (percent >= APPRAISAL_BANDS.MEETS.min) return "heat-meets"
  if (percent >= APPRAISAL_BANDS.NEEDS_IMPROVEMENT.min) return "heat-warn"
  return "heat-bad"
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export default function TeamOverviewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { data: allMembers, isLoading: membersLoading } = useTeamMembers()
  const { data: activePeriod } = useActivePeriod()
  const [tierFilter, setTierFilter] = useState("")

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
          if (!res.ok) return { userId: m.id, scores: [] as ScoreSnap[] }
          const json = await res.json()
          return { userId: m.id, scores: (json.data || []) as ScoreSnap[] }
        })
      )
      return results
    },
    enabled: !!members.length && !!activePeriod?.id,
  })

  if (membersLoading) return <LoadingSpinner />

  const pillars: PillarCode[] = ["A", "B", "C", "D", "E", "F"]
  const tiers = Array.from(new Set(members.map((m) => m.tier)))
  const shown = tierFilter ? members.filter((m) => m.tier === tierFilter) : members
  const scoredCount = (allScores ?? []).filter((s) => s.scores.some((x) => x.pillarCode === "OVERALL")).length

  const open = (id: string) => router.push(`/manager/members/${id}`)
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open(id)
    }
  }

  const sub = [
    plural(members.length, "active member"),
    activePeriod?.name || "No active period",
    ...(members.length > 0 && activePeriod ? [`${scoredCount} scored`] : []),
  ].join(" · ")

  return (
    <>
      <PageHead title="Team overview" sub={sub} />

      {members.length === 0 ? (
        <div className="card-list">
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="People who report to you appear here once an admin links them to you."
          />
        </div>
      ) : (
        <>
          {tiers.length > 1 && (
            <ChipRow
              label="Tier"
              value={tierFilter}
              onChange={setTierFilter}
              options={[
                { value: "", label: "All tiers" },
                ...tiers.map((t) => ({ value: t, label: TIER_SHORT[t] ?? t })),
              ]}
            />
          )}

          <section className="card list-card" aria-labelledby="team-heatmap-title">
            <div className="card-head">
              <h2 className="card-title" id="team-heatmap-title">Pillar scores</h2>
              <span className="side-note">Select a member to open their scorecard</span>
            </div>

            <div className="table-scroll" tabIndex={0} role="region" aria-label="Team pillar scores">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    {pillars.map((p) => (
                      <th key={p} scope="col" className="num" title={PILLARS[p].name}>
                        <span className="team-pillar-head">
                          <PillarTag code={p} />
                          {PILLAR_SHORT[p]}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="num">Overall</th>
                    <th scope="col">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((member) => {
                    const userScores = allScores?.find((s) => s.userId === member.id)?.scores || []
                    const overall = userScores.find((s) => s.pillarCode === "OVERALL")
                    const name = `${member.firstName} ${member.lastName}`

                    return (
                      <tr
                        key={member.id}
                        className="clickable"
                        tabIndex={0}
                        title={`Open ${name}'s scorecard`}
                        onClick={() => open(member.id)}
                        onKeyDown={(e) => onRowKey(e, member.id)}
                      >
                        <th scope="row" style={{ fontWeight: "inherit" }}>
                          <span className="team-person">
                            <UserAvatar
                              firstName={member.firstName}
                              lastName={member.lastName}
                              avatarUrl={member.avatarUrl}
                            />
                            <span>{name}</span>
                            <span title={TIER_LABELS[member.tier as keyof typeof TIER_LABELS]}>
                              <TagPill>{TIER_SHORT[member.tier] ?? member.tier}</TagPill>
                            </span>
                          </span>
                        </th>
                        {pillars.map((p) => {
                          const snap = userScores.find((s) => s.pillarCode === p)
                          if (!snap) {
                            return (
                              <td key={p} className="num muted">
                                —<span className="sr-only">Not scored</span>
                              </td>
                            )
                          }
                          return (
                            <td key={p} className={`num heat ${heatClass(snap.pillarPercent)}`}>
                              <span className="heat-pct">{Math.round(snap.pillarPercent)}%</span>
                              <span className="heat-sub">{snap.pillarScore.toFixed(1)}/5</span>
                            </td>
                          )
                        })}
                        {overall && overall.overallScore !== null ? (
                          <td className={`num heat ${heatClass(overall.overallScore)}`}>
                            <span className="heat-pct">{Math.round(overall.overallScore)}%</span>
                          </td>
                        ) : (
                          <td className="num muted">—</td>
                        )}
                        <td>
                          {overall?.appraisalBand ? (
                            <BandChip band={overall.appraisalBand} small />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="list-foot">
              <span>
                {shown.length === members.length
                  ? plural(members.length, "member")
                  : `${shown.length} of ${plural(members.length, "member")} shown`}
              </span>
              <span>Shading follows the appraisal band of each figure</span>
            </div>
          </section>
        </>
      )}
    </>
  )
}
