import { z } from "zod"

export const createAssignmentSchema = z.object({
  userId: z.string(),
  kpiDefinitionId: z.string(),
  evalPeriodId: z.string(),
  targetOverride: z.number().optional(),
  weightOverride: z.number().optional(),
})

export const bulkAssignSchema = z.object({
  userIds: z.array(z.string()).min(1),
  kpiDefinitionIds: z.array(z.string()).min(1),
  evalPeriodId: z.string(),
})
