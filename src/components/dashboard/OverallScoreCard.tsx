"use client"

import "@/styles/views/dashboard.css"
import { APPRAISAL_BANDS } from "@/lib/constants"
import { BandChip } from "@/components/ui/StatusChip"
import { ScoreGauge, distanceToNextBand } from "./ScoreGauge"
import type { AppraisalBand } from "@prisma/client"

interface OverallScoreCardProps {
  score: number
  band: AppraisalBand
  previousScore?: number
}

/** Standalone score card. The scorecard pages use ScorecardHero instead. */
export function OverallScoreCard({ score, band, previousScore }: OverallScoreCardProps) {
  const bandInfo = APPRAISAL_BANDS[band]
  const change = previousScore !== undefined ? score - previousScore : undefined
  const toNext = distanceToNextBand(score, band)

  return (
    <section className="card" aria-labelledby="overall-score-title">
      <div className="card-head">
        <h2 className="card-title" id="overall-score-title">
          Overall score
        </h2>
      </div>
      <div className="score-card-body">
        <ScoreGauge
          score={score}
          band={band}
          size={124}
          stroke={8}
          label={`Overall score: ${Math.round(score)} out of 100, ${bandInfo.label}`}
        />
        <div className="score-card-facts">
          <BandChip band={band} />
          <span className="tabular">
            Band {bandInfo.min}–{bandInfo.max}
            {toNext ? ` · ${toNext}` : ""}
          </span>
          {change !== undefined && (
            <span className={`score-change ${change >= 0 ? "text-ok" : "text-bad"}`}>
              {change >= 0 ? "+" : "−"}
              {Math.abs(change).toFixed(1)} from last period
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
