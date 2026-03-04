"use client"

import { useState } from "react"
import { usePeriods } from "@/hooks/usePeriods"
import { useRunScoring } from "@/hooks/useScoring"
import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/shared/Badge"
import { APPRAISAL_BANDS } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

export default function ScoringPage() {
  const { data: periods } = usePeriods()
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const runScoring = useRunScoring()
  const [results, setResults] = useState<{
    results: Array<{
      userId: string
      overallScore: number
      appraisalBand: AppraisalBand
      pillarResults: Array<{ pillarCode: string; percent: number }>
    }>
    usersScored: number
    dryRun: boolean
  } | null>(null)

  async function handleRun(dryRun: boolean) {
    if (!selectedPeriod) return
    const res = await runScoring.mutateAsync({ evalPeriodId: selectedPeriod, dryRun })
    setResults(res.data)
  }

  return (
    <div>
      <PageHeader
        title="Scoring Engine"
        description="Run the scoring engine for an evaluation period"
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
            Evaluation Period
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => { setSelectedPeriod(e.target.value); setResults(null) }}
            className="w-full max-w-md rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500"
          >
            <option value="">Select period...</option>
            {(periods || []).map((p: { id: string; name: string; isClosed: boolean }) => (
              <option key={p.id} value={p.id}>{p.name} {p.isClosed ? "(Closed)" : ""}</option>
            ))}
          </select>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleRun(true)}
              disabled={!selectedPeriod || runScoring.isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-card-hover disabled:opacity-50"
            >
              {runScoring.isPending ? "Running..." : "Preview (Dry Run)"}
            </button>
            <button
              onClick={() => handleRun(false)}
              disabled={!selectedPeriod || runScoring.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {runScoring.isPending ? "Running..." : "Run & Save Scores"}
            </button>
          </div>
        </div>

        {results && (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-sm font-medium text-foreground-muted">Results</h3>
              <Badge variant={results.dryRun ? "warning" : "success"}>
                {results.dryRun ? "Preview Only" : "Saved"}
              </Badge>
              <span className="text-sm text-foreground-muted">{results.usersScored} users scored</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium text-foreground-secondary">User</th>
                    <th className="px-4 py-2 text-center font-medium text-foreground-secondary">Overall</th>
                    <th className="px-4 py-2 text-center font-medium text-foreground-secondary">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => {
                    const bandInfo = APPRAISAL_BANDS[r.appraisalBand]
                    return (
                      <tr key={r.userId} className="border-b border-border">
                        <td className="px-4 py-2 font-mono text-xs text-foreground-muted">{r.userId.slice(0, 8)}...</td>
                        <td className="px-4 py-2 text-center font-bold text-foreground">{r.overallScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: bandInfo.color + "20", color: bandInfo.color }}>
                            {bandInfo.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {runScoring.isError && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {runScoring.error?.message || "Scoring failed"}
          </div>
        )}
      </div>
    </div>
  )
}
