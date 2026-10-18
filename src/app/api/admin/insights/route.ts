import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"

export const GET = withAuth(async (req, { session }) => {
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return error(403, "FORBIDDEN", "Insufficient permissions")
  }

  const { searchParams } = new URL(req.url)
  const evalPeriodId  = searchParams.get("evalPeriodId")  || undefined
  const tierFilter    = searchParams.get("tier")           || undefined  // e.g. "ENGINEER"
  const pillarFilter  = searchParams.get("pillarCode")     || undefined  // e.g. "A"

  // ── 1. Users (apply tier filter here) ─────────────────────
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: "ADMIN" },
      ...(tierFilter ? { tier: tierFilter as import("@prisma/client").Tier } : {}),
    },
    select: { id: true, tier: true, role: true, firstName: true, lastName: true, createdAt: true, graduationYear: true },
  })
  const userIds = users.map((u) => u.id)

  // ── 2. Actuals (filter by period, pillar, and scoped user set) ──
  const actualsWhere: Record<string, unknown> = {}
  if (evalPeriodId) actualsWhere.evalPeriodId = evalPeriodId
  if (userIds.length > 0) actualsWhere.userId = { in: userIds }
  if (pillarFilter) {
    actualsWhere.assignment = {
      kpiDefinition: { pillar: { code: pillarFilter } },
    }
  }

  // ── 3. Snapshots (filter by period and scoped user set) ────
  const snapsWhere: Record<string, unknown> = {}
  if (evalPeriodId) snapsWhere.evalPeriodId = evalPeriodId
  if (userIds.length > 0) snapsWhere.userId = { in: userIds }

  // ── Assignments where clause (same tier/user scope, but no pillar filter — we count all) ──
  const assignmentsWhere: Record<string, unknown> = { isActive: true }
  if (evalPeriodId) assignmentsWhere.evalPeriodId = evalPeriodId
  if (userIds.length > 0) assignmentsWhere.userId = { in: userIds }

  const [actuals, snapshots, periods, totalAssignedKpis] = await Promise.all([
    prisma.kpiActual.findMany({
      where: actualsWhere,
      select: {
        status: true,
        score: true,
        userId: true,
        assignment: {
          select: {
            kpiDefinition: {
              select: { pillar: { select: { code: true, name: true } } },
            },
          },
        },
      },
    }),

    prisma.scoreSnapshot.findMany({
      where: snapsWhere,
      select: {
        userId: true,
        pillarCode: true,
        pillarPercent: true,
        pillarScore: true,
        overallScore: true,
        appraisalBand: true,
        evalPeriodId: true,
      },
    }),

    prisma.evalPeriod.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true },
      take: 12,
    }),

    prisma.kpiAssignment.count({ where: assignmentsWhere }),
  ])

  // ── Headcount by tier ──────────────────────────────────────
  const tierCounts: Record<string, number> = {}
  for (const u of users) {
    tierCounts[u.tier] = (tierCounts[u.tier] ?? 0) + 1
  }
  const headcountByTier = Object.entries(tierCounts).map(([tier, count]) => ({ tier, count }))

  // ── Appraisal band distribution ────────────────────────────
  const overallSnaps = snapshots.filter((s) => s.pillarCode === "OVERALL" && s.overallScore !== null)
  const bandCounts: Record<string, number> = {}
  for (const s of overallSnaps) {
    const band = s.appraisalBand ?? "UNSATISFACTORY"
    bandCounts[band] = (bandCounts[band] ?? 0) + 1
  }
  const bandDistribution = [
    "EXCEEDS", "STRONG", "MEETS", "NEEDS_IMPROVEMENT", "UNSATISFACTORY",
  ].map((band) => ({ band, count: bandCounts[band] ?? 0 }))

  // ── Submission status breakdown ────────────────────────────
  const statusCounts: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0 }
  for (const a of actuals) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
  }
  const submissionStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  // ── Per-pillar average scores ──────────────────────────────
  const pillarAccum: Record<string, { sum: number; count: number }> = {}
  for (const s of snapshots) {
    if (s.pillarCode === "OVERALL") continue
    if (pillarFilter && s.pillarCode !== pillarFilter) continue
    if (!pillarAccum[s.pillarCode]) pillarAccum[s.pillarCode] = { sum: 0, count: 0 }
    pillarAccum[s.pillarCode]!.sum += s.pillarPercent
    pillarAccum[s.pillarCode]!.count += 1
  }
  const pillarAverages = Object.entries(pillarAccum).map(([code, { sum, count }]) => ({
    pillarCode: code,
    avgPercent: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
  })).sort((a, b) => a.pillarCode.localeCompare(b.pillarCode))

  // ── Approval rate by pillar ────────────────────────────────
  const pillarActuals: Record<string, { approved: number; total: number; name: string }> = {}
  for (const a of actuals) {
    const code = a.assignment.kpiDefinition.pillar.code
    const name = a.assignment.kpiDefinition.pillar.name
    if (!pillarActuals[code]) pillarActuals[code] = { approved: 0, total: 0, name }
    pillarActuals[code]!.total += 1
    if (a.status === "APPROVED") pillarActuals[code]!.approved += 1
  }
  const approvalByPillar = Object.entries(pillarActuals).map(([code, { approved, total, name }]) => ({
    pillarCode: code, name,
    approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    approved, total,
  })).sort((a, b) => a.pillarCode.localeCompare(b.pillarCode))

  // ── Top 10 and lowest 5 performers ────────────────────────
  const userMap = new Map(users.map((u) => [u.id, u]))
  const ranked = overallSnaps
    .filter((s) => userMap.has(s.userId))
    .map((s) => ({
      userId: s.userId,
      name: `${userMap.get(s.userId)!.firstName} ${userMap.get(s.userId)!.lastName}`,
      tier: userMap.get(s.userId)!.tier,
      overallScore: s.overallScore!,
      appraisalBand: s.appraisalBand,
    }))
    .sort((a, b) => b.overallScore - a.overallScore)
  const topPerformers = ranked.slice(0, 10)
  // The bottom of the same ranking, lowest first, never overlapping the top.
  const lowestPerformers = ranked.slice(Math.max(10, ranked.length - 5)).reverse()

  // ── KPI score distribution (0–5) ─────────────────────────
  const scoreDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const a of actuals) {
    if (a.score !== null) scoreDist[a.score] = (scoreDist[a.score] ?? 0) + 1
  }
  const scoreDistribution = Object.entries(scoreDist).map(([score, count]) => ({
    score: Number(score), count,
  }))

  // ── Score trend across periods ─────────────────────────────
  // Trend always uses full-dept snapshots (no tier/pillar filter) to show real trend
  const trendSnaps = await prisma.scoreSnapshot.findMany({
    where: { pillarCode: "OVERALL", ...(userIds.length > 0 ? { userId: { in: userIds } } : {}) },
    select: { overallScore: true, evalPeriodId: true },
  })
  const periodScoreMap: Record<string, { sum: number; count: number }> = {}
  for (const snap of trendSnaps) {
    if (snap.overallScore === null) continue
    const period = periods.find((p) => p.id === snap.evalPeriodId)
    if (!period) continue
    if (!periodScoreMap[period.id]) periodScoreMap[period.id] = { sum: 0, count: 0 }
    periodScoreMap[period.id]!.sum += snap.overallScore
    periodScoreMap[period.id]!.count += 1
  }
  const scoreTrend = periods
    .filter((p) => periodScoreMap[p.id])
    .map((p) => ({
      periodName: p.name,
      avgScore: Math.round((periodScoreMap[p.id]!.sum / periodScoreMap[p.id]!.count) * 10) / 10,
    }))

  // ── Summary stats ─────────────────────────────────────────
  const totalApproved = actuals.filter((a) => a.status === "APPROVED").length
  const totalPending  = actuals.filter((a) => a.status === "SUBMITTED").length
  const avgOverall    = overallSnaps.length > 0
    ? Math.round((overallSnaps.reduce((s, x) => s + (x.overallScore ?? 0), 0) / overallSnaps.length) * 10) / 10
    : 0

  // Average experience: years since graduation year (current year − graduationYear)
  // Only count users who have a graduationYear set
  const currentYear = new Date().getFullYear()
  const usersWithGradYear = users.filter((u) => u.graduationYear != null)
  const avgExperienceYears = usersWithGradYear.length > 0
    ? Math.round(
        (usersWithGradYear.reduce((sum, u) => sum + (currentYear - u.graduationYear!), 0) / usersWithGradYear.length) * 10
      ) / 10
    : 0

  return success({
    summary: {
      totalStaff: users.length,
      totalAssignedKpis,
      totalActuals: actuals.length,
      totalApproved,
      totalPending,
      avgOverallScore: avgOverall,
      scoredUsers: overallSnaps.length,
      avgExperienceYears,
    },
    headcountByTier,
    bandDistribution,
    submissionStatus,
    pillarAverages,
    approvalByPillar,
    topPerformers,
    lowestPerformers,
    scoreDistribution,
    scoreTrend,
  })
})
