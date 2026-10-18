"use client"

import { PILLARS, STRONG_THRESHOLD } from "@/lib/constants"
import { Meter, PillarTag } from "@/components/ui/KpiMarks"
import { StatusChip } from "@/components/ui/StatusChip"
import type { PillarCode } from "@/types"

interface PillarCardProps {
  pillarCode: PillarCode
  percent: number
  score5: number
  /** False when the pillar has no score in this period. */
  scored?: boolean
  /** KPIs assigned under this pillar, and how many fall short of target. */
  kpiCount?: number
  belowTarget?: number
  isExpanded?: boolean
  onClick?: () => void
  /** id of the panel this tile opens, for aria-controls. */
  controls?: string
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * One tile of the `.pillar-grid` (the parent renders the grid). A button
 * when it opens the pillar's KPIs, a plain tile otherwise. The meter carries
 * a mark at 80% (the "Strong" line); the chip says in words which side of it
 * the pillar is on.
 */
export function PillarCard({
  pillarCode,
  percent,
  score5,
  scored = true,
  kpiCount,
  belowTarget,
  isExpanded,
  onClick,
  controls,
}: PillarCardProps) {
  const pillar = PILLARS[pillarCode]
  if (!pillar) return null

  const onTarget = percent >= STRONG_THRESHOLD
  const kpiLine =
    kpiCount !== undefined
      ? [plural(kpiCount, "KPI"), belowTarget ? `${belowTarget} below target` : null].filter(Boolean).join(" · ")
      : null

  const body = (
    <>
      <span className="pillar-tile-head">
        <PillarTag code={pillarCode} />
        <span className="pillar-tile-name">{pillar.name}</span>
      </span>
      <span className="pillar-tile-figures">
        <span className="pillar-tile-value">{scored ? `${percent.toFixed(1)}%` : "–"}</span>
        {scored ? (
          <StatusChip tone={onTarget ? "ok" : "warn"} small>
            {onTarget ? "On target" : "Below target"}
          </StatusChip>
        ) : (
          <StatusChip tone="neutral" small>
            Not scored
          </StatusChip>
        )}
      </span>
      <Meter
        value={scored ? percent : 0}
        pillar={pillarCode}
        target={STRONG_THRESHOLD}
        label={`${pillar.name}: ${scored ? `${percent.toFixed(1)}%` : "not scored"}, target ${STRONG_THRESHOLD}%`}
      />
      <span className="pillar-tile-foot">
        <span>{scored ? `Score ${score5.toFixed(2)} of 5` : "No score yet"}</span>
        {kpiLine && <span>{kpiLine}</span>}
      </span>
    </>
  )

  if (!onClick) {
    return <div className={`pillar-tile pillar-${pillarCode}`}>{body}</div>
  }

  return (
    <button
      type="button"
      className={`pillar-tile pillar-${pillarCode}`}
      aria-pressed={!!isExpanded}
      aria-controls={isExpanded ? controls : undefined}
      title={isExpanded ? `Hide ${pillar.name} KPIs` : `Show ${pillar.name} KPIs`}
      onClick={onClick}
    >
      {body}
    </button>
  )
}
