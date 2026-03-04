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

  // Verify period exists and is not already locked
  const period = await prisma.evalPeriod.findUnique({
    where: { id: evalPeriodId },
  })
  if (!period) return error(404, "NOT_FOUND", "Evaluation period not found")
  if (period.isLocked) {
    return error(
      409,
      "CONFLICT",
      "This period is already being scored by another process"
    )
  }

  // Lock the period during scoring (not for dry runs)
  if (!dryRun) {
    await prisma.evalPeriod.update({
      where: { id: evalPeriodId },
      data: { isLocked: true },
    })
  }

  try {
    const startTime = Date.now()

    // Get all users with active assignments for this period
    const assignments = await prisma.kpiAssignment.findMany({
      where: { evalPeriodId, isActive: true },
      include: {
        user: { select: { id: true, tier: true, role: true } },
        kpiDefinition: { include: { pillar: true } },
        actuals: {
          where: { evalPeriodId, status: "APPROVED" },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
    })

    // Group assignments by user
    const userAssignments = new Map<string, typeof assignments>()
    for (const a of assignments) {
      const group = userAssignments.get(a.userId) || []
      group.push(a)
      userAssignments.set(a.userId, group)
    }

    const results = []

    for (const [userId, userAssigns] of userAssignments) {
      const tier = userAssigns[0]!.user.tier

      // Get pillar weights for this tier
      const pillarWeights = await prisma.pillarWeight.findMany({
        where: { tier },
        include: { pillar: { select: { code: true } } },
      })

      // Get sub-KPI weights for this tier
      const subWeights = await prisma.subKpiWeight.findMany({
        where: { tier },
      })

      // Get targets for this tier
      const targets = await prisma.kpiTarget.findMany({ where: { tier } })

      // Build KPI data for the scoring engine
      const kpiData = userAssigns.map((a) => {
        const actual = a.actuals[0]
        const subWeight = subWeights.find(
          (sw) => sw.kpiDefinitionId === a.kpiDefinitionId
        )
        const target = targets.find(
          (t) => t.kpiDefinitionId === a.kpiDefinitionId
        )

        return {
          kpiCode: a.kpiDefinition.code,
          pillarCode: a.kpiDefinition.pillar.code,
          actualValue: actual?.actualValue ?? null,
          binaryValue: actual?.binaryValue ?? null,
          targetValue: a.targetOverride ?? target?.targetValue ?? 0,
          direction: a.kpiDefinition.direction,
          subWeight: subWeight?.weight ?? 0,
        }
      })

      // Alpha blending for managers (TL/SH)
      let alphaConfigs: Array<{ pillarCode: string; alpha: number }> | undefined
      let teamPillarPercents:
        | Array<{ pillarCode: string; percent: number }>
        | undefined

      if (tier === "TEAM_LEAD" || tier === "SECTION_HEAD") {
        const alphaRows = await prisma.alphaConfig.findMany({
          where: { tier },
          include: { pillar: { select: { code: true } } },
        })
        alphaConfigs = alphaRows.map((a) => ({
          pillarCode: a.pillar.code,
          alpha: a.alphaTeam,
        }))

        // Get team members for this manager
        const teamMembers = await prisma.teamMember.findMany({
          where: { leaderId: userId },
          select: { userId: true },
        })

        if (teamMembers.length > 0) {
          // Get team members' existing score snapshots for this period
          const memberIds = teamMembers.map((m) => m.userId)
          const memberSnapshots = await prisma.scoreSnapshot.findMany({
            where: {
              userId: { in: memberIds },
              evalPeriodId,
              pillarCode: { not: "OVERALL" },
            },
          })

          // Calculate team pillar percentages
          const pillarCodes = [
            ...new Set(memberSnapshots.map((s) => s.pillarCode)),
          ]
          teamPillarPercents = pillarCodes.map((code) => {
            const pillarSnapshots = memberSnapshots.filter(
              (s) => s.pillarCode === code
            )
            const avg =
              pillarSnapshots.reduce((sum, s) => sum + s.pillarPercent, 0) /
              pillarSnapshots.length
            return { pillarCode: code, percent: avg }
          })
        }
      }

      const result = runScoring({
        userId,
        evalPeriodId,
        tier,
        kpiData,
        pillarWeights: pillarWeights.map((pw) => ({
          pillarCode: pw.pillar.code,
          weight: pw.weight,
        })),
        alphaConfigs,
        teamPillarPercents,
      })

      results.push(result)

      // Save snapshots if not dry run
      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          // Save pillar snapshots
          for (const pr of result.pillarResults) {
            await tx.scoreSnapshot.upsert({
              where: {
                userId_evalPeriodId_pillarCode: {
                  userId,
                  evalPeriodId,
                  pillarCode: pr.pillarCode,
                },
              },
              create: {
                userId,
                evalPeriodId,
                pillarCode: pr.pillarCode,
                pillarScore: pr.score5,
                pillarPercent: pr.percent,
              },
              update: {
                pillarScore: pr.score5,
                pillarPercent: pr.percent,
                version: { increment: 1 },
                calculatedAt: new Date(),
              },
            })
          }

          // Save overall snapshot
          await tx.scoreSnapshot.upsert({
            where: {
              userId_evalPeriodId_pillarCode: {
                userId,
                evalPeriodId,
                pillarCode: "OVERALL",
              },
            },
            create: {
              userId,
              evalPeriodId,
              pillarCode: "OVERALL",
              pillarScore: result.overallScore / 20,
              pillarPercent: result.overallScore,
              overallScore: result.overallScore,
              appraisalBand: result.appraisalBand,
            },
            update: {
              pillarScore: result.overallScore / 20,
              pillarPercent: result.overallScore,
              overallScore: result.overallScore,
              appraisalBand: result.appraisalBand,
              version: { increment: 1 },
              calculatedAt: new Date(),
            },
          })
        })
      }
    }

    const durationMs = Date.now() - startTime
    logger.info(
      { evalPeriodId, usersScored: results.length, dryRun, durationMs },
      "Scoring engine completed"
    )

    // Log audit entry
    if (!dryRun) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RUN_SCORING",
          entity: "eval_period",
          entityId: evalPeriodId,
          newValue: {
            usersScored: results.length,
            durationMs,
          },
        },
      })
    }

    return success({ results, dryRun, usersScored: results.length })
  } finally {
    // Always unlock the period
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

  // Non-admins/managers can only see their own
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

  const snapshot = await prisma.scoreSnapshot.findUnique({
    where: { id: snapshotId },
  })
  if (!snapshot) return error(404, "NOT_FOUND", "Score snapshot not found")

  const oldScore = snapshot.pillarScore

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.scoreSnapshot.update({
      where: { id: snapshotId },
      data: {
        pillarScore: newScore,
        pillarPercent: newScore * 20,
        version: { increment: 1 },
        calculatedAt: new Date(),
      },
    })

    // Audit log for score override (mandatory)
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "OVERRIDE_SCORE",
        entity: "score_snapshot",
        entityId: snapshotId,
        oldValue: { pillarScore: oldScore },
        newValue: { pillarScore: newScore, comment },
      },
    })

    return result
  })

  logger.warn(
    {
      adminId: session.user.id,
      snapshotId,
      oldScore,
      newScore,
      comment,
    },
    "Score override applied"
  )

  return success(updated)
}, "ADMIN")
