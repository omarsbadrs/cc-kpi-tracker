/**
 * Scoring Engine — Exhaustive Unit Tests
 * Tests all boundary conditions from SOP CC-SOP-KPI-001
 * Reference: CLAUDE.md Section 12.3
 */
import { describe, it, expect } from "vitest"
import {
  calculateKpiScore,
  calculatePillarScore,
  calculateManagerPillar,
  calculateTeamPillarPercent,
  calculateOverallScore,
  getAppraisalBand,
  runScoring,
} from "@/lib/scoring-engine"

// ─────────────────────────────────────
// calculateKpiScore
// ─────────────────────────────────────

describe("calculateKpiScore", () => {
  describe("Direction = HIGHER (higher is better)", () => {
    const base = { binaryValue: null, targetValue: 95, direction: "HIGHER" as const }

    it("scores 5 when actual equals target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 95 })).toBe(5)
    })

    it("scores 5 when actual exceeds target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 96 })).toBe(5)
      expect(calculateKpiScore({ ...base, actualValue: 100 })).toBe(5)
    })

    it("scores 4 when 1pp below target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 94 })).toBe(4)
    })

    it("scores 4 when 3pp below target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 92 })).toBe(4)
    })

    it("scores 3 when 4pp below target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 91 })).toBe(3)
    })

    it("scores 3 when 6pp below target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 89 })).toBe(3)
    })

    it("scores 2 when 7pp below target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 88 })).toBe(2)
    })

    it("scores 2 when 10pp below target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 85 })).toBe(2)
    })

    it("scores 1 when 11pp below target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 84 })).toBe(1)
    })

    it("scores 1 when 15pp below target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 80 })).toBe(1)
    })

    it("scores 0 when 16pp below target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 79 })).toBe(0)
    })

    it("scores 0 at extreme low (0%)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 0 })).toBe(0)
    })

    it("scores 0 when actual is null", () => {
      expect(calculateKpiScore({ ...base, actualValue: null })).toBe(0)
    })
  })

  describe("Direction = LOWER (lower is better)", () => {
    const base = { binaryValue: null, targetValue: 5, direction: "LOWER" as const }

    it("scores 5 when actual equals target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 5 })).toBe(5)
    })

    it("scores 5 when actual is below target (better)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 3 })).toBe(5)
      expect(calculateKpiScore({ ...base, actualValue: 0 })).toBe(5)
    })

    it("scores 4 when 1pp above target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 6 })).toBe(4)
    })

    it("scores 4 when 3pp above target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 8 })).toBe(4)
    })

    it("scores 3 when 4pp above target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 9 })).toBe(3)
    })

    it("scores 3 when 6pp above target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 11 })).toBe(3)
    })

    it("scores 2 when 7pp above target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 12 })).toBe(2)
    })

    it("scores 2 when 10pp above target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 15 })).toBe(2)
    })

    it("scores 1 when 11pp above target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 16 })).toBe(1)
    })

    it("scores 1 when 15pp above target (boundary)", () => {
      expect(calculateKpiScore({ ...base, actualValue: 20 })).toBe(1)
    })

    it("scores 0 when 16pp above target", () => {
      expect(calculateKpiScore({ ...base, actualValue: 21 })).toBe(0)
    })

    it("scores 0 when actual is null", () => {
      expect(calculateKpiScore({ ...base, actualValue: null })).toBe(0)
    })
  })

  describe("Direction = BINARY", () => {
    const base = { actualValue: null, targetValue: 0, direction: "BINARY" as const }

    it("scores 5 for Pass (true)", () => {
      expect(calculateKpiScore({ ...base, binaryValue: true })).toBe(5)
    })

    it("scores 0 for Fail (false)", () => {
      expect(calculateKpiScore({ ...base, binaryValue: false })).toBe(0)
    })

    it("scores 0 for null binary value", () => {
      expect(calculateKpiScore({ ...base, binaryValue: null })).toBe(0)
    })
  })
})

// ─────────────────────────────────────
// calculatePillarScore
// ─────────────────────────────────────

