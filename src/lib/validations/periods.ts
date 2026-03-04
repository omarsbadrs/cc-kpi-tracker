import { z } from "zod"

export const createPeriodSchema = z.object({
  name: z.string().min(1),
  periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => data.startDate < data.endDate,
  { message: "Start date must be before end date", path: ["endDate"] }
)

export const updatePeriodSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isClosed: z.boolean().optional(),
})
