"use client"

import { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarRange, Plus } from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHead } from "@/components/ui/PageHead"
import { Field, SelectWrap } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { ConfirmDialog, Modal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"

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

const TYPE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
}

function toDateInput(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  return new Date(dateStr).toISOString().split("T")[0] ?? ""
}

export default function PeriodsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: periods, isLoading } = usePeriods()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  // Kept after close so the title doesn't flip during the closing animation.
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [confirm, setConfirm] = useState<{ period: PeriodData; action: "close" | "reopen" } | null>(null)

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
    setFormMode("edit")
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
    setFormMode("create")
    setFormData(emptyForm)
    setShowForm(true)
  }

  if (isLoading) return <LoadingSpinner />

  const list: PeriodData[] = periods || []
  const openCount = list.filter((p) => p.isActive && !p.isClosed).length
  const mode: "create" | "edit" | null = showForm ? "create" : editingId ? "edit" : null
  const busy = createPeriod.isPending || updatePeriod.isPending

  const closeModal = () => {
    if (mode === "create") setShowForm(false)
    else cancelEdit()
  }

  const submitForm = () => {
    if (busy) return
    if (mode === "create") {
      if (!formData.name || !formData.startDate || !formData.endDate) {
        toast("Add a name, start date and end date", { icon: "alert" })
        return
      }
      createPeriod.mutate(formData, {
        onSuccess: () => toast("Period created"),
        onError: () => toast("Could not create the period. Check your connection", { icon: "alert" }),
      })
    } else if (mode === "edit" && editingId) {
      if (!formData.name) {
        toast("Add a period name", { icon: "alert" })
        document.getElementById("period-name")?.focus()
        return
      }
      updatePeriod.mutate(
        {
          id: editingId,
          data: {
            name: formData.name,
            periodType: formData.periodType,
            startDate: formData.startDate,
            endDate: formData.endDate,
            objectives: formData.objectives || null,
            focus: formData.focus || null,
          },
        },
        {
          onSuccess: () => toast("Period saved"),
          onError: () => toast("Could not save the period. Check your connection", { icon: "alert" }),
        }
      )
    }
  }

  const runConfirm = () => {
    if (!confirm) return
    const closing = confirm.action === "close"
    updatePeriod.mutate(
      { id: confirm.period.id, data: { isClosed: closing } },
      {
        onSuccess: () => {
          setConfirm(null)
          toast(closing ? "Period closed" : "Period reopened")
        },
        onError: () => {
          setConfirm(null)
          toast(
            closing
              ? "Could not close the period. Check your connection"
              : "Could not reopen the period. Check your connection",
            { icon: "alert" }
          )
        },
      }
    )
  }

  const statusChip = (p: PeriodData) => {
    if (p.isClosed) return <StatusChip tone="neutral" small>Closed</StatusChip>
    if (p.isActive) return <StatusChip tone="ok" small>Active</StatusChip>
    return <StatusChip tone="neutral" small>Inactive</StatusChip>
  }

  return (
    <>
      <PageHead
        title="Evaluation periods"
        sub={`${list.length} ${list.length === 1 ? "period" : "periods"} · ${openCount} open`}
        actions={
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            New period
          </button>
        }
      />

      {list.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={CalendarRange}
            title="No evaluation periods yet"
            description="Create a period to start assigning KPIs and collecting actuals."
            action={
              <button type="button" className="btn btn-primary" onClick={startCreate}>
                New period
              </button>
            }
          />
        </section>
      ) : (
        <section className="card list-card">
          <div className="card-head">
            <h2 className="card-title">All periods</h2>
            <TagPill>{list.length}</TagPill>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Evaluation periods">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" style={{ minWidth: 200, maxWidth: 380, fontWeight: 400 }}>
                      <span style={{ fontWeight: 550 }}>{p.name}</span>
                      {p.objectives && (
                        <p className="muted" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-line" }}>
                          <span className="ink-2">Objectives · </span>
                          {p.objectives}
                        </p>
                      )}
                      {p.focus && (
                        <p className="muted" style={{ fontSize: 12.5, marginTop: 2, whiteSpace: "pre-line" }}>
                          <span className="ink-2">Focus areas · </span>
                          {p.focus}
                        </p>
                      )}
                    </th>
                    <td>
                      <TagPill>{TYPE_LABELS[p.periodType] ?? p.periodType}</TagPill>
                    </td>
                    <td className="tabular nowrap">
                      {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="inline-flex flex-wrap gap-1">
                        {statusChip(p)}
                        {p.isLocked && <StatusChip tone="warn" small>Locked</StatusChip>}
                      </span>
                    </td>
                    <td>
                      <span className="flex justify-end gap-2">
                        <button type="button" className="btn btn-sm" onClick={() => startEdit(p)}>
                          Edit
                          <span className="sr-only"> {p.name}</span>
                        </button>
                        {p.isClosed ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={updatePeriod.isPending}
                            onClick={() => setConfirm({ period: p, action: "reopen" })}
                          >
                            Reopen
                            <span className="sr-only"> {p.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={updatePeriod.isPending}
                            onClick={() => setConfirm({ period: p, action: "close" })}
                          >
                            Close
                            <span className="sr-only"> {p.name}</span>
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={mode !== null}
        onClose={closeModal}
        title={formMode === "edit" ? "Edit period" : "New period"}
        locked={busy}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitForm()
          }}
        >
          <div className="field-grid">
            <Field label="Period name" htmlFor="period-name">
              <input
                id="period-name"
                className="input"
                placeholder="e.g. Q2 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field label="Period type" htmlFor="period-type">
              <SelectWrap>
                <select
                  id="period-type"
                  className="select"
                  value={formData.periodType}
                  onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </SelectWrap>
            </Field>
          </div>
          <div className="field-grid">
            <Field label="Start date" htmlFor="period-start">
              <input
                id="period-start"
                type="date"
                className="input"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date" htmlFor="period-end">
              <input
                id="period-end"
                type="date"
                className="input"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Objectives" hint="optional" htmlFor="period-objectives">
            <textarea
              id="period-objectives"
              className="textarea"
              placeholder="Main objectives for this evaluation period"
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              rows={3}
            />
          </Field>
          <Field label="Focus areas" hint="optional" htmlFor="period-focus">
            <textarea
              id="period-focus"
              className="textarea"
              placeholder="Key focus areas and priorities"
              value={formData.focus}
              onChange={(e) => setFormData({ ...formData, focus: e.target.value })}
              rows={3}
            />
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" aria-disabled={busy || undefined}>
              {formMode === "edit"
                ? updatePeriod.isPending
                  ? "Saving…"
                  : "Save changes"
                : createPeriod.isPending
                  ? "Creating…"
                  : "Create period"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "reopen" ? "Reopen this period?" : "Close this period?"}
        message={
          confirm?.action === "reopen"
            ? `People can submit actuals for ${confirm.period.name} again.`
            : `People can no longer submit actuals for ${confirm?.period.name ?? "this period"}. You can reopen it later.`
        }
        confirmLabel={confirm?.action === "reopen" ? "Reopen period" : "Close period"}
        danger={confirm?.action !== "reopen"}
        busy={updatePeriod.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
