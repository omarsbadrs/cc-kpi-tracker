"use client"

import { APPRAISAL_BANDS, SCORE_COLORS } from "@/lib/constants"
import type { AppraisalBand } from "@prisma/client"

interface OverallScoreCardProps {
  score: number
  band: AppraisalBand
  previousScore?: number
}

export function OverallScoreCard({ score, band, previousScore }: OverallScoreCardProps) {
  const bandInfo = APPRAISAL_BANDS[band]
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const change = previousScore !== undefined ? score - previousScore : undefined

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <h3 className="mb-4 text-sm font-medium text-foreground-muted">Overall Score</h3>
      <div className="flex items-center gap-6">
        {/* Gauge */}
        <div className="relative">
          <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
            <circle
              cx="80" cy="80" r={radius}
              fill="none" stroke="currentColor"
              className="text-border"
              strokeWidth="10"
            />
            <circle
              cx="80" cy="80" r={radius}
              fill="none"
              stroke={bandInfo.color}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{Math.round(score)}</span>
            <span className="text-xs text-foreground-muted">/ 100</span>
          </div>
        </div>

        {/* Info */}
        <div>
          <div
            className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: bandInfo.color + "20", color: bandInfo.color }}
          >
            {bandInfo.label}
          </div>
          {change !== undefined && (
            <p className={`mt-2 text-sm ${change >= 0 ? "text-green-500" : "text-red-500"}`}>
              {change >= 0 ? "+" : ""}{change.toFixed(1)} from last period
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
