"use client"

import { PILLARS } from "@/lib/constants"
import type { PillarCode } from "@/types"

interface PillarCardProps {
  pillarCode: PillarCode
  percent: number
  score5: number
  onClick?: () => void
}

export function PillarCard({ pillarCode, percent, score5, onClick }: PillarCardProps) {
  const pillar = PILLARS[pillarCode]
  if (!pillar) return null

  const progressWidth = Math.min(100, Math.max(0, percent))

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-card-border bg-card-bg p-5 text-left transition-all hover:bg-card-hover hover:border-border-hover"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: pillar.color }}
        />
        <span className="text-xs font-medium text-foreground-muted">{pillarCode}</span>
      </div>
      <p className="text-sm font-medium text-foreground-secondary mb-1">{pillar.name}</p>
      <p className="text-2xl font-bold text-foreground">{percent.toFixed(1)}%</p>
      <p className="text-xs text-foreground-muted mb-3">Score: {score5.toFixed(2)} / 5</p>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progressWidth}%`, backgroundColor: pillar.color }}
        />
      </div>
    </button>
  )
}
