// TypeScript types derived from Prisma schema (CLAUDE.md Section 4)
// These are supplementary types used across the application.
// For database types, use Prisma-generated types from @prisma/client.

export type PillarCode = "A" | "B" | "C" | "D" | "E" | "F"

export interface ScoreResult {
  userId: string
  evalPeriodId: string
  pillarScores: PillarScoreResult[]
  overallScore: number
  appraisalBand: string
}

export interface PillarScoreResult {
  pillarCode: PillarCode
  pillarName: string
  pillarScore: number     // out of 5
  pillarPercent: number   // out of 100
  kpiScores: KpiScoreResult[]
}

export interface KpiScoreResult {
  kpiCode: string
  kpiName: string
  target: number
  actual: number | null
  binaryValue: boolean | null
  score: number           // 0-5
  weight: number          // sub-KPI weight within pillar
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: { field: string; message: string }[]
  }
}
