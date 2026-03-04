import { z } from "zod"

export const runScoringSchema = z.object({
  evalPeriodId: z.string(),
  dryRun: z.boolean().default(false),
})

export const overrideScoreSchema = z.object({
  snapshotId: z.string(),
  newScore: z.number().min(0).max(5),
  comment: z.string().min(10, "Override comment must be at least 10 characters"),
})
