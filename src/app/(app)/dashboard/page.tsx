"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMyScores } from "@/hooks/useScoring"
import { useMyAssignments } from "@/hooks/useKpis"
import { useQuery } from "@tanstack/react-query"
import { tierWord } from "@/components/dashboard/ProfileCard"
import { ScorecardHero, type HeroFact } from "@/components/dashboard/ScorecardHero"
import { kpiStats, kpiCountsByPillar } from "@/components/dashboard/scorecard-stats"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { PillarKpiDetail } from "@/components/dashboard/PillarKpiDetail"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { AdminInsightsDashboard } from "@/components/dashboard/AdminInsightsDashboard"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHead } from "@/components/ui/PageHead"
import { SelectWrap } from "@/components/ui/Field"
import { TIER_LABELS, ROLE_LABELS, STRONG_THRESHOLD } from "@/lib/constants"
import type { PillarCode } from "@/types"
import type { AppraisalBand, Role, Tier } from "@prisma/client"

interface MeData {
  firstName: string
  lastName: string
  email: string
  role: Role
  tier: Tier
  jobTitle: string | null
  avatarUrl: string | null
  employeeId: string | null
  functionProject: string | null
}

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

const PILLAR_DETAIL_ID = "pillar-kpi-detail"

/** "Q1 2025 (active)" — the state rides in the option text, lower case. */
function periodOptionLabel(p: Period): string {
  return `${p.name}${p.isClosed ? " (closed)" : p.isActive ? " (active)" : ""}`
}

export default function DashboardPage() {
  const { data: session } = useSession()

  // Admin gets the org-wide insights dashboard — no personal KPIs
  if (session?.user?.role === "ADMIN") {
    return <AdminInsightsDashboard />
  }

  return <UserDashboard />
}

function UserDashboard() {
  const { data: session } = useSession()
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
  // Same query (and cache entry) the profile card used.
  const { data: me } = useQuery<MeData>({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) throw new Error("Failed")
      return (await res.json()).data
    },
  })

  const tier = session?.user?.tier
  const sub = [selectedPeriod?.name, tier ? TIER_LABELS[tier as keyof typeof TIER_LABELS] : undefined]
    .filter(Boolean)
    .join(" · ")

  const periodPicker =
    periods && periods.length > 1 ? (
      <>
        <label htmlFor="dashboard-period" className="sr-only">
          Evaluation period
        </label>
        <SelectWrap>
          <select
            id="dashboard-period"
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

  const head = <PageHead title="Dashboard" sub={sub || undefined} actions={periodPicker} />

  if (periodsLoading || scoresLoading || assignmentsLoading) {
    return (
      <>
        {head}
        <LoadingSpinner />
      </>
    )
  }

  const overallSnapshot = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  const toKpiRow = (a: Assignment) => ({
    code: a.kpiDefinition.code,
    name: a.kpiDefinition.name,
    target: a.targetOverride ?? a.kpiDefinition.targets?.[0]?.targetValue ?? "—",
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

  const firstName = me?.firstName || session?.user?.firstName || ""
  const lastName = me?.lastName || session?.user?.lastName || ""
  const role = me?.role || session?.user?.role
  const userTier = me?.tier || session?.user?.tier
  const facts: HeroFact[] = []
  if (me?.employeeId) facts.push({ label: "Employee ID", value: <span className="tabular">#{me.employeeId}</span> })
  if (userTier) facts.push({ label: "Tier", value: tierWord(userTier) })
  if (role) facts.push({ label: "Role", value: ROLE_LABELS[role] })
  if (me?.functionProject) facts.push({ label: "Function", value: me.functionProject })
  if (selectedPeriod) facts.push({ label: "Period", value: selectedPeriod.name })

  const counts = kpiCountsByPillar(allKpiRows)

  return (
    <>
      {head}

      <ScorecardHero
        firstName={firstName}
        lastName={lastName}
        avatarUrl={me?.avatarUrl || session?.user?.avatarUrl}
        heading={`${firstName} ${lastName}`.trim() || "Your scorecard"}
        sub={[me?.jobTitle || (userTier ? TIER_LABELS[userTier as keyof typeof TIER_LABELS] : null), me?.email || session?.user?.email]
          .filter(Boolean)
          .join(" · ")}
        facts={facts}
        score={overallSnapshot?.overallScore ?? null}
        band={(overallSnapshot?.appraisalBand as AppraisalBand) ?? null}
        pillars={pillarSnapshots.map((s: { pillarCode: string; pillarPercent: number }) => ({
          code: s.pillarCode,
          percent: s.pillarPercent,
        }))}
        kpis={kpiStats(allKpiRows)}
      />

      <div className="section-row">
        <h2 className="section-head">Pillars</h2>
        <span className="section-note">
          Select a pillar to see its KPIs · the mark on each bar is the {STRONG_THRESHOLD}% strong line
        </span>
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
              kpiCount={counts[code]?.count ?? 0}
              belowTarget={counts[code]?.below ?? 0}
              isExpanded={expandedPillar === code}
              onClick={() => handlePillarClick(code)}
              controls={PILLAR_DETAIL_ID}
            />
          )
        })}
      </div>

      {expandedPillar && (
        <PillarKpiDetail id={PILLAR_DETAIL_ID} pillarCode={expandedPillar} kpis={expandedPillarKpis} />
      )}

      <KpiStatusGrid kpis={allKpiRows} title="Your KPIs in this period" />
    </>
  )
}
