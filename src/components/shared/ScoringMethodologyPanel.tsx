"use client"

import { useState } from "react"
import { APPRAISAL_BANDS } from "@/lib/constants"
import {
  ChevronDown,
  ChevronRight,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"
import type { AppraisalBand } from "@prisma/client"

export function ScoringMethodologyPanel({ collapsible = true }: { collapsible?: boolean }) {
  const [open, setOpen] = useState(false)
  const isOpen = !collapsible || open

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5">
      {collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
        >
          <Info className="h-4 w-4 shrink-0 text-blue-400" strokeWidth={1.5} />
          <span className="text-sm font-medium text-blue-300">
            Scoring Methodology — How calculations work
          </span>
          {open
            ? <ChevronDown className="ml-auto h-4 w-4 text-blue-400" />
            : <ChevronRight className="ml-auto h-4 w-4 text-blue-400" />}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-5 py-3.5">
          <Info className="h-4 w-4 shrink-0 text-blue-400" strokeWidth={1.5} />
          <span className="text-sm font-medium text-blue-300">
            Scoring Methodology — How calculations work
          </span>
        </div>
      )}

      {isOpen && (
        <div className="border-t border-blue-500/20 px-5 py-4 space-y-5 text-sm">

          {/* Step 1 */}
          <div>
            <p className="font-semibold text-foreground-secondary mb-2">
              Step 1 — Individual KPI Score (0–5)
            </p>
            <p className="text-foreground-muted mb-2">
              Each KPI is scored based on the gap between the actual value and the tier target:
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card-bg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400">HIGHER is better</span>
                </div>
                <p className="text-xs text-foreground-muted mb-1">gap = Target − Actual</p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["≤ 0 (at/above target)", "5"],
                      ["1–3 pp below", "4"],
                      ["4–6 pp below", "3"],
                      ["7–10 pp below", "2"],
                      ["11–15 pp below", "1"],
                      ["> 15 pp below", "0"],
                    ].map(([cond, sc]) => (
                      <tr key={cond}>
                        <td className="py-0.5 text-foreground-muted">{cond}</td>
                        <td className="py-0.5 text-right font-bold text-foreground">{sc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-border bg-card-bg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-semibold text-red-400">LOWER is better</span>
                </div>
                <p className="text-xs text-foreground-muted mb-1">gap = Actual − Target</p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["≤ 0 (at/below target)", "5"],
                      ["1–3 pp above", "4"],
                      ["4–6 pp above", "3"],
                      ["7–10 pp above", "2"],
                      ["11–15 pp above", "1"],
                      ["> 15 pp above", "0"],
                    ].map(([cond, sc]) => (
                      <tr key={cond}>
                        <td className="py-0.5 text-foreground-muted">{cond}</td>
                        <td className="py-0.5 text-right font-bold text-foreground">{sc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-border bg-card-bg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Minus className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">BINARY</span>
                </div>
                <table className="w-full text-xs mt-2">
                  <tbody>
                    <tr>
                      <td className="py-0.5 text-foreground-muted">Pass</td>
                      <td className="py-0.5 text-right font-bold text-foreground">5</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 text-foreground-muted">Fail</td>
                      <td className="py-0.5 text-right font-bold text-foreground">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <p className="font-semibold text-foreground-secondary mb-1">Step 2 — Pillar Score</p>
            <div className="rounded-lg border border-border bg-card-bg p-3 font-mono text-xs text-foreground-muted space-y-1">
              <p>Pillar Score (out of 5) = Σ ( KPI_Score × Sub_KPI_Weight / 100 )</p>
              <p>Pillar % = Pillar Score × 20</p>
            </div>
            <p className="mt-1.5 text-xs text-foreground-muted">
              Sub-KPI weights within each pillar sum to 100 per tier.
              KPIs with weight = 0 for a tier do not contribute.
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <p className="font-semibold text-foreground-secondary mb-1">
              Step 3 — Manager Alpha Blending (Team Lead & Section Head only)
            </p>
            <div className="rounded-lg border border-border bg-card-bg p-3 font-mono text-xs text-foreground-muted">
              <p>Manager Pillar % = α × Team_Pillar_% + (1 − α) × Personal_Pillar_%</p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-foreground-muted">
                    <th className="pr-4 pb-1 text-left font-medium">Pillar</th>
                    <th className="pr-4 pb-1 font-medium">TL α</th>
                    <th className="pr-4 pb-1 font-medium">TL personal</th>
                    <th className="pr-4 pb-1 font-medium">SH α</th>
                    <th className="pb-1 font-medium">SH personal</th>
                  </tr>
                </thead>
                <tbody className="text-foreground-muted">
                  {[
                    ["A", "0.45", "0.55", "0.49", "0.51"],
                    ["B", "0.40", "0.60", "0.45", "0.55"],
                    ["C", "0.45", "0.55", "0.49", "0.51"],
                    ["D", "0.35", "0.65", "0.40", "0.60"],
                    ["E", "0.10", "0.90", "0.05", "0.95"],
                    ["F", "0.40", "0.60", "0.45", "0.55"],
                  ].map(([p, ta, tp, sa, sp]) => (
                    <tr key={p}>
                      <td className="pr-4 py-0.5 font-medium text-foreground">{p}</td>
                      <td className="pr-4 py-0.5 text-center">{ta}</td>
                      <td className="pr-4 py-0.5 text-center">{tp}</td>
                      <td className="pr-4 py-0.5 text-center">{sa}</td>
                      <td className="py-0.5 text-center">{sp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <p className="font-semibold text-foreground-secondary mb-1">Step 4 — Overall Score</p>
            <div className="rounded-lg border border-border bg-card-bg p-3 font-mono text-xs text-foreground-muted">
              <p>Overall Score = Σ ( Pillar_% × Pillar_Weight / 100 )</p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-foreground-muted">
                    <th className="pr-4 pb-1 text-left font-medium">Pillar</th>
                    <th className="pr-4 pb-1 font-medium">Junior / Engineer</th>
                    <th className="pr-4 pb-1 font-medium">Senior</th>
                    <th className="pr-4 pb-1 font-medium">Team Lead</th>
                    <th className="pb-1 font-medium">Section Head</th>
                  </tr>
                </thead>
                <tbody className="text-foreground-muted">
                  {[
                    ["A — Delivery", "30%", "26%", "20%", "13%"],
                    ["B — Data Gov.", "25%", "23%", "20%", "17%"],
                    ["C — Forecasting", "20%", "19%", "16%", "13%"],
                    ["D — Communication", "10%", "14%", "17%", "19%"],
                    ["E — Attendance", "10%", "9%", "5%", "3%"],
                    ["F — Growth", "5%", "10%", "22%", "36%"],
                  ].map(([pillar, ...ws]) => (
                    <tr key={pillar}>
                      <td className="pr-4 py-0.5 font-medium text-foreground">{pillar}</td>
                      {ws.map((w, i) => (
                        <td key={i} className="pr-4 py-0.5 text-center">{w}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 5 */}
          <div>
            <p className="font-semibold text-foreground-secondary mb-1">Step 5 — Appraisal Band</p>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(APPRAISAL_BANDS) as [
                  AppraisalBand,
                  { label: string; color: string },
                ][]
              ).map(([band, info]) => (
                <span
                  key={band}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: info.color + "20", color: info.color }}
                >
                  {band === "EXCEEDS"
                    ? "90–100"
                    : band === "STRONG"
                      ? "80–89"
                      : band === "MEETS"
                        ? "70–79"
                        : band === "NEEDS_IMPROVEMENT"
                          ? "60–69"
                          : "< 60"}{" "}
                  → {info.label}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
