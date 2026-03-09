import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api-handler"
import { success, error } from "@/lib/api-response"
import { runScoringSchema, overrideScoreSchema } from "@/lib/validations/scoring"
import { runScoring } from "@/lib/scoring-engine"
import { logger } from "@/lib/logger"

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json()
  const parsed = runScoringSchema.safeParse(body)
  if (!parsed.success) {
    return error(
      400,
      "VALIDATION_ERROR",
      "Invalid input",
      parsed.error.issues.map((i) => ({
        field: String(i.path[0]),
        message: i.message,
      }))
    )
  }

  const { evalPeriodId, dryRun } = parsed.data

  const period = await prisma.evalPeriod.findUnique({ where: { id: evalPeriodId } })
  if (!period) return error(404, "NOT_FOUND", "Evaluation period not found")
  if (period.isLocked) {
    return error(409, "CONFLICT", "This period is already being scored by another process")
  }

  if (!dryRun) {
    await prisma.evalPeriod.update({ where: { id: evalPeriodId }, data: { isLocked: true } })
  }

  try {
    const startTime = Date.now()

    // Get all active assignments with user info, KPI definition, and most recent actual
    // Counts both APPROVED and SUBMITTED actuals so scoring works even before formal review
    const assignments = await prisma.kpiAssignment.findMany({
      where: { evalPeriodId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            tier: true,
            role: true,
            isActive: true,
          },
        },
        kpiDefinition: { include: { pillar: { select: { code: true, name: true } } } },
        actuals: {
          where: {
            evalPeriodId,
            status: { in: ["APPROVED", "SUBMITTED"] },
          },
          take: 1,
          orderBy: [
            // Prefer APPROVED over SUBMITTED
            { status: "asc" },
            { updatedAt: "desc" },
          ],
        },
      },
    })

    // Only score active non-admin users
    const activeAssignments = assignments.filter((a) => a.user.isActive && a.user.role !== "ADMIN")

    // Group by user
    const userAssignments = new Map<string, typeof activeAssignments>()
    for (const a of activeAssignments) {
      const group = userAssignments.get(a.userId) ?? []
      group.push(a)
      userAssignments.set(a.userId, group)
    }

    // ── Batch-fetch all reference data upfront (one query per table, not per user) ──
    const [allPillarWeights, allSubWeights, allTargets, allAlphaConfigs, allManagerUsers] =
      await Promise.all([
        prisma.pillarWeight.findMany({ include: { pillar: { select: { code: true } } } }),
        prisma.subKpiWeight.findMany(),
        prisma.kpiTarget.findMany(),
        prisma.alphaConfig.findMany({ include: { pillar: { select: { code: true } } } }),
        // All users who have at least one report (for manager alpha lookup)
        prisma.user.findMany({
          where: { managerId: { not: null }, isActive: true },
          select: { id: true, managerId: true },
        }),
      ])

    // Pre-index by tier for O(1) lookup
    const pillarWeightsByTier = new Map<string, typeof allPillarWeights>()
    for (const pw of allPillarWeights) {
      const list = pillarWeightsByTier.get(pw.tier) ?? []
      list.push(pw)
      pillarWeightsByTier.set(pw.tier, list)
    }

    const subWeightsByTier = new Map<string, typeof allSubWeights>()
    for (const sw of allSubWeights) {
      const list = subWeightsByTier.get(sw.tier) ?? []
      list.push(sw)
      subWeightsByTier.set(sw.tier, list)
    }

    const targetsByTier = new Map<string, typeof allTargets>()
    for (const t of allTargets) {
      const list = targetsByTier.get(t.tier) ?? []
      list.push(t)
      targetsByTier.set(t.tier, list)
    }

    const alphaConfigsByTier = new Map<string, typeof allAlphaConfigs>()
    for (const ac of allAlphaConfigs) {
      const list = alphaConfigsByTier.get(ac.tier) ?? []
      list.push(ac)
      alphaConfigsByTier.set(ac.tier, list)
    }

    // Build managerId → [memberIds] map
    const reportsByManager = new Map<string, string[]>()
    for (const u of allManagerUsers) {
      if (!u.managerId) continue
      const list = reportsByManager.get(u.managerId) ?? []
      list.push(u.id)
      reportsByManager.set(u.managerId, list)
    }

    // Collect all member IDs for TL/SH users so we can batch-fetch their snapshots
    const tlShUserIds = [...userAssignments.keys()].filter((uid) => {
      const tier = userAssignments.get(uid)![0]!.user.tier
      return tier === "TEAM_LEAD" || tier === "SECTION_HEAD"
    })
    const allMemberIds = tlShUserIds.flatMap((uid) => reportsByManager.get(uid) ?? [])
    const memberSnapshotsMap = new Map<string, Array<{ pillarCode: string; pillarPercent: number }>>()

    if (allMemberIds.length > 0) {
      const memberSnapshots = await prisma.scoreSnapshot.findMany({
        where: { userId: { in: allMemberIds }, evalPeriodId, pillarCode: { not: "OVERALL" } },
        select: { userId: true, pillarCode: true, pillarPercent: true },
      })
      for (const s of memberSnapshots) {
        const list = memberSnapshotsMap.get(s.userId) ?? []
        list.push({ pillarCode: s.pillarCode, pillarPercent: s.pillarPercent })
        memberSnapshotsMap.set(s.userId, list)
      }
    }

    const results = []
    // Collect all save ops across all users for one final batch write
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSaveOps: any[] = []

    for (const [userId, userAssigns] of userAssignments) {
      const userInfo = userAssigns[0]!.user
      const tier = userInfo.tier

      const pillarWeights = pillarWeightsByTier.get(tier) ?? []
      const subWeights = subWeightsByTier.get(tier) ?? []
      const targets = targetsByTier.get(tier) ?? []

      // Build KPI data for the engine
      const kpiData = userAssigns.map((a) => {
        const actual = a.actuals[0]
        const subWeight = subWeights.find((sw) => sw.kpiDefinitionId === a.kpiDefinitionId)
        const target = targets.find((t) => t.kpiDefinitionId === a.kpiDefinitionId)

        return {
          kpiCode: a.kpiDefinition.code,
          kpiName: a.kpiDefinition.name,
          pillarCode: a.kpiDefinition.pillar.code,
          pillarName: a.kpiDefinition.pillar.name,
          actualValue: actual?.actualValue ?? null,
          binaryValue: actual?.binaryValue ?? null,
          actualStatus: actual?.status ?? null,
          actualId: actual?.id ?? null,
          targetValue: a.targetOverride ?? target?.targetValue ?? 0,
          targetOperator: target?.targetOperator ?? ">=",
          direction: a.kpiDefinition.direction,
          subWeight: subWeight?.weight ?? 0,
        }
      })

      // Alpha blending for TL/SH — use pre-fetched data
      let alphaConfigs: Array<{ pillarCode: string; alpha: number }> | undefined
      let teamPillarPercents: Array<{ pillarCode: string; percent: number }> | undefined

      if (tier === "TEAM_LEAD" || tier === "SECTION_HEAD") {
        const alphaRows = alphaConfigsByTier.get(tier) ?? []
        alphaConfigs = alphaRows.map((a) => ({ pillarCode: a.pillar.code, alpha: a.alphaTeam }))

        const memberIds = reportsByManager.get(userId) ?? []
        if (memberIds.length > 0) {
          // Aggregate team pillar percents from pre-fetched snapshots
          const pillarTotals = new Map<string, { sum: number; count: number }>()
          for (const memberId of memberIds) {
            const snaps = memberSnapshotsMap.get(memberId) ?? []
            for (const s of snaps) {
              const entry = pillarTotals.get(s.pillarCode) ?? { sum: 0, count: 0 }
              entry.sum += s.pillarPercent
              entry.count += 1
              pillarTotals.set(s.pillarCode, entry)
            }
          }
          teamPillarPercents = [...pillarTotals.entries()].map(([code, { sum, count }]) => ({
            pillarCode: code,
            percent: sum / count,
          }))
        }
      }

      const result = runScoring({
        userId,
        evalPeriodId,
        tier,
        kpiData,
        pillarWeights: pillarWeights.map((pw) => ({ pillarCode: pw.pillar.code, weight: pw.weight })),
        alphaConfigs,
        teamPillarPercents,
      })

      // Attach user info and detailed KPI data to the result for the UI
      const enrichedResult = {
        ...result,
        userName: `${userInfo.firstName} ${userInfo.lastName}`,
        userTier: tier,
        kpiDetail: kpiData.map((k) => {
          const pillarResult = result.pillarResults.find((pr) => pr.pillarCode === k.pillarCode)
          const kpiScoreEntry = pillarResult?.kpiScores.find((ks) => ks.kpiCode === k.kpiCode)
          return { ...k, kpiScore: kpiScoreEntry?.score ?? 0, subWeight: k.subWeight }
        }),
        pillarWeightsUsed: pillarWeights.map((pw) => ({ pillarCode: pw.pillar.code, weight: pw.weight })),
      }

      results.push(enrichedResult)

      // Collect save ops (executed in one batch after the loop)
      if (!dryRun) {
        for (const k of kpiData) {
          if (!k.actualId) continue
          const kpiScoreEntry = result.pillarResults
            .find((pr) => pr.pillarCode === k.pillarCode)
            ?.kpiScores.find((ks) => ks.kpiCode === k.kpiCode)
          if (kpiScoreEntry !== undefined) {
            allSaveOps.push(prisma.kpiActual.update({
              where: { id: k.actualId },
              data: { score: kpiScoreEntry.score },
            }))
          }
        }

        for (const pr of result.pillarResults) {
          allSaveOps.push(prisma.scoreSnapshot.upsert({
            where: { userId_evalPeriodId_pillarCode: { userId, evalPeriodId, pillarCode: pr.pillarCode } },
            create: { userId, evalPeriodId, pillarCode: pr.pillarCode, pillarScore: pr.score5, pillarPercent: pr.percent },
            update: { pillarScore: pr.score5, pillarPercent: pr.percent, version: { increment: 1 }, calculatedAt: new Date() },
          }))
        }

        allSaveOps.push(prisma.scoreSnapshot.upsert({
          where: { userId_evalPeriodId_pillarCode: { userId, evalPeriodId, pillarCode: "OVERALL" } },
          create: { userId, evalPeriodId, pillarCode: "OVERALL", pillarScore: result.overallScore / 20, pillarPercent: result.overallScore, overallScore: result.overallScore, appraisalBand: result.appraisalBand },
          update: { pillarScore: result.overallScore / 20, pillarPercent: result.overallScore, overallScore: result.overallScore, appraisalBand: result.appraisalBand, version: { increment: 1 }, calculatedAt: new Date() },
        }))
      }
    }

    // Execute all save ops in one batch transaction
    if (!dryRun && allSaveOps.length > 0) {
      await prisma.$transaction(allSaveOps)
    }

    const durationMs = Date.now() - startTime
    logger.info(
      { evalPeriodId, usersScored: results.length, dryRun, durationMs },
      "Scoring engine completed"
    )

    if (!dryRun) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RUN_SCORING",
          entity: "eval_period",
          entityId: evalPeriodId,
          newValue: { usersScored: results.length, durationMs },
        },
      })
    }

    return success({ results, dryRun, usersScored: results.length })
  } finally {
    if (!dryRun) {
      await prisma.evalPeriod.update({
        where: { id: evalPeriodId },
        data: { isLocked: false },
      })
    }
  }
}, "ADMIN")

