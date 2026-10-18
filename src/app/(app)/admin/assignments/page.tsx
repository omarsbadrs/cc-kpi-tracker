"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useKpiDefinitions } from "@/hooks/useKpis"
import { usePeriods } from "@/hooks/usePeriods"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { Field, SelectWrap } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { PillarTag } from "@/components/ui/KpiMarks"
import { useToast } from "@/components/ui/Toast"
import { PILLARS, PILLAR_CODES, TIER_SHORT } from "@/lib/constants"
import { UserCheck } from "lucide-react"

interface KpiOption {
  id: string
  code: string
  name: string
  pillar?: { code: string; name: string } | null
}

interface UserOption {
  id: string
  firstName: string
  lastName: string
  tier: string
  role: string
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export default function AssignmentsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: kpis } = useKpiDefinitions()
  const { data: periods } = usePeriods()
  const [selectedPeriod, setSelectedPeriod] = useState("")

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", "all"],
    queryFn: async () => {
      const res = await fetch("/api/users?pageSize=100&isActive=true")
      if (!res.ok) throw new Error("Failed")
      return (await res.json()).data
    },
  })

  // Fetch existing assignments for the selected period to know who's already assigned
  const { data: existingAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["admin", "assignments", "existing", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/assignments?userId=all&evalPeriodId=${selectedPeriod}&pageSize=5000`)
      if (!res.ok) throw new Error("Failed")
      return (await res.json()).data as { userId: string }[]
    },
    enabled: !!selectedPeriod,
  })

  // Set of userIds that already have at least one assignment this period
  const alreadyAssignedIds = new Set((existingAssignments ?? []).map((a) => a.userId))

  // Users who have NO assignments yet for this period
  const unassignedUsers: UserOption[] = (users ?? []).filter(
    (u: UserOption) => u.role !== "ADMIN" && !alreadyAssignedIds.has(u.id)
  )

  const bulkAssign = useMutation({
    mutationFn: async (data: { userIds: string[]; kpiDefinitionIds: string[]; evalPeriodId: string }) => {
      const res = await fetch("/api/kpis/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to assign")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpis", "assignments"] })
    },
  })

  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedKpis, setSelectedKpis] = useState<string[]>([])

  // Clear user selection when period changes
  useEffect(() => { setSelectedUsers([]) }, [selectedPeriod])

  if (usersLoading) return <LoadingSpinner />

  const kpiList: KpiOption[] = kpis || []
  // Group the KPI checkboxes by pillar; anything without a pillar goes last.
  const groups = [
    ...PILLAR_CODES.map((code) => ({
      code: code as string,
      name: PILLARS[code].name as string,
      items: kpiList.filter((k) => k.pillar?.code === code),
    })),
    {
      code: "",
      name: "Other",
      items: kpiList.filter((k) => !k.pillar || !(PILLAR_CODES as readonly string[]).includes(k.pillar.code)),
    },
  ].filter((g) => g.items.length > 0)

  const canAssign = selectedUsers.length > 0 && selectedKpis.length > 0

  const assign = () => {
    if (bulkAssign.isPending || !canAssign) return
    bulkAssign.mutate(
      {
        userIds: selectedUsers,
        kpiDefinitionIds: selectedKpis,
        evalPeriodId: selectedPeriod,
      },
      {
        onSuccess: () => toast("Assignments created"),
        onError: () => toast("Could not assign KPIs. Check your connection", { icon: "alert" }),
      }
    )
  }

  return (
    <>
      <PageHead title="KPI assignments" sub="Assign KPIs to people for an evaluation period" />

      <div className="stack">
        {/* Period selector */}
        <section className="card">
          <div className="field-grid" style={{ maxWidth: 520 }}>
            <Field label="Evaluation period" htmlFor="assign-period">
              <SelectWrap>
                <select
                  id="assign-period"
                  className="select"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">Select period…</option>
                  {(periods || []).map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
          </div>
          {!selectedPeriod && (
            <p className="side-note">Choose a period to see who still needs KPIs.</p>
          )}
        </section>

        {selectedPeriod && (
          <div className="split even">
            {/* User selection */}
            <section className="card" style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h2 className="card-title flex flex-wrap items-center gap-2">
                  People
                  <TagPill>{unassignedUsers.length} unassigned</TagPill>
                </h2>
                {alreadyAssignedIds.size > 0 && (
                  <span className="side-note">{alreadyAssignedIds.size} already assigned</span>
                )}
              </div>
              {assignmentsLoading ? (
                <LoadingSpinner label="Loading people…" />
              ) : unassignedUsers.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="Everyone has KPIs"
                  description="All people already have KPIs assigned for this period."
                />
              ) : (
                <>
                  <div
                    className="flex flex-col gap-2"
                    role="group"
                    aria-label="People to assign"
                    style={{ maxHeight: 288, overflowY: "auto", paddingBlock: 2 }}
                  >
                    {unassignedUsers.map((u) => (
                      <label key={u.id} className="check-row">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.id)}
                          onChange={(e) => {
                            setSelectedUsers(
                              e.target.checked
                                ? [...selectedUsers, u.id]
                                : selectedUsers.filter((id) => id !== u.id)
                            )
                          }}
                        />
                        <span>
                          <span style={{ color: "var(--ink)" }}>{u.firstName} {u.lastName}</span>
                          <span className="muted"> · {TIER_SHORT[u.tier] ?? u.tier}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setSelectedUsers(unassignedUsers.map((u) => u.id))}
                    >
                      Select all people
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* KPI selection */}
            <section className="card" style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h2 className="card-title flex flex-wrap items-center gap-2">
                  KPIs
                  <TagPill>{selectedKpis.length} of {kpiList.length} selected</TagPill>
                </h2>
              </div>
              <div style={{ maxHeight: 288, overflowY: "auto" }}>
                {groups.map((g, i) => (
                  <div key={g.code || "other"} role="group" aria-labelledby={`kpi-group-${g.code || "other"}`}>
                    <h3
                      id={`kpi-group-${g.code || "other"}`}
                      className="form-section flex items-center gap-2"
                      style={i === 0 ? { borderTop: 0, paddingTop: 0 } : undefined}
                    >
                      {g.code && <PillarTag code={g.code} />}
                      <span className="min-w-0">{g.name}</span>
                    </h3>
                    <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
                      {g.items.map((k) => (
                        <label key={k.id} className="check-row">
                          <input
                            type="checkbox"
                            checked={selectedKpis.includes(k.id)}
                            onChange={(e) => {
                              setSelectedKpis(
                                e.target.checked
                                  ? [...selectedKpis, k.id]
                                  : selectedKpis.filter((id) => id !== k.id)
                              )
                            }}
                          />
                          <span>
                            <span className="kpi-code">{k.code}</span>{" "}
                            <span style={{ color: "var(--ink)" }}>{k.name}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelectedKpis(kpiList.map((k) => k.id))}
                >
                  Select all KPIs
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Assign button */}
        {selectedPeriod && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {bulkAssign.isSuccess && <StatusChip tone="ok">Assignments created</StatusChip>}
            <button
              type="button"
              className="btn btn-primary"
              onClick={assign}
              disabled={!canAssign && !bulkAssign.isPending}
              aria-disabled={bulkAssign.isPending || undefined}
              title={!canAssign ? "Select at least one person and one KPI" : undefined}
            >
              {bulkAssign.isPending
                ? "Assigning…"
                : `Assign ${plural(selectedKpis.length, "KPI", "KPIs")} to ${plural(selectedUsers.length, "person", "people")}`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
