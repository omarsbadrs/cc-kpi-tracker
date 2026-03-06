"use client"

import { PILLARS } from "@/lib/constants"
import type { PillarCode } from "@/types"

const STAGGER: Record<string, string> = {
  A: "animate-stagger-1",
  B: "animate-stagger-2",
  C: "animate-stagger-3",
  D: "animate-stagger-4",
  E: "animate-stagger-5",
  F: "animate-stagger-6",
}

interface PillarCardProps {
  pillarCode: PillarCode
  percent: number
  score5: number
  isExpanded?: boolean
  onClick?: () => void
}

export function PillarCard({ pillarCode, percent, score5, isExpanded, onClick }: PillarCardProps) {
  const pillar = PILLARS[pillarCode]
  if (!pillar) return null

  const pw = Math.min(100, Math.max(0, percent))

  return (
    <button
      onClick={onClick}
      className={`glass-card-btn animate-card-in ${STAGGER[pillarCode] || ""} w-full p-5 text-left`}
      style={isExpanded ? { borderColor: pillar.color + "30", boxShadow: `0 0 16px ${pillar.color}10` } : undefined}
    >
      {/* Pillar code with colored dot */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: pillar.color }}
        />
        <span className="text-sm font-medium text-foreground-muted">{pillarCode}</span>
      </div>

      {/* Pillar name */}
      <p className="text-sm font-semibold text-foreground mb-3 leading-tight">{pillar.name}</p>

      {/* Percentage */}
      <p className="text-3xl font-bold text-foreground leading-none mb-1">{percent.toFixed(1)}%</p>

      {/* Score subtitle */}
      <p className="text-xs text-foreground-muted mb-4">Score: {score5.toFixed(2)} / 5</p>

      {/* Progress bar */}
      <div className="progress-track">
        <div
          className="progress-fill animate-bar"
          style={{ width: `${pw}%`, backgroundColor: pillar.color }}
        />
      </div>
    </button>
  )
}
