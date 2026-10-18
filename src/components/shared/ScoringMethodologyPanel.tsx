"use client"

import { useId, useState, type ReactNode } from "react"
import { APPRAISAL_BANDS, PILLARS, PILLAR_CODES } from "@/lib/constants"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CircleDot, Info, type LucideIcon } from "lucide-react"
import type { AppraisalBand } from "@prisma/client"
import { ScoreBadge, PillarTag } from "@/components/ui/KpiMarks"
import { BandChip } from "@/components/ui/StatusChip"

const HIGHER_ROWS: [string, number][] = [
  ["≤ 0 (at or above target)", 5],
  ["1–3 pp below", 4],
  ["4–6 pp below", 3],
  ["7–10 pp below", 2],
  ["11–15 pp below", 1],
  ["> 15 pp below", 0],
]

const LOWER_ROWS: [string, number][] = [
  ["≤ 0 (at or below target)", 5],
  ["1–3 pp above", 4],
  ["4–6 pp above", 3],
  ["7–10 pp above", 2],
  ["11–15 pp above", 1],
  ["> 15 pp above", 0],
]

const BINARY_ROWS: [string, number][] = [
  ["Pass", 5],
  ["Fail", 0],
]

const ALPHA_ROWS: Record<string, [string, string, string, string]> = {
  A: ["0.45", "0.55", "0.49", "0.51"],
  B: ["0.40", "0.60", "0.45", "0.55"],
  C: ["0.45", "0.55", "0.49", "0.51"],
  D: ["0.35", "0.65", "0.40", "0.60"],
  E: ["0.10", "0.90", "0.05", "0.95"],
  F: ["0.40", "0.60", "0.45", "0.55"],
}

const PILLAR_WEIGHT_ROWS: Record<string, [string, string, string, string]> = {
  A: ["30%", "26%", "20%", "13%"],
  B: ["25%", "23%", "20%", "17%"],
  C: ["20%", "19%", "16%", "13%"],
  D: ["10%", "14%", "17%", "19%"],
  E: ["10%", "9%", "5%", "3%"],
  F: ["5%", "10%", "22%", "36%"],
}

const BAND_RANGE: Record<AppraisalBand, string> = {
  EXCEEDS: "90–100",
  STRONG: "80–89",
  MEETS: "70–79",
  NEEDS_IMPROVEMENT: "60–69",
  UNSATISFACTORY: "< 60",
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="card-list" style={{ padding: "10px 14px", background: "var(--band)" }}>
      <code className="kpi-code" style={{ display: "block", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.7 }}>
        {children}
      </code>
    </div>
  )
}

