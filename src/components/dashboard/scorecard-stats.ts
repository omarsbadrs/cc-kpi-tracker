import type { HeroKpiStats } from "./ScorecardHero"

interface ScoredRow {
  code: string
  score: number | null
  status: string
}

/** A KPI is below target when it has a score under 5 (5 = met or beat target). */
function isBelowTarget(r: ScoredRow) {
  return r.score !== null && r.score < 5
}

export function kpiStats(rows: ScoredRow[]): HeroKpiStats {
  return {
    total: rows.length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    pending: rows.filter((r) => r.status === "SUBMITTED").length,
    belowTarget: rows.filter(isBelowTarget).length,
  }
}

/** Per pillar letter: how many KPIs, and how many fall short. */
export function kpiCountsByPillar(rows: ScoredRow[]): Record<string, { count: number; below: number }> {
  const out: Record<string, { count: number; below: number }> = {}
  for (const r of rows) {
    const code = r.code.charAt(0).toUpperCase()
    const entry = (out[code] ??= { count: 0, below: 0 })
    entry.count += 1
    if (isBelowTarget(r)) entry.below += 1
  }
  return out
}
