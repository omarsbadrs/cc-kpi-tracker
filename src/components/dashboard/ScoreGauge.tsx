import { APPRAISAL_BANDS } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

/** The band a 0–100 score falls in (90 / 80 / 70 / 60 cut-offs). */
export function bandFor(score: number): AppraisalBand {
  if (score >= 90) return "EXCEEDS"
  if (score >= 80) return "STRONG"
  if (score >= 70) return "MEETS"
  if (score >= 60) return "NEEDS_IMPROVEMENT"
  return "UNSATISFACTORY"
}

const NEXT_BAND: Partial<Record<AppraisalBand, AppraisalBand>> = {
  UNSATISFACTORY: "NEEDS_IMPROVEMENT",
  NEEDS_IMPROVEMENT: "MEETS",
  MEETS: "STRONG",
  STRONG: "EXCEEDS",
}

/** "6.2 points to Strong", or null at the top band. */
export function distanceToNextBand(score: number, band: AppraisalBand): string | null {
  const next = NEXT_BAND[band]
  if (!next) return null
  const gap = APPRAISAL_BANDS[next].min - score
  if (gap <= 0) return null
  return `${gap.toFixed(1)} points to ${APPRAISAL_BANDS[next].label.toLowerCase()}`
}

/**
 * Ring gauge for a 0–100 score. The ring takes the band's own tone (an
 * "Exceeds" never draws in red); the number in the middle is the signal.
 * With `score` null it draws an empty track and a dash.
 */
export function ScoreGauge({
  score,
  band,
  size = 148,
  stroke = 10,
  label,
}: {
  score: number | null
  band?: AppraisalBand | null
  size?: number
  stroke?: number
  /** Accessible description, e.g. "Overall score: 93 out of 100, Exceeds expectations". */
  label: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = score === null ? 0 : Math.max(0, Math.min(100, score))
  const color = band ? APPRAISAL_BANDS[band].color : "var(--ink-3)"

  return (
    <div className="gauge" role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="gauge-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        {score !== null && (
          <circle
            className="gauge-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (value / 100) * circumference}
            strokeLinecap="round"
            style={{ stroke: color }}
          />
        )}
      </svg>
      <div className="gauge-label" aria-hidden="true">
        <span className="gauge-value" style={{ fontSize: Math.round(size * 0.26) }}>
          {score === null ? "–" : Math.round(score)}
        </span>
        <span className="gauge-of">of 100</span>
      </div>
    </div>
  )
}