describe("calculatePillarScore", () => {
  it("calculates pillar score from weighted KPI scores", () => {
    // Example from CLAUDE.md Section 12.3:
    // KPI scores: [4, 5, 3], weights: [50, 30, 20]
    // Pillar score = (4×50 + 5×30 + 3×20) / 100 = 4.10
    // Pillar % = 4.10 × 20 = 82%
    const result = calculatePillarScore([
      { kpiCode: "A1", score: 4, weight: 50 },
      { kpiCode: "A2", score: 5, weight: 30 },
      { kpiCode: "A3", score: 3, weight: 20 },
    ])
    expect(result.score5).toBe(4.1)
    expect(result.percent).toBe(82)
  })

  it("returns 0 for empty KPI scores", () => {
    const result = calculatePillarScore([])
    expect(result.score5).toBe(0)
    expect(result.percent).toBe(0)
  })

  it("handles all-5 scores correctly", () => {
    const result = calculatePillarScore([
      { kpiCode: "A1", score: 5, weight: 60 },
      { kpiCode: "A2", score: 5, weight: 40 },
    ])
    expect(result.score5).toBe(5)
    expect(result.percent).toBe(100)
  })

  it("handles all-0 scores correctly", () => {
    const result = calculatePillarScore([
      { kpiCode: "A1", score: 0, weight: 60 },
      { kpiCode: "A2", score: 0, weight: 40 },
    ])
    expect(result.score5).toBe(0)
    expect(result.percent).toBe(0)
  })

  it("handles KPI with weight 0 (not assigned to tier)", () => {
    const result = calculatePillarScore([
      { kpiCode: "A1", score: 5, weight: 100 },
      { kpiCode: "A2", score: 0, weight: 0 }, // 0 weight = skip
    ])
    expect(result.score5).toBe(5)
    expect(result.percent).toBe(100)
  })

  it("handles single KPI with full weight", () => {
    const result = calculatePillarScore([
      { kpiCode: "F1", score: 3, weight: 100 },
    ])
    expect(result.score5).toBe(3)
    expect(result.percent).toBe(60)
  })

  it("handles mixed binary and numeric scores", () => {
    // B4 is binary (score 5 or 0), B1-B3 are numeric
    const result = calculatePillarScore([
      { kpiCode: "B1", score: 4, weight: 25 },
      { kpiCode: "B2", score: 5, weight: 25 },
      { kpiCode: "B3", score: 3, weight: 25 },
      { kpiCode: "B4", score: 5, weight: 25 }, // Pass
    ])
    // (4×25 + 5×25 + 3×25 + 5×25) / 100 = (100+125+75+125)/100 = 4.25
    expect(result.score5).toBe(4.25)
    expect(result.percent).toBe(85)
  })
})

// ─────────────────────────────────────
// calculateManagerPillar (alpha blending)
// ─────────────────────────────────────

describe("calculateManagerPillar", () => {
  it("blends personal and team scores with alpha", () => {
    // Example from CLAUDE.md Section 12.3:
    // Personal C% = 88, Team C% = 80, α = 0.45
    // Result = 0.45 × 80 + 0.55 × 88 = 84.4
    const result = calculateManagerPillar({
      personalPercent: 88,
      teamPercent: 80,
      alpha: 0.45,
    })
    expect(result).toBe(84.4)
  })

  it("returns personal score when alpha is 0", () => {
    const result = calculateManagerPillar({
      personalPercent: 90,
      teamPercent: 70,
      alpha: 0,
    })
    expect(result).toBe(90)
  })

  it("returns team score when alpha is 1", () => {
    const result = calculateManagerPillar({
      personalPercent: 90,
      teamPercent: 70,
      alpha: 1,
    })
    expect(result).toBe(70)
  })

  it("handles equal personal and team scores", () => {
    const result = calculateManagerPillar({
      personalPercent: 85,
      teamPercent: 85,
      alpha: 0.45,
    })
    expect(result).toBe(85)
  })

  it("handles Pillar E with low alpha for SH (0.05)", () => {
    const result = calculateManagerPillar({
      personalPercent: 95,
      teamPercent: 60,
      alpha: 0.05,
    })
    // 0.05 × 60 + 0.95 × 95 = 3 + 90.25 = 93.25
    expect(result).toBe(93.25)
  })
})

// ─────────────────────────────────────
// calculateTeamPillarPercent
// ─────────────────────────────────────