export const GET = withAuth(async (req, { session }) => {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId") || session.user.id
  const evalPeriodId = searchParams.get("evalPeriodId")
  const pillarCode = searchParams.get("pillarCode") || undefined
  const appraisalBand = searchParams.get("appraisalBand") || undefined

  const effectiveUserId =
    session.user.role === "ADMIN" || session.user.role === "MANAGER"
      ? userId
      : session.user.id

  const where: Record<string, unknown> = { userId: effectiveUserId }
  if (evalPeriodId) where.evalPeriodId = evalPeriodId
  if (pillarCode) where.pillarCode = pillarCode
  if (appraisalBand) where.appraisalBand = appraisalBand

  const snapshots = await prisma.scoreSnapshot.findMany({
    where,
    orderBy: { calculatedAt: "desc" },
  })

  return success(snapshots)
})

export const PATCH = withAuth(async (req, { session }) => {
  const body = await req.json()
  const parsed = overrideScoreSchema.safeParse(body)
  if (!parsed.success) {
    return error(
      400,
      "VALIDATION_ERROR",
      "Invalid input",
      parsed.error.issues.map((i) => ({
        field: String(i.path[0]),
        message: i.message,
      }))
    )
  }

  const { snapshotId, newScore, comment } = parsed.data

  const snapshot = await prisma.scoreSnapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) return error(404, "NOT_FOUND", "Score snapshot not found")

  const oldScore = snapshot.pillarScore

  const [updated] = await prisma.$transaction([
    prisma.scoreSnapshot.update({
      where: { id: snapshotId },
      data: {
        pillarScore: newScore,
        pillarPercent: newScore * 20,
        version: { increment: 1 },
        calculatedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OVERRIDE_SCORE",
        entity: "score_snapshot",
        entityId: snapshotId,
        oldValue: { pillarScore: oldScore },
        newValue: { pillarScore: newScore, comment },
      },
    }),
  ])

  logger.warn({ adminId: session.user.id, snapshotId, oldScore, newScore, comment }, "Score override applied")
  return success(updated)
}, "ADMIN")
