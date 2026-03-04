/**
 * CC KPI Tracker — Scoring Engine
 * Implements all scoring rules from SOP CC-SOP-KPI-001
 *
 * This module is SERVER-SIDE ONLY. Never import in client components.
 *
 * Scoring methodology:
 *  1. Each KPI is scored 0-5 based on actual vs target and direction
 *  2. Pillar score = weighted sum of KPI scores using sub-KPI weights
 *  3. Pillar % = pillar score (out of 5) x 20
 *  4. For TL/SH: blend personal + team pillar % via alpha configs
 *  5. Overall score = weighted sum of pillar % using pillar weights
 *  6. Overall score maps to an appraisal band
 */

import type { Tier, KpiDirection, AppraisalBand } from "@prisma/client"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface KpiScoreInput {
  actualValue: number | null
  binaryValue: boolean | null
  targetValue: number
  direction: KpiDirection
}

export interface KpiWeightedScore {
  kpiCode: string
  score: number // 0-5
  weight: number // sub-KPI weight within pillar (0-100)
}

export interface PillarScoreResult {
  pillarCode: string
  score5: number // out of 5
  percent: number // out of 100
  kpiScores: KpiWeightedScore[]
}

export interface AlphaBlendInput {
  personalPercent: number
  teamPercent: number
  alpha: number // team share (0-1)
}

export interface FullScoringResult {
  userId: string
  evalPeriodId: string
  pillarResults: PillarScoreResult[]
  overallScore: number // 0-100
  appraisalBand: AppraisalBand
}

// ─────────────────────────────────────
// Individual KPI Score (0-5)
// ─────────────────────────────────────

/**
 * Calculate individual KPI score (0-5) based on actual vs target and direction.
 *
 * For HIGHER (higher is better):
 *   gap = target - actual (positive means below target)
 *   At or above target -> 5
 *   1-3 pp below -> 4
 *   4-6 pp below -> 3
 *   7-10 pp below -> 2
 *   11-15 pp below -> 1
 *   >15 pp below -> 0
 *
 * For LOWER (lower is better):
 *   gap = actual - target (positive means above target = worse)
 *   At or below target -> 5
 *   1-3 pp above -> 4
 *   4-6 pp above -> 3
 *   7-10 pp above -> 2
 *   11-15 pp above -> 1
 *   >15 pp above -> 0
 *
 * For BINARY:
 *   Pass (true) -> 5
 *   Fail (false/null) -> 0
 */
export function calculateKpiScore(input: KpiScoreInput): number {
  const { actualValue, binaryValue, targetValue, direction } = input

  // Binary KPIs
  if (direction === "BINARY") {
    return binaryValue === true ? 5 : 0
  }

  // Numeric KPIs - must have an actual value
  if (actualValue === null || actualValue === undefined) {
    return 0
  }

  let gap: number

  if (direction === "HIGHER") {
    // Higher is better: gap = how far below target
    gap = targetValue - actualValue
  } else {
    // Lower is better: gap = how far above target (worse)
    gap = actualValue - targetValue
  }

  // Score bands based on gap (in percentage points)
  if (gap <= 0) return 5 // At or better than target
  if (gap <= 3) return 4 // 1-3 pp gap
  if (gap <= 6) return 3 // 4-6 pp gap
  if (gap <= 10) return 2 // 7-10 pp gap
  if (gap <= 15) return 1 // 11-15 pp gap
  return 0 // >15 pp gap
}

// ─────────────────────────────────────
// Pillar Score Calculation
// ─────────────────────────────────────

/**
 * Calculate pillar score from weighted KPI scores.
 *
 * Formula from SOP CC-SOP-KPI-001:
 *   Pillar Score (out of 5) = SUM( KPI_score x KPI_sub_weight / 100 )
 *   Pillar % = Pillar Score x 20
 *
 * Sub-KPI weights within a pillar sum to 100 for each tier.
 * KPIs with weight = 0 contribute nothing (effectively not assigned to that tier).
 * If no KPIs are provided, returns 0 for both score and percent.
 */
export function calculatePillarScore(kpiScores: KpiWeightedScore[]): {
  score5: number
  percent: number
} {
  if (kpiScores.length === 0) {
    return { score5: 0, percent: 0 }
  }

  // Pillar Score = SUM( kpiScore * subWeight / 100 )
  const pillarScore = kpiScores.reduce(
    (sum, kpi) => sum + (kpi.score * kpi.weight) / 100,
    0
  )

  // Pillar % = Pillar Score * 20
  const pillarPercent = pillarScore * 20

  return {
    score5: Math.round(pillarScore * 100) / 100,
    percent: Math.round(pillarPercent * 100) / 100,
  }
}

