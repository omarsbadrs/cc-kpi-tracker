"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useUserDetail } from "@/hooks/useTeam"
import { useUserScores } from "@/hooks/useScoring"
import { usePeriods } from "@/hooks/usePeriods"
import { OverallScoreCard } from "@/components/dashboard/OverallScoreCard"
import { PillarCard } from "@/components/dashboard/PillarCard"
import { KpiStatusGrid } from "@/components/dashboard/KpiStatusGrid"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, ROLE_LABELS } from "@/lib/constants"
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

  if (userLoading || periodsLoading) return <LoadingSpinner />

  const overall = scores?.find((s: { pillarCode: string }) => s.pillarCode === "OVERALL")
  const pillarSnapshots = scores?.filter((s: { pillarCode: string }) => s.pillarCode !== "OVERALL") || []

  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase()

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

  return (
    <div className="space-y-6">
      {/* Profile card + period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="glass-card animate-card-in flex-1 p-5">
          <div className="flex items-center gap-5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 text-xl font-bold text-white ring-2 ring-border">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="mt-0.5 truncate text-sm text-foreground-muted">
                {user?.jobTitle || TIER_LABELS[user?.tier as keyof typeof TIER_LABELS] || user?.tier}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {user?.employeeId && (
                  <span className="profile-badge profile-badge-id">#{user.employeeId}</span>
                )}
                {user?.role && (
                  <span className="profile-badge profile-badge-role">
                    {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                  </span>
                )}
                {user?.tier && (
                  <span className="profile-badge profile-badge-tier">
                    {(user.tier as string).replace("_", " ")}
                  </span>
                )}
                {user?.email && (
                  <span className="profile-badge profile-badge-dept">{user.email}</span>
                )}
                {selectedPeriod && (
                  <span className="profile-badge profile-badge-period">{selectedPeriod.name}</span>
                )}
              </div>
            </div>
          </div>
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
      {(scoresLoading || assignmentsLoading) ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <OverallScoreCard
                score={overall?.overallScore ?? 0}
                band={(overall?.appraisalBand as AppraisalBand) ?? "UNSATISFACTORY"}
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

          {/* KPI grid */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">KPIs for this period</h2>
            <KpiStatusGrid kpis={kpiRows} />
          </div>
        </>
      )}
    </div>
  )
}
