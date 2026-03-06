"use client"

import { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Badge } from "@/components/shared/Badge"

interface PeriodData {
  id: string
  name: string
  periodType: string
  startDate: string
  endDate: string
  objectives: string | null
  focus: string | null
  isActive: boolean
  isClosed: boolean
  isLocked: boolean
}

interface FormData {
  name: string
  periodType: string
  startDate: string
  endDate: string
  objectives: string
  focus: string
}

const emptyForm: FormData = {
  name: "",
  periodType: "MONTHLY",
  startDate: "",
  endDate: "",
  objectives: "",
  focus: "",
}

function toDateInput(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  return new Date(dateStr).toISOString().split("T")[0]
}

export default function PeriodsPage() {
  const queryClient = useQueryClient()
  const { data: periods, isLoading } = usePeriods()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)

  const createPeriod = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        objectives: data.objectives || undefined,
        focus: data.focus || undefined,
      }
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create period")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] })
      setShowForm(false)
      setFormData(emptyForm)
    },
  })

  const updatePeriod = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] })
      setEditingId(null)
      setFormData(emptyForm)
    },
  })

  const startEdit = (p: PeriodData) => {
    setEditingId(p.id)
    setShowForm(false)
    setFormData({
      name: p.name,
      periodType: p.periodType,
      startDate: toDateInput(p.startDate),
      endDate: toDateInput(p.endDate),
      objectives: p.objectives || "",
      focus: p.focus || "",
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData(emptyForm)
  }

  const startCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setShowForm(!showForm)
  }

  if (isLoading) return <LoadingSpinner />

  const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
  const labelClass = "mb-1 block text-xs font-medium text-foreground-secondary"

  const renderForm = (mode: "create" | "edit", periodId?: string) => (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {mode === "create" ? "New Evaluation Period" : "Edit Period"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Period Name</label>
          <input
            placeholder="e.g., Q2 - 2026"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Period Type</label>
          <select
            value={formData.periodType}
            onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
            className={inputClass}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Objectives</label>
          <textarea
            placeholder="Main objectives for this evaluation period..."
            value={formData.objectives}
            onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
            rows={3}
            className={inputClass + " resize-none"}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Focus Areas</label>
          <textarea
            placeholder="Key focus areas and priorities..."
            value={formData.focus}
            onChange={(e) => setFormData({ ...formData, focus: e.target.value })}
            rows={3}
            className={inputClass + " resize-none"}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {mode === "create" ? (
          <button
            onClick={() => createPeriod.mutate(formData)}
            disabled={createPeriod.isPending || !formData.name || !formData.startDate || !formData.endDate}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createPeriod.isPending ? "Creating..." : "Create Period"}
          </button>
        ) : (
          <button
            onClick={() => updatePeriod.mutate({
              id: periodId!,
              data: {
                name: formData.name,
                periodType: formData.periodType,
                startDate: formData.startDate,
                endDate: formData.endDate,
                objectives: formData.objectives || null,
                focus: formData.focus || null,
              },
            })}
            disabled={updatePeriod.isPending || !formData.name}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updatePeriod.isPending ? "Saving..." : "Save Changes"}
          </button>
        )}
        <button
          onClick={mode === "create" ? () => setShowForm(false) : cancelEdit}
          className="rounded-lg border border-border px-5 py-2 text-sm text-foreground-secondary hover:bg-card-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Evaluation Periods"
        action={
          <button
            onClick={startCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "New Period"}
          </button>
        }
      />

      {showForm && <div className="mb-6">{renderForm("create")}</div>}

      <div className="space-y-4">
        {(periods || []).map((p: PeriodData) => (
          <div key={p.id}>
            {editingId === p.id ? (
              renderForm("edit", p.id)
            ) : (
              <div className="rounded-xl border border-card-border bg-card-bg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-base font-semibold text-foreground">{p.name}</p>
                      <Badge variant={p.isClosed ? "danger" : p.isActive ? "success" : "neutral"}>
                        {p.isClosed ? "Closed" : p.isActive ? "Open" : "Inactive"}
                      </Badge>
                      {p.isLocked && <Badge variant="warning">Locked</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()} | {p.periodType}
                    </p>
                    {p.objectives && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-foreground-secondary">Objectives</p>
                        <p className="mt-0.5 text-sm text-foreground-muted whitespace-pre-line">{p.objectives}</p>
                      </div>
                    )}
                    {p.focus && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-foreground-secondary">Focus Areas</p>
                        <p className="mt-0.5 text-sm text-foreground-muted whitespace-pre-line">{p.focus}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-card-hover"
                    >
                      Edit
                    </button>
                    {p.isClosed ? (
                      <button
                        onClick={() => updatePeriod.mutate({ id: p.id, data: { isClosed: false } })}
                        disabled={updatePeriod.isPending}
                        className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/20"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => updatePeriod.mutate({ id: p.id, data: { isClosed: true } })}
                        disabled={updatePeriod.isPending}
                        className="rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/20"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {(!periods || periods.length === 0) && (
          <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
            <p className="text-sm text-foreground-muted">No evaluation periods created yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