describe("calculateTeamPillarPercent", () => {
  it("calculates simple average for equal weights", () => {
    const result = calculateTeamPillarPercent([
      { percent: 80, weight: 1 },
      { percent: 90, weight: 1 },
      { percent: 70, weight: 1 },
    ])
    expect(result).toBe(80)
  })

  it("calculates weighted average for different team sizes", () => {
    const result = calculateTeamPillarPercent([
      { percent: 80, weight: 3 }, // team of 3
      { percent: 90, weight: 2 }, // team of 2
    ])
    // (80×3 + 90×2) / (3+2) = (240+180)/5 = 84
    expect(result).toBe(84)
  })

  it("returns null when no members have scores", () => {
    const result = calculateTeamPillarPercent([])
    expect(result).toBeNull()
  })

  it("handles single team member", () => {
    const result = calculateTeamPillarPercent([
      { percent: 75, weight: 1 },
    ])
    expect(result).toBe(75)
  })

  it("handles all-zero weights by falling back to simple average", () => {
    const result = calculateTeamPillarPercent([
      { percent: 80, weight: 0 },
      { percent: 90, weight: 0 },
    ])
    expect(result).toBe(85)
  })
})

// ─────────────────────────────────────
// calculateOverallScore
// ─────────────────────────────────────

describe("calculateOverallScore", () => {
  it("calculates overall from pillar results and weights (Junior/Engineer tier)", () => {
    // Pillar weights for Junior/Engineer: A=30, B=25, C=20, D=10, E=10, F=5
    const result = calculateOverallScore(
      [
        { pillarCode: "A", percent: 90 },
        { pillarCode: "B", percent: 80 },
        { pillarCode: "C", percent: 70 },
        { pillarCode: "D", percent: 85 },
        { pillarCode: "E", percent: 95 },
        { pillarCode: "F", percent: 60 },
      ],
      [
        { pillarCode: "A", weight: 30 },
        { pillarCode: "B", weight: 25 },
        { pillarCode: "C", weight: 20 },
        { pillarCode: "D", weight: 10 },
        { pillarCode: "E", weight: 10 },
        { pillarCode: "F", weight: 5 },
      ]
    )
    // (90×30 + 80×25 + 70×20 + 85×10 + 95×10 + 60×5) / 100
    // = (2700 + 2000 + 1400 + 850 + 950 + 300) / 100
    // = 8200 / 100 = 82
    expect(result).toBe(82)
  })

  it("returns 100 when all pillars score 100%", () => {
    const pillars = ["A", "B", "C", "D", "E", "F"]
    const results = pillars.map((p) => ({ pillarCode: p, percent: 100 }))
    const weights = [
      { pillarCode: "A", weight: 30 },
      { pillarCode: "B", weight: 25 },
      { pillarCode: "C", weight: 20 },
      { pillarCode: "D", weight: 10 },
      { pillarCode: "E", weight: 10 },
      { pillarCode: "F", weight: 5 },
    ]
    expect(calculateOverallScore(results, weights)).toBe(100)
  })

  it("returns 0 when all pillars score 0%", () => {
    const pillars = ["A", "B", "C", "D", "E", "F"]
    const results = pillars.map((p) => ({ pillarCode: p, percent: 0 }))
    const weights = [
      { pillarCode: "A", weight: 30 },
      { pillarCode: "B", weight: 25 },
      { pillarCode: "C", weight: 20 },
      { pillarCode: "D", weight: 10 },
      { pillarCode: "E", weight: 10 },
      { pillarCode: "F", weight: 5 },
    ]
    expect(calculateOverallScore(results, weights)).toBe(0)
  })

  it("handles missing pillar results gracefully", () => {
    // Only 2 pillars have results
    const result = calculateOverallScore(
      [
        { pillarCode: "A", percent: 100 },
        { pillarCode: "B", percent: 100 },
      ],
      [
        { pillarCode: "A", weight: 30 },
        { pillarCode: "B", weight: 25 },
        { pillarCode: "C", weight: 20 },
        { pillarCode: "D", weight: 10 },
        { pillarCode: "E", weight: 10 },
        { pillarCode: "F", weight: 5 },
      ]
    )
    // Only A and B contribute: (100×30 + 100×25) / 100 = 55
    expect(result).toBe(55)
  })

  it("uses Section Head weights correctly", () => {
    // SH weights: A=13, B=17, C=13, D=19, E=3, F=36
    const result = calculateOverallScore(
      [
        { pillarCode: "A", percent: 80 },
        { pillarCode: "B", percent: 80 },
        { pillarCode: "C", percent: 80 },
        { pillarCode: "D", percent: 80 },
        { pillarCode: "E", percent: 80 },
        { pillarCode: "F", percent: 80 },
      ],
      [
        { pillarCode: "A", weight: 13 },
        { pillarCode: "B", weight: 17 },
        { pillarCode: "C", weight: 13 },
        { pillarCode: "D", weight: 19 },
        { pillarCode: "E", weight: 3 },
        { pillarCode: "F", weight: 36 },
      ]
    )
    // All 80% with weights summing to 101 (SH per spec sums vary)
    // (80 × 101) / 100 = 80.8
    // Actually SH weights: 13+17+13+19+3+36 = 101, per spec they should sum to ~100
    // But calculation is still: 80 * (sum of weights) / 100
    expect(result).toBe(80.8)
  })
})

