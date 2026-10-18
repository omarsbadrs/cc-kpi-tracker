"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useUserDetail } from "@/hooks/useTeam"
import { useUserScores } from "@/hooks/useScoring"
import { usePeriods } from "@/hooks/usePeriods"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { tierWord } from "@/components/dashboard/ProfileCard"
import { ScorecardHero, type HeroFact } from "@/components/dashboard/ScorecardHero"
import { kpiStats, kpiCountsByPillar } from "@/components/dashboard/scorecard-stats"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHead } from "@/components/ui/PageHead"
import { SelectWrap } from "@/components/ui/Field"
import { TIER_LABELS, ROLE_LABELS, STRONG_THRESHOLD } from "@/lib/constants"
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

function periodOptionLabel(p: Period): string {
  return `${p.name}${p.isClosed ? " (closed)" : p.isActive ? " (active)" : ""}`
}

export default function MemberDetailPage() {
  const { id } = useParams() as { id: string }
  const { data: user, isLoading: userLoading } = useUserDetail(id)
  const { data: periods, isLoading: periodsLoading } = usePeriods()
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  useEffect(() => {
    if (periods?.length && !selectedPeriodId) {
      const activeOpen = periods.find((p: Period) => p.isActive && !p.isClosed)
      setSelectedPeriodId(activeOpen?.id || periods[0]?.id || "")
    }
  }, [periods, selectedPeriodId])

  const periodId = selectedPeriodId || undefined
  const selectedPeriod = periods?.find((p: Period) => p.id === selectedPeriodId)

  const { data: scores, isLoading: scoresLoading } = useUserScores(id, periodId)

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["kpis", "assignments", id, periodId],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: id, pageSize: "100" })
      if (periodId) params.set("evalPeriodId", periodId)
      const res = await fetch(`/api/kpis/assignments?${params}`)
      if (!res.ok) throw new Error("Failed to fetch assignments")
      const json = await res.json()
      return json.data as Assignment[]
    },
    enabled: !!id && !!periodId,
  })

  const back = { href: "/manager/members", label: "Team members" }

  if (userLoading || periodsLoading) {
    return (
      <>
        <PageHead back={back} title="Team member" />
        <LoadingSpinner />
      </>
    )
  }

  const overall = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Team member"
  const jobTitle: string | undefined =
    user?.jobTitle || TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier || undefined

  const facts: HeroFact[] = []
  if (user?.employeeId) facts.push({ label: "Employee ID", value: <span className="tabular">#{user.employeeId}</span> })
  if (user?.tier) facts.push({ label: "Tier", value: tierWord(user.tier as string) })
  if (user?.role) facts.push({ label: "Role", value: ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role })
  if (selectedPeriod) facts.push({ label: "Period", value: selectedPeriod.name })

  const kpiRows = (assignments || []).map((a: Assignment) => ({
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? "—",
    actual:
      a.actuals?.[0]?.actualValue ??
      (a.actuals?.[0]?.binaryValue !== null && a.actuals?.[0]?.binaryValue !== undefined
        ? a.actuals[0].binaryValue
          ? "Pass"
          : "Fail"
        : null),
    score: a.actuals?.[0]?.score ?? null,
    status: a.actuals?.[0]?.status ?? "DRAFT",
  }))
  const pillarCounts = kpiCountsByPillar(kpiRows)

  return (
    <>
      <PageHead
        back={back}
        title={fullName}
        sub={[jobTitle, selectedPeriod?.name].filter(Boolean).join(" · ") || undefined}
        actions={
          periods && periods.length > 1 ? (
            <>
              <label htmlFor="member-period" className="sr-only">
                Evaluation period
              </label>
              <SelectWrap>
                <select
                  id="member-period"
                  className="select"
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                >
                  {(periods || []).map((p: Period) => (
                    <option key={p.id} value={p.id}>
                      {periodOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </SelectWrap>
            </>
          ) : undefined
        }
      />

      {scoresLoading || assignmentsLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <ScorecardHero
            firstName={user?.firstName}
            lastName={user?.lastName}
            avatarUrl={user?.avatarUrl}
            heading={jobTitle ?? fullName}
            sub={user?.email}
            facts={facts}
            score={overall?.overallScore ?? null}
            band={(overall?.appraisalBand as AppraisalBand) ?? null}
            pillars={pillarSnapshots.map((s: { pillarCode: string; pillarPercent: number }) => ({
              code: s.pillarCode,
              percent: s.pillarPercent,
            }))}
            kpis={kpiStats(kpiRows)}
          />

          <div className="section-row">
            <h2 className="section-head">Pillars</h2>
            <span className="section-note">The mark on each bar is the {STRONG_THRESHOLD}% strong line</span>
          </div>
          <div className="pillar-grid">
            {(["A", "B", "C", "D", "E", "F"] as PillarCode[]).map((code) => {
              const snap = pillarSnapshots.find((s: { pillarCode: string }) => s.pillarCode === code)
              return (
                <PillarCard
                  key={code}
                  pillarCode={code}
                  percent={snap?.pillarPercent ?? 0}
                  score5={snap?.pillarScore ?? 0}
                  scored={!!snap}
                  kpiCount={pillarCounts[code]?.count ?? 0}
                  belowTarget={pillarCounts[code]?.below ?? 0}
                />
              )
            })}
          </div>

          <KpiStatusGrid kpis={kpiRows} title="KPIs for this period" />
        </>
      )}
    </>
  )
}
