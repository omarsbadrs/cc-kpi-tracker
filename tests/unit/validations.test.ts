/**
 * Zod Validation Schemas — Unit Tests
 * Tests all validation rules from CLAUDE.md Section 7.13
 */
import { describe, it, expect } from "vitest"
import { passwordSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth"
import { submitActualSchema, reviewActualSchema } from "@/lib/validations/actuals"
import { runScoringSchema, overrideScoreSchema } from "@/lib/validations/scoring"
import { paginationSchema } from "@/lib/validations/shared"

// ─────────────────────────────────────
// Password Schema
// ─────────────────────────────────────

describe("passwordSchema", () => {
  it("accepts valid password", () => {
    expect(passwordSchema.safeParse("Admin@2025").success).toBe(true)
  })

  it("rejects short password (< 8 chars)", () => {
    const result = passwordSchema.safeParse("Ab1@xyz")
    expect(result.success).toBe(false)
  })

  it("rejects password without uppercase", () => {
    const result = passwordSchema.safeParse("admin@2025")
    expect(result.success).toBe(false)
  })

  it("rejects password without lowercase", () => {
    const result = passwordSchema.safeParse("ADMIN@2025")
    expect(result.success).toBe(false)
  })

  it("rejects password without number", () => {
    const result = passwordSchema.safeParse("Admin@abcd")
    expect(result.success).toBe(false)
  })

  it("rejects password without special character", () => {
    const result = passwordSchema.safeParse("Admin2025x")
    expect(result.success).toBe(false)
  })

  it("accepts complex password", () => {
    expect(passwordSchema.safeParse("C0mpl3x!Pass#word").success).toBe(true)
  })
})

// ─────────────────────────────────────
// Login Schema
// ─────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({
      email: "admin@elsewedy.com",
      password: "Admin@2025",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Admin@2025",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "admin@elsewedy.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
    expect(loginSchema.safeParse({ email: "a@b.com" }).success).toBe(false)
  })
})

// ─────────────────────────────────────
// Reset Password Schema
// ─────────────────────────────────────

describe("resetPasswordSchema", () => {
  it("accepts valid reset", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      password: "NewPass@1",
      confirmPassword: "NewPass@1",
    })
    expect(result.success).toBe(true)
  })

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      password: "NewPass@1",
      confirmPassword: "Different@1",
    })
    expect(result.success).toBe(false)
  })

  it("rejects weak password in reset", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      password: "weak",
      confirmPassword: "weak",
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────
// Submit Actual Schema
// ─────────────────────────────────────

describe("submitActualSchema", () => {
  it("accepts numeric actual", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
      actualValue: 95.5,
    })
    expect(result.success).toBe(true)
  })

  it("accepts binary actual", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
      binaryValue: true,
    })
    expect(result.success).toBe(true)
  })

  it("rejects when neither actualValue nor binaryValue provided", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
    })
    expect(result.success).toBe(false)
  })

  it("rejects actualValue > 100", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
      actualValue: 105,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative actualValue", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
      actualValue: -5,
    })
    expect(result.success).toBe(false)
  })

  it("accepts actualValue = 0", () => {
    const result = submitActualSchema.safeParse({
      assignmentId: "clxxx1",
      evalPeriodId: "clxxx2",
      actualValue: 0,
    })
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────
// Review Actual Schema
// ─────────────────────────────────────

describe("reviewActualSchema", () => {
  it("accepts approval without comment", () => {
    const result = reviewActualSchema.safeParse({ status: "APPROVED" })
    expect(result.success).toBe(true)
  })

  it("accepts rejection with comment", () => {
    const result = reviewActualSchema.safeParse({
      status: "REJECTED",
      reviewComment: "Values do not match source data",
    })
    expect(result.success).toBe(true)
  })

  it("rejects rejection without comment", () => {
    const result = reviewActualSchema.safeParse({ status: "REJECTED" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid status", () => {
    const result = reviewActualSchema.safeParse({ status: "PENDING" })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────
// Scoring Schemas
// ─────────────────────────────────────

describe("runScoringSchema", () => {
  it("accepts valid scoring request", () => {
    const result = runScoringSchema.safeParse({
      evalPeriodId: "clxxx1",
      dryRun: true,
    })
    expect(result.success).toBe(true)
  })

  it("defaults dryRun to false", () => {
    const result = runScoringSchema.safeParse({
      evalPeriodId: "clxxx1",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dryRun).toBe(false)
    }
  })

  it("rejects missing evalPeriodId", () => {
    const result = runScoringSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("overrideScoreSchema", () => {
  it("accepts valid override with sufficient comment", () => {
    const result = overrideScoreSchema.safeParse({
      snapshotId: "clxxx1",
      newScore: 4,
      comment: "Recalculated after data correction from Oracle ERP",
    })
    expect(result.success).toBe(true)
  })

  it("rejects comment shorter than 10 characters", () => {
    const result = overrideScoreSchema.safeParse({
      snapshotId: "clxxx1",
      newScore: 4,
      comment: "short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects score > 5", () => {
    const result = overrideScoreSchema.safeParse({
      snapshotId: "clxxx1",
      newScore: 6,
      comment: "This is a valid comment length",
    })
    expect(result.success).toBe(false)
  })

  it("rejects score < 0", () => {
    const result = overrideScoreSchema.safeParse({
      snapshotId: "clxxx1",
      newScore: -1,
      comment: "This is a valid comment length",
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────
// Pagination Schema
// ─────────────────────────────────────

describe("paginationSchema", () => {
  it("accepts valid pagination params", () => {
    const result = paginationSchema.safeParse({
      page: 2,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "asc",
    })
    expect(result.success).toBe(true)
  })

  it("applies defaults for missing params", () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
      expect(result.data.sortOrder).toBe("desc")
    }
  })

  it("coerces string numbers", () => {
    const result = paginationSchema.safeParse({
      page: "3",
      pageSize: "50",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.pageSize).toBe(50)
    }
  })

  it("rejects page < 1", () => {
    const result = paginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects pageSize > 100", () => {
    const result = paginationSchema.safeParse({ pageSize: 200 })
    expect(result.success).toBe(false)
  })

  it("rejects invalid sortOrder", () => {
    const result = paginationSchema.safeParse({ sortOrder: "random" })
    expect(result.success).toBe(false)
  })
})
