import { z } from "zod"
import { passwordSchema } from "./auth"

export const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  employeeId: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  tier: z.enum(["JUNIOR", "ENGINEER", "SENIOR", "TEAM_LEAD", "SECTION_HEAD"]),
  jobTitle: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  nationality: z.string().optional(),
  graduationYear: z.coerce.number().int().min(1970).max(2030).optional(),
  functionProject: z.string().optional(),
})

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  isActive: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})
