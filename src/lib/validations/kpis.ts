import { z } from "zod"

export const createKpiSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  pillarId: z.string(),
  unit: z.enum(["PERCENTAGE", "COUNT", "SCORE", "BINARY", "DAYS"]),
  direction: z.enum(["HIGHER", "LOWER", "BINARY"]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]),
  sla: z.string().optional(),
  dataSource: z.string().optional(),
  formula: z.string().optional(),
})

export const updateKpiSchema = createKpiSchema.partial()

export const updateTargetSchema = z.object({
  targetValue: z.number().min(0),
  targetOperator: z.enum([">=", "<=", "=="]).default(">="),
})

export const updateWeightSchema = z.object({
  weight: z.number().min(0).max(100),
})