function ScoreBandTable({
  icon: Icon,
  title,
  gap,
  rows,
}: {
  icon: LucideIcon
  title: string
  gap?: string
  rows: [string, number][]
}) {
  return (
    <div className="min-w-0">
      <div className="row" style={{ gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>
        <Icon size={15} strokeWidth={1.8} className="muted" style={{ flex: "none" }} aria-hidden="true" />
        {title}
      </div>
      {gap && <p className="side-note" style={{ marginBottom: 6 }}>gap = <span className="kpi-code">{gap}</span></p>}
      <div className="card-list">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{gap ? "Gap" : "Result"}</th>
              <th scope="col" className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([cond, score]) => (
              <tr key={cond}>
                <td className="ink-2">{cond}</td>
                <td className="num"><ScoreBadge score={score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PillarCell({ code }: { code: string }) {
  return (
    <th scope="row" style={{ fontWeight: 450 }}>
      <span className="row" style={{ gap: 8 }}>
        <PillarTag code={code} />
        <span className="nowrap">{PILLARS[code as keyof typeof PILLARS].name}</span>
      </span>
    </th>
  )
}

export function ScoringMethodologyPanel({ collapsible = true }: { collapsible?: boolean }) {
  const [open, setOpen] = useState(false)
  const isOpen = !collapsible || open
  const bodyId = useId()

  const title = (
    <>
      <Info size={17} strokeWidth={1.6} className="muted" style={{ flex: "none" }} aria-hidden="true" />
      <span className="card-title grow" style={{ marginBottom: 0 }}>How scoring works</span>
    </>
  )

  return (
    <section className="card list-card">
      {collapsible ? (
        <button
          type="button"
          className="doc-row"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          {title}
          {open ? (
            <ChevronDown size={17} className="muted" style={{ flex: "none" }} aria-hidden="true" />
          ) : (
            <ChevronRight size={17} className="muted" style={{ flex: "none" }} aria-hidden="true" />
          )}
        </button>
      ) : (
        <div className="card-head" style={{ justifyContent: "flex-start", gap: 12 }}>
          {title}
        </div>
      )}

      {isOpen && (
        <div
          id={bodyId}
          style={{ padding: "4px 16px 16px", borderTop: collapsible ? "1px solid var(--hairline)" : undefined }}
        >
          {/* Step 1 */}
          <h3 className="form-section" style={{ borderTop: 0 }}>Step 1 · Individual KPI score (0–5)</h3>
          <p className="side-note" style={{ marginBottom: 12 }}>
            Each KPI is scored on the gap between the actual value and the tier target.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <ScoreBandTable icon={ArrowUp} title="Higher is better" gap="Target − Actual" rows={HIGHER_ROWS} />
            <ScoreBandTable icon={ArrowDown} title="Lower is better" gap="Actual − Target" rows={LOWER_ROWS} />
            <ScoreBandTable icon={CircleDot} title="Pass or fail" rows={BINARY_ROWS} />
          </div>

          {/* Step 2 */}
          <h3 className="form-section" style={{ marginTop: 18 }}>Step 2 · Pillar score</h3>
          <Formula>
            Pillar score (out of 5) = Σ ( KPI_Score × Sub_KPI_Weight / 100 )
            <br />
            Pillar % = Pillar score × 20
          </Formula>
          <p className="side-note" style={{ marginTop: 8 }}>
            Sub-KPI weights within each pillar sum to 100 per tier. KPIs with a weight of 0 for a tier do not
            contribute.
          </p>

          {/* Step 3 */}
          <h3 className="form-section" style={{ marginTop: 18 }}>
            Step 3 · Manager alpha blending (team lead and section head only)
          </h3>
          <Formula>Manager pillar % = α × Team_Pillar_% + (1 − α) × Personal_Pillar_%</Formula>
          <div className="card-list" style={{ marginTop: 10 }}>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Alpha values by pillar">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Pillar</th>
                    <th scope="col" className="num">TL α</th>
                    <th scope="col" className="num">TL personal</th>
                    <th scope="col" className="num">SH α</th>
                    <th scope="col" className="num">SH personal</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLAR_CODES.map((code) => (
                    <tr key={code}>
                      <PillarCell code={code} />
                      {ALPHA_ROWS[code]?.map((v, i) => (
                        <td key={i} className="num">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4 */}
          <h3 className="form-section" style={{ marginTop: 18 }}>Step 4 · Overall score</h3>
          <Formula>Overall score = Σ ( Pillar_% × Pillar_Weight / 100 )</Formula>
          <div className="card-list" style={{ marginTop: 10 }}>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Pillar weights by tier">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Pillar</th>
                    <th scope="col" className="num">Junior / engineer</th>
                    <th scope="col" className="num">Senior</th>
                    <th scope="col" className="num">Team lead</th>
                    <th scope="col" className="num">Section head</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLAR_CODES.map((code) => (
                    <tr key={code}>
                      <PillarCell code={code} />
                      {PILLAR_WEIGHT_ROWS[code]?.map((w, i) => (
                        <td key={i} className="num">{w}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 5 */}
          <h3 className="form-section" style={{ marginTop: 18 }}>Step 5 · Appraisal band</h3>
          <div className="card-list" style={{ maxWidth: 420 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Overall score</th>
                  <th scope="col">Band</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(APPRAISAL_BANDS) as AppraisalBand[]).map((band) => (
                  <tr key={band}>
                    <td className="tabular">{BAND_RANGE[band]}</td>
                    <td><BandChip band={band} small /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