// ─────────────────────────────────────
// Manager Alpha Blending
// ─────────────────────────────────────

/**
 * Blend personal and team pillar percentages for TL/SH roles.
 *
 * Formula from SOP CC-SOP-KPI-001:
 *   Manager Pillar % = alpha x Team_Pillar_% + (1 - alpha) x Personal_Pillar_%
 *
 * Alpha values by tier and pillar (from SOP):
 *   Pillar | TL alpha | SH alpha
 *   A      |   0.45   |   0.49
 *   B      |   0.40   |   0.45
 *   C      |   0.45   |   0.49
 *   D      |   0.35   |   0.40
 *   E      |   0.10   |   0.05
 *   F      |   0.40   |   0.45
 *
 * If no team members exist, returns 100% personal score.
 */
export function calculateManagerPillar(input: AlphaBlendInput): number {
  const { personalPercent, teamPercent, alpha } = input
  const blended = alpha * teamPercent + (1 - alpha) * personalPercent
  return Math.round(blended * 100) / 100
}

/**
 * Calculate team pillar percentage as weighted average of team members' scores.
 *
 * For TL/SH who manage a single team, each member has equal weight (weight = 1).
 * For TL/SH who manage multiple teams, weight can represent team size.
 *
 * Members without approved scores are excluded (not penalized).
 * If no members have valid scores, returns null (caller should use personal only).
 */
