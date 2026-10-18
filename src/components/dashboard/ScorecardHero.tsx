"use client"

import "@/styles/views/dashboard.css"
import type { ReactNode } from "react"
import { APPRAISAL_BANDS, PILLAR_SHORT } from "@/lib/constants"
import { UserAvatar } from "@/components/layout/UserMenu"
import { BandChip } from "@/components/ui/StatusChip"
import { PillarTag } from "@/components/ui/KpiMarks"
import { ScoreGauge, distanceToNextBand } from "./ScoreGauge"
import type { AppraisalBand } from "@prisma/client"

export interface HeroFact {
  label: string
  value: ReactNode
}

export interface HeroKpiStats {
  total: number
  approved: number
  pending: number
  belowTarget: number
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The scorecard's head: who this is and how they stand, in one ruled card.
 * Identity, facts and three read-outs on the panel; the overall score on a
 * recessed band at the end, its ring in the band's own tone.
 */
export function ScorecardHero({
  firstName,
  lastName,
  avatarUrl,
  heading,
  sub,
  facts,
  score,
  band,
  pillars,
  kpis,
}: {
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  heading: ReactNode
  sub?: ReactNode
  facts: HeroFact[]
  /** Overall 0–100, or null when this period hasn't been scored. */
  score: number | null
  band: AppraisalBand | null
  pillars: { code: string; percent: number }[]
  kpis: HeroKpiStats
}) {
  const scored = pillars.filter((p) => p.percent > 0)
  const strongest = scored.length ? scored.reduce((a, b) => (b.percent > a.percent ? b : a)) : null
  const weakest = scored.length > 1 ? scored.reduce((a, b) => (b.percent < a.percent ? b : a)) : null
  const allEqual = strongest && weakest && strongest.percent === weakest.percent
  const bandInfo = band ? APPRAISAL_BANDS[band] : null
  const toNext = score !== null && band ? distanceToNextBand(score, band) : null

  return (
    <section className="hero" aria-label="Scorecard summary">
      <div className="hero-main">
        <div className="hero-identity">
          <UserAvatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} xl />
          <div className="hero-identity-text">
            <h2 className="hero-name">{heading}</h2>
            {sub && <p className="hero-sub">{sub}</p>}
          </div>
        </div>

        {facts.length > 0 && (
          <dl className="hero-facts">
            {facts.map((f) => (
              <div key={f.label} className="hero-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <dl className="hero-insights">
          <div className="hero-insight">
            <dt>Strongest pillar</dt>
            <dd>
              {strongest ? (
                <>
                  <span className="hero-insight-value">
                    <PillarTag code={strongest.code} />
                    <span className="tabular">{strongest.percent.toFixed(1)}%</span>
                  </span>
                  <span className="hero-insight-sub">{PILLAR_SHORT[strongest.code]}</span>
                </>
              ) : (
                <span className="hero-insight-sub">Not scored yet</span>
              )}
            </dd>
          </div>
          <div className="hero-insight">
            <dt>Focus area</dt>
            <dd>
              {weakest && !allEqual ? (
                <>
                  <span className="hero-insight-value">
                    <PillarTag code={weakest.code} />
                    <span className="tabular">{weakest.percent.toFixed(1)}%</span>
                  </span>
                  <span className="hero-insight-sub">{PILLAR_SHORT[weakest.code]}</span>
                </>
              ) : (
                <span className="hero-insight-sub">{scored.length ? "Every pillar level" : "Not scored yet"}</span>
              )}
            </dd>
          </div>
          <div className="hero-insight">
            <dt>KPIs</dt>
            <dd>
              <span className="hero-insight-value tabular">
                {kpis.approved}
                <span className="hero-insight-of"> of {kpis.total} approved</span>
              </span>
              <span className={`hero-insight-sub${kpis.belowTarget > 0 ? " text-warn" : ""}`}>
                {kpis.belowTarget > 0 ? `${plural(kpis.belowTarget, "KPI")} below target` : "All scored KPIs on target"}
                {kpis.pending > 0 ? ` · ${kpis.pending} waiting review` : ""}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="hero-score">
        <span className="hero-score-label">Overall score</span>
        <ScoreGauge
          score={score}
          band={band}
          label={
            score === null
              ? "Overall score: not scored yet"
              : `Overall score: ${Math.round(score)} out of 100${bandInfo ? `, ${bandInfo.label}` : ""}`
          }
        />
        {score !== null && band ? (
          <>
            <BandChip band={band} />
            <span className="hero-score-note">
              Band {APPRAISAL_BANDS[band].min}–{APPRAISAL_BANDS[band].max}
              {toNext ? ` · ${toNext}` : ""}
            </span>
          </>
        ) : (
          <span className="hero-score-note">Scores appear once this period has been scored</span>
        )}
      </div>
    </section>
  )
}
