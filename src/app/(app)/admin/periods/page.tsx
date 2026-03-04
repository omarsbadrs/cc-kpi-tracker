"use client"

import { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"

export default function PeriodsPage() {
  const queryClient = useQueryClient()
  const { data: periods, isLoading } = usePeriods()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "", periodType: "MONTHLY", startDate: "", endDate: "",
  })

  const createPeriod = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create period")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] })
      setShowForm(false)
      setFormData({ name: "", periodType: "MONTHLY", startDate: "", endDate: "" })
    },
  })

  const togglePeriod = useMutation({
    mutationFn: async ({ id, isClosed }: { id: string; isClosed: boolean }) => {
      const res = await fetch(`/api/periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed }),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["periods"] }),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Evaluation Periods"
        action={
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {showForm ? "Cancel" : "New Period"}
          </button>
        }
      />

      {showForm && (
        <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input placeholder="Period Name (e.g., January 2025)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
            <select value={formData.periodType} onChange={(e) => setFormData({ ...formData, periodType: e.target.value })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>
            <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
            <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500" />
          </div>
          <button onClick={() => createPeriod.mutate(formData)} disabled={createPeriod.isPending} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {createPeriod.isPending ? "Creating..." : "Create Period"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(periods || []).map((p: { id: string; name: string; periodType: string; startDate: string; endDate: string; isActive: boolean; isClosed: boolean; isLocked: boolean }) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-card-border bg-card-bg p-4">
            <div>
              <p className="font-medium text-foreground">{p.name}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()} | {p.periodType}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {p.isLocked && <Badge variant="warning">Locked</Badge>}
              <Badge variant={p.isClosed ? "danger" : p.isActive ? "success" : "neutral"}>
                {p.isClosed ? "Closed" : p.isActive ? "Active" : "Inactive"}
              </Badge>
              {!p.isClosed && (
                <button
                  onClick={() => togglePeriod.mutate({ id: p.id, isClosed: true })}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-foreground-secondary hover:bg-card-hover"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
