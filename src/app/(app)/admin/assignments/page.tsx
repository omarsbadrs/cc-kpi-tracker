"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useKpiDefinitions } from "@/hooks/useKpis"
import { usePeriods } from "@/hooks/usePeriods"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"

export default function AssignmentsPage() {
  const queryClient = useQueryClient()
  const { data: kpis } = useKpiDefinitions()
  const { data: periods } = usePeriods()
  const [selectedPeriod, setSelectedPeriod] = useState("")

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", "all"],
    queryFn: async () => {
      const res = await fetch("/api/users?pageSize=100")
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
  const unassignedUsers = (users ?? []).filter(
    (u: { id: string; role: string }) => u.role !== "ADMIN" && !alreadyAssignedIds.has(u.id)
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

  return (
    <div>
      <PageHeader
        title="KPI Assignments"
        description="Assign KPIs to users for evaluation periods"
      />

      <div className="space-y-6">
        {/* Period selector */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
            Evaluation Period
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full max-w-md rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
          >
            <option value="">Select period...</option>
            {(periods || []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedPeriod && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* User selection */}
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground-muted">
                  Select Users
                  <span className="ml-2 rounded-full bg-background-secondary px-2 py-0.5 text-xs text-foreground-muted">
                    {unassignedUsers.length} unassigned
                  </span>
                </h3>
                {alreadyAssignedIds.size > 0 && (
                  <span className="text-xs text-foreground-muted/60">
                    {alreadyAssignedIds.size} already assigned
                  </span>
                )}
              </div>
              {assignmentsLoading ? (
                <div className="max-h-64 space-y-2 overflow-hidden py-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <div className="h-4 w-4 rounded bg-background-secondary animate-pulse" />
                      <div className="h-3.5 rounded bg-background-secondary animate-pulse" style={{ width: `${110 + i * 20}px` }} />
                      <div className="ml-1 h-3 w-14 rounded bg-background-secondary animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : unassignedUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground-muted">
                  All users already have KPIs assigned for this period.
                </p>
              ) : (
                <>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {unassignedUsers.map((u: { id: string; firstName: string; lastName: string; tier: string }) => (
                      <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-card-hover">
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
                          className="rounded border-border"
                        />
                        <span className="text-foreground">{u.firstName} {u.lastName}</span>
                        <span className="text-xs text-foreground-muted">({u.tier})</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedUsers(unassignedUsers.map((u: { id: string }) => u.id))}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-400"
                  >
                    Select all
                  </button>
                </>
              )}
            </div>

            {/* KPI selection */}
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="mb-3 text-sm font-medium text-foreground-muted">Select KPIs</h3>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {(kpis || []).map((k: { id: string; code: string; name: string }) => (
                  <label key={k.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-card-hover">
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
                      className="rounded border-border"
                    />
                    <span className="font-mono text-xs text-foreground-muted">{k.code}</span>
                    <span className="text-foreground">{k.name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setSelectedKpis(kpis?.map((k: { id: string }) => k.id) || [])}
                className="mt-2 text-xs text-blue-500 hover:text-blue-400"
              >
                Select all
              </button>
            </div>
          </div>
        )}

        {/* Assign button */}
        {selectedPeriod && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (selectedUsers.length > 0 && selectedKpis.length > 0) {
                  bulkAssign.mutate({
                    userIds: selectedUsers,
                    kpiDefinitionIds: selectedKpis,
                    evalPeriodId: selectedPeriod,
                  })
                }
              }}
              disabled={bulkAssign.isPending || selectedUsers.length === 0 || selectedKpis.length === 0}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkAssign.isPending
                ? "Assigning..."
                : `Assign ${selectedKpis.length} KPIs to ${selectedUsers.length} users`}
            </button>
            {bulkAssign.isSuccess && (
              <Badge variant="success">Assignments created</Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