// ─────────────────────────────────────
// getAppraisalBand
// ─────────────────────────────────────

describe("getAppraisalBand", () => {
  it("maps 90-100 to EXCEEDS", () => {
    expect(getAppraisalBand(90)).toBe("EXCEEDS")
    expect(getAppraisalBand(95)).toBe("EXCEEDS")
    expect(getAppraisalBand(100)).toBe("EXCEEDS")
  })

  it("maps 80-89 to STRONG", () => {
    expect(getAppraisalBand(80)).toBe("STRONG")
    expect(getAppraisalBand(85)).toBe("STRONG")
    expect(getAppraisalBand(89)).toBe("STRONG")
    expect(getAppraisalBand(89.99)).toBe("STRONG")
  })

  it("maps 70-79 to MEETS", () => {
    expect(getAppraisalBand(70)).toBe("MEETS")
    expect(getAppraisalBand(75)).toBe("MEETS")
    expect(getAppraisalBand(79)).toBe("MEETS")
  })

  it("maps 60-69 to NEEDS_IMPROVEMENT", () => {
    expect(getAppraisalBand(60)).toBe("NEEDS_IMPROVEMENT")
    expect(getAppraisalBand(65)).toBe("NEEDS_IMPROVEMENT")
    expect(getAppraisalBand(69)).toBe("NEEDS_IMPROVEMENT")
  })

  it("maps < 60 to UNSATISFACTORY", () => {
    expect(getAppraisalBand(59)).toBe("UNSATISFACTORY")
    expect(getAppraisalBand(59.99)).toBe("UNSATISFACTORY")
    expect(getAppraisalBand(0)).toBe("UNSATISFACTORY")
    expect(getAppraisalBand(30)).toBe("UNSATISFACTORY")
  })

  // Boundary tests
  it("handles exact boundaries", () => {
    expect(getAppraisalBand(90)).toBe("EXCEEDS")
    expect(getAppraisalBand(89.999)).toBe("STRONG")
    expect(getAppraisalBand(80)).toBe("STRONG")
    expect(getAppraisalBand(79.999)).toBe("MEETS")
    expect(getAppraisalBand(70)).toBe("MEETS")
    expect(getAppraisalBand(69.999)).toBe("NEEDS_IMPROVEMENT")
    expect(getAppraisalBand(60)).toBe("NEEDS_IMPROVEMENT")
    expect(getAppraisalBand(59.999)).toBe("UNSATISFACTORY")
  })
})

// ─────────────────────────────────────
// runScoring (full pipeline)
// ─────────────────────────────────────