export function calculateTeamPillarPercent(
  memberScores: { percent: number; weight: number }[]
): number | null {
  const validMembers = memberScores.filter(
    (m) => m.percent !== null && m.percent !== undefined
  )

  if (validMembers.length === 0) {
    return null
  }

  const totalWeight = validMembers.reduce((sum, m) => sum + m.weight, 0)

  if (totalWeight === 0) {
    // Equal weight fallback: simple average
    const avg =
      validMembers.reduce((sum, m) => sum + m.percent, 0) / validMembers.length
    return Math.round(avg * 100) / 100
  }

  const weightedSum = validMembers.reduce(
    (sum, m) => sum + m.percent * m.weight,
    0
  )
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

// ─────────────────────────────────────
// Overall Score
// ─────────────────────────────────────

/**
 * Calculate overall weighted score from pillar percentages and pillar weights.
 *
 * Formula from SOP CC-SOP-KPI-001:
 *   Overall Score = SUM( Pillar_% x Pillar_Weight_% / 100 )
 *
 * Pillar weights sum to 100 for each tier:
 *   Pillar | Junior/Eng | Senior | TL  | SH
 *   A      |     30     |   26   |  20 |  13
 *   B      |     25     |   23   |  20 |  17
 *   C      |     20     |   19   |  16 |  13
 *   D      |     10     |   14   |  17 |  19
 *   E      |     10     |    9   |   5 |   3
 *   F      |      5     |   10   |  22 |  36
 *
 * Pillars without results are excluded (their weight portion yields 0).
 */
export function calculateOverallScore(
  pillarResults: { pillarCode: string; percent: number }[],
  pillarWeights: { pillarCode: string; weight: number }[]
): number {
  let overall = 0

  for (const pw of pillarWeights) {
    const pillarResult = pillarResults.find(
      (p) => p.pillarCode === pw.pillarCode
    )
    if (pillarResult) {
      overall += (pillarResult.percent * pw.weight) / 100
    }
  }

  return Math.round(overall * 100) / 100
}

// ─────────────────────────────────────
// Appraisal Band
// ─────────────────────────────────────

/**
 * Map overall score to appraisal band.
 *
 * From SOP CC-SOP-KPI-001:
 *   90-100 = EXCEEDS (Exceeds Expectations)
 *   80-89  = STRONG
 *   70-79  = MEETS (Meets Expectations)
 *   60-69  = NEEDS_IMPROVEMENT
 *   < 60   = UNSATISFACTORY
 */
export function getAppraisalBand(overallScore: number): AppraisalBand {
  if (overallScore >= 90) return "EXCEEDS"
  if (overallScore >= 80) return "STRONG"
  if (overallScore >= 70) return "MEETS"
  if (overallScore >= 60) return "NEEDS_IMPROVEMENT"
  return "UNSATISFACTORY"
}

// ─────────────────────────────────────
// Full Scoring Pipeline
// ─────────────────────────────────────

/**
 * Run the full scoring pipeline for a user in an evaluation period.
 * This is called by the scoring API route (POST /api/kpis/scoring/run).
 *
 * The function accepts pre-fetched data (no database calls inside).
 * The API route is responsible for:
 *   - Fetching user assignments, approved actuals, targets, weights
 *   - Locking the eval period during scoring (isLocked = true)
 *   - Saving ScoreSnapshot records after this function returns
 *   - Unlocking the eval period
 *
 * Steps:
 *   1. Group KPIs by pillar code
 *   2. For each KPI: calculate individual score (0-5)
 *   3. For each pillar: calculate weighted pillar score and percent
 *   4. If TL/SH and alpha configs provided: blend personal + team pillar %
 *   5. Calculate overall weighted score
 *   6. Map to appraisal band
 *   7. Return full result tree
 *
 * Edge cases handled:
 *   - KPI with weight 0 for a tier: contributes nothing to pillar score
 *   - Missing actual (null): scores 0 for numeric KPIs
 *   - TL/SH with no team members: uses 100% personal score (no alpha blend)
 *   - Pillar with no assigned KPIs: excluded from overall calculation
 */
export function runScoring(params: {
  userId: string
  evalPeriodId: string
  tier: Tier
  kpiData: Array<{
    kpiCode: string
    pillarCode: string
    actualValue: number | null
    binaryValue: boolean | null
    targetValue: number
    direction: KpiDirection
    subWeight: number
  }>
  pillarWeights: Array<{ pillarCode: string; weight: number }>
  alphaConfigs?: Array<{ pillarCode: string; alpha: number }>
  teamPillarPercents?: Array<{ pillarCode: string; percent: number }>
}): FullScoringResult {
  const {
    userId,
    evalPeriodId,
    tier,
    kpiData,
    pillarWeights,
    alphaConfigs,
    teamPillarPercents,
  } = params

  // Step 1: Group KPIs by pillar
  const pillarGroups = new Map<string, typeof kpiData>()
  for (const kpi of kpiData) {
    const group = pillarGroups.get(kpi.pillarCode) || []
    group.push(kpi)
    pillarGroups.set(kpi.pillarCode, group)
  }

  // Steps 2-3: Calculate individual KPI scores and aggregate into pillar scores
  const pillarResults: PillarScoreResult[] = []

  for (const [pillarCode, kpis] of pillarGroups) {
    const kpiScores: KpiWeightedScore[] = kpis.map((kpi) => ({
      kpiCode: kpi.kpiCode,
      score: calculateKpiScore({
        actualValue: kpi.actualValue,
        binaryValue: kpi.binaryValue,
        targetValue: kpi.targetValue,
        direction: kpi.direction,
      }),
      weight: kpi.subWeight,
    }))

    const { score5, percent } = calculatePillarScore(kpiScores)

    pillarResults.push({
      pillarCode,
      score5,
      percent,
      kpiScores,
    })
  }

  // Step 4: Apply alpha blending for Team Leads and Section Heads
  const isManager = tier === "TEAM_LEAD" || tier === "SECTION_HEAD"

  if (isManager && alphaConfigs && teamPillarPercents) {
    for (const result of pillarResults) {
      const alphaConfig = alphaConfigs.find(
        (a) => a.pillarCode === result.pillarCode
      )
      const teamPercent = teamPillarPercents.find(
        (t) => t.pillarCode === result.pillarCode
      )

      if (alphaConfig && teamPercent) {
        // Blend personal and team scores
        result.percent = calculateManagerPillar({
          personalPercent: result.percent,
          teamPercent: teamPercent.percent,
          alpha: alphaConfig.alpha,
        })
        // Recalculate score5 from blended percent
        result.score5 = Math.round((result.percent / 20) * 100) / 100
      }
      // If no alpha config or team percent for this pillar, keep personal score
    }
  }

  // Step 5: Calculate overall score
  const overallScore = calculateOverallScore(pillarResults, pillarWeights)

  // Step 6: Map to appraisal band
  const appraisalBand = getAppraisalBand(overallScore)

  // Step 7: Return full result tree
  return {
    userId,
    evalPeriodId,
    pillarResults,
    overallScore,
    appraisalBand,
  }
}
