import { z } from "zod"

export const submitActualSchema = z.object({
  assignmentId: z.string(),
  evalPeriodId: z.string(),
  actualValue: z.number().min(0).max(100).optional(),
  binaryValue: z.boolean().optional(),
}).refine(
  (data) => data.actualValue !== undefined || data.binaryValue !== undefined,
  { message: "Either actualValue or binaryValue must be provided" }
)

export const reviewActualSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: z.string().optional(),
}).refine(
  (data) => data.status !== "REJECTED" || (data.reviewComment && data.reviewComment.length > 0),
  { message: "Comment is required when rejecting", path: ["reviewComment"] }
)