describe("runScoring", () => {
  it("runs full scoring pipeline for an Engineer", () => {
    const result = runScoring({
      userId: "user-1",
      evalPeriodId: "period-1",
      tier: "ENGINEER",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: 96, binaryValue: null, targetValue: 96, direction: "HIGHER", subWeight: 8 },
        { kpiCode: "A1.8", pillarCode: "A", actualValue: 95, binaryValue: null, targetValue: 96, direction: "HIGHER", subWeight: 10 },
        { kpiCode: "A2.1", pillarCode: "A", actualValue: 100, binaryValue: null, targetValue: 100, direction: "HIGHER", subWeight: 8 },
        // Remaining A weights distributed to these 3 for simplicity (sum < 100 is ok for test)
        { kpiCode: "B1", pillarCode: "B", actualValue: 3, binaryValue: null, targetValue: 4, direction: "LOWER", subWeight: 20 },
        { kpiCode: "B2", pillarCode: "B", actualValue: 93, binaryValue: null, targetValue: 92, direction: "HIGHER", subWeight: 30 },
        { kpiCode: "B4", pillarCode: "B", actualValue: null, binaryValue: true, targetValue: 0, direction: "BINARY", subWeight: 20 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 30 },
        { pillarCode: "B", weight: 25 },
      ],
    })

    expect(result.userId).toBe("user-1")
    expect(result.evalPeriodId).toBe("period-1")
    expect(result.pillarResults.length).toBe(2) // A and B
    expect(result.overallScore).toBeGreaterThan(0)
    expect(["EXCEEDS", "STRONG", "MEETS", "NEEDS_IMPROVEMENT", "UNSATISFACTORY"]).toContain(result.appraisalBand)
  })

  it("applies alpha blending for Team Lead", () => {
    const result = runScoring({
      userId: "tl-1",
      evalPeriodId: "period-1",
      tier: "TEAM_LEAD",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: 98, binaryValue: null, targetValue: 98, direction: "HIGHER", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 100 },
      ],
      alphaConfigs: [
        { pillarCode: "A", alpha: 0.45 },
      ],
      teamPillarPercents: [
        { pillarCode: "A", percent: 80 },
      ],
    })

    // Personal A: score 5, pillar % = 100
    // Team A: 80
    // Blended: 0.45 × 80 + 0.55 × 100 = 36 + 55 = 91
    expect(result.pillarResults[0]!.percent).toBe(91)
    expect(result.overallScore).toBe(91)
    expect(result.appraisalBand).toBe("EXCEEDS")
  })

  it("uses 100% personal when no alpha configs provided for manager", () => {
    const result = runScoring({
      userId: "tl-2",
      evalPeriodId: "period-1",
      tier: "TEAM_LEAD",
      kpiData: [
        { kpiCode: "B1", pillarCode: "B", actualValue: 2, binaryValue: null, targetValue: 4, direction: "LOWER", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "B", weight: 100 },
      ],
      // No alphaConfigs or teamPillarPercents
    })

    // B1: actual=2, target=4, LOWER direction, gap=2-4=-2 → gap<=0 → score 5
    // Pillar score: 5×100/100 = 5, percent = 100
    expect(result.pillarResults[0]!.percent).toBe(100)
    expect(result.overallScore).toBe(100)
  })

  it("handles all KPIs scoring 5 → overall 100 → Exceeds", () => {
    const result = runScoring({
      userId: "user-perfect",
      evalPeriodId: "period-1",
      tier: "JUNIOR",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: 95, binaryValue: null, targetValue: 95, direction: "HIGHER", subWeight: 50 },
        { kpiCode: "A1.2", pillarCode: "A", actualValue: 95, binaryValue: null, targetValue: 95, direction: "HIGHER", subWeight: 50 },
        { kpiCode: "B1", pillarCode: "B", actualValue: 3, binaryValue: null, targetValue: 5, direction: "LOWER", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 60 },
        { pillarCode: "B", weight: 40 },
      ],
    })

    expect(result.overallScore).toBe(100)
    expect(result.appraisalBand).toBe("EXCEEDS")
  })

  it("handles all KPIs scoring 0 → overall 0 → Unsatisfactory", () => {
    const result = runScoring({
      userId: "user-zero",
      evalPeriodId: "period-1",
      tier: "JUNIOR",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: 50, binaryValue: null, targetValue: 95, direction: "HIGHER", subWeight: 100 },
        { kpiCode: "B4", pillarCode: "B", actualValue: null, binaryValue: false, targetValue: 0, direction: "BINARY", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 60 },
        { pillarCode: "B", weight: 40 },
      ],
    })

    expect(result.overallScore).toBe(0)
    expect(result.appraisalBand).toBe("UNSATISFACTORY")
  })

  it("skips pillars with no assigned KPIs", () => {
    const result = runScoring({
      userId: "user-partial",
      evalPeriodId: "period-1",
      tier: "ENGINEER",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: 96, binaryValue: null, targetValue: 96, direction: "HIGHER", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 30 },
        { pillarCode: "B", weight: 25 },
        { pillarCode: "C", weight: 20 },
        { pillarCode: "D", weight: 10 },
        { pillarCode: "E", weight: 10 },
        { pillarCode: "F", weight: 5 },
      ],
    })

    // Only A has KPIs: score 5, percent 100
    // Overall: 100 × 30 / 100 = 30 (only A contributes)
    expect(result.pillarResults.length).toBe(1)
    expect(result.overallScore).toBe(30)
  })

  it("handles missing actuals (null) scoring 0", () => {
    const result = runScoring({
      userId: "user-missing",
      evalPeriodId: "period-1",
      tier: "ENGINEER",
      kpiData: [
        { kpiCode: "A1.1", pillarCode: "A", actualValue: null, binaryValue: null, targetValue: 96, direction: "HIGHER", subWeight: 100 },
      ],
      pillarWeights: [
        { pillarCode: "A", weight: 100 },
      ],
    })

    // Null actual → score 0
    expect(result.pillarResults[0]!.kpiScores[0]!.score).toBe(0)
    expect(result.overallScore).toBe(0)
  })
})
