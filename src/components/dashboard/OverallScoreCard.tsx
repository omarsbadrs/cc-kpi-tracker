"use client"

import { APPRAISAL_BANDS } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

interface OverallScoreCardProps {
  score: number
  band: AppraisalBand
  previousScore?: number
}

export function OverallScoreCard({ score, band, previousScore }: OverallScoreCardProps) {
  const bandInfo = APPRAISAL_BANDS[band]
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const change = previousScore !== undefined ? score - previousScore : undefined

  return (
    <div className="glass-card animate-card-in p-6">
      <p className="label-xs mb-5">Overall Score</p>

      <div className="flex items-center gap-6">
        {/* Gauge */}
        <div className="relative">
          <svg width="156" height="156" viewBox="0 0 156 156" className="-rotate-90">
            <circle
              cx="78" cy="78" r={radius}
              fill="none"
              strokeWidth="7"
              className="stroke-border"
            />
            <circle
              cx="78" cy="78" r={radius}
              fill="none"
              stroke={bandInfo.color}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 6px ${bandInfo.color}40)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="metric-xl">{Math.round(score)}</span>
            <span className="text-xs text-foreground-muted mt-0.5">/ 100</span>
          </div>
        </div>

        {/* Info */}
        <div>
          <span
            className="pill"
            style={{ background: bandInfo.color + "15", color: bandInfo.color, borderColor: bandInfo.color + "25" }}
          >
            {bandInfo.label}
          </span>
          {change !== undefined && (
            <p className={`mt-3 text-sm font-medium ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {change >= 0 ? "+" : ""}{change.toFixed(1)} from last period
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
