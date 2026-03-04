"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSubmitActual } from "@/hooks/useKpis"
import { useActivePeriod } from "@/hooks/usePeriods"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/shared/Badge"
import { SCORE_COLORS } from "@/lib/constants"
import { useState, type FormEvent } from "react"

export default function KpiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assignmentId = params.id as string
  const { data: period } = useActivePeriod()

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/assignments?pageSize=100`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data?.find((a: { id: string }) => a.id === assignmentId)
    },
    enabled: !!assignmentId,
  })

  const submitActual = useSubmitActual()

  const [actualValue, setActualValue] = useState("")
  const [binaryValue, setBinaryValue] = useState<boolean | null>(null)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState(false)

  if (isLoading) return <LoadingSpinner />
  if (!assignment) {
    return (
      <div className="py-12 text-center text-foreground-muted">
        Assignment not found.
        <button onClick={() => router.back()} className="ml-2 text-blue-500 hover:text-blue-400">
          Go back
        </button>
      </div>
    )
  }

  const kpi = assignment.kpiDefinition
  const latest = assignment.actuals?.[0]
  const isBinary = kpi.direction === "BINARY"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError("")
    setSubmitSuccess(false)

    if (!period?.id) {
      setSubmitError("No active evaluation period")
      return
    }

    try {
      await submitActual.mutateAsync({
        assignmentId,
        evalPeriodId: period.id,
        ...(isBinary
          ? { binaryValue: binaryValue === true }
          : { actualValue: parseFloat(actualValue) }),
      })
      setSubmitSuccess(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`${kpi.code} — ${kpi.name}`}
        description={`${kpi.pillar?.name} | ${kpi.frequency} | ${kpi.direction}`}
      />

      {/* KPI Info Card */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6 space-y-3">
        {kpi.formula && (
          <div>
            <span className="text-xs font-medium text-foreground-muted">Formula</span>
            <p className="text-sm text-foreground-secondary">{kpi.formula}</p>
          </div>
        )}
        {kpi.sla && (
          <div>
            <span className="text-xs font-medium text-foreground-muted">SLA</span>
            <p className="text-sm text-foreground-secondary">{kpi.sla}</p>
          </div>
        )}
        {kpi.dataSource && (
          <div>
            <span className="text-xs font-medium text-foreground-muted">Data Source</span>
            <p className="text-sm text-foreground-secondary">{kpi.dataSource}</p>
          </div>
        )}
        <div>
          <span className="text-xs font-medium text-foreground-muted">Target</span>
          <p className="text-sm font-semibold text-foreground">
            {assignment.targetOverride ?? "See tier default"}
          </p>
        </div>
      </div>

      {/* Current Status */}
      {latest && (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h3 className="mb-3 text-sm font-medium text-foreground-muted">Current Status</h3>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-foreground-secondary">Actual</p>
              <p className="text-lg font-bold text-foreground">
                {latest.actualValue ?? (latest.binaryValue ? "Pass" : "Fail")}
              </p>
            </div>
            {latest.score !== null && (
              <div>
                <p className="text-sm text-foreground-secondary">Score</p>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: SCORE_COLORS[latest.score as keyof typeof SCORE_COLORS] || SCORE_COLORS[0] }}
                >
                  {latest.score}
                </span>
              </div>
            )}
            <Badge variant={latest.status === "APPROVED" ? "success" : latest.status === "REJECTED" ? "danger" : "default"}>
              {latest.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Submit Form */}
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground-muted">Submit Actual</h3>

        {submitError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {submitError}
          </div>
        )}
        {submitSuccess && (
          <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Submitted successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isBinary ? (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setBinaryValue(true)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  binaryValue === true
                    ? "border-green-500 bg-green-500/10 text-green-500"
                    : "border-border text-foreground-muted hover:bg-card-hover"
                }`}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={() => setBinaryValue(false)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  binaryValue === false
                    ? "border-red-500 bg-red-500/10 text-red-500"
                    : "border-border text-foreground-muted hover:bg-card-hover"
                }`}
              >
                Fail
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="actualValue" className="mb-1.5 block text-sm font-medium text-foreground-secondary">
                Actual Value
              </label>
              <input
                id="actualValue"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitActual.isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitActual.isPending ? "Submitting..." : "Submit Actual"}
          </button>
        </form>
      </div>
    </div>
  )
}
