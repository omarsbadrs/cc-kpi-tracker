import type { CSSProperties } from "react"

/** The 0–5 KPI score: the number is the signal, the tone repeats it. */
export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return (
      <span className="score-badge empty" aria-label="Not scored">
        –
      </span>
    )
  }
  const s = Math.max(0, Math.min(5, Math.round(score)))
  return (
    <span className={`score-badge score-${s}`} aria-label={`Score ${s} of 5`}>
      {s}
    </span>
  )
}

/** The pillar's letter on a tint of its colour. */
export function PillarTag({ code, big = false }: { code: string; big?: boolean }) {
  return (
    <span className={`pillar-tag pillar-${code}${big ? " big" : ""}`} aria-hidden="true">
      {code}
    </span>
  )
}

export function PillarDot({ code }: { code: string }) {
  return <span className={`pillar-dot pillar-${code}`} aria-hidden="true" />
}

/**
 * A 6px progress bar. `pillar` colours it by pillar; otherwise --series-1.
 * Always pair it with the written figure.
 */
export function Meter({
  value,
  max = 100,
  pillar,
  color,
  label,
  thick = false,
  target,
}: {
  value: number
  max?: number
  pillar?: string
  color?: string
  label: string
  thick?: boolean
  /** Draws a target mark at this value (same scale as `value`). */
  target?: number
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const style: CSSProperties = { width: `${pct}%` }
  if (color) style.background = color
  const bar = (
    <div
      className={`meter${thick ? " thick" : ""}${pillar ? ` pillar-${pillar}` : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 10) / 10}
    >
      <span style={style} />
    </div>
  )
  if (target === undefined || max <= 0) return bar
  return (
    <div className="meter-wrap">
      {bar}
      <span
        className="meter-target"
        aria-hidden="true"
        style={{ insetInlineStart: `${Math.max(0, Math.min(100, (target / max) * 100))}%` }}
      />
    </div>
  )
}

/** On/off switch (aria-checked drives the look). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}
