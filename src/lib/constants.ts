// ─────────────────────────────────────
// Pillar Definitions
// ─────────────────────────────────────

// `color` is a CSS variable (src/styles/ds/kpi.css) so it follows the theme.
// It works as an SVG fill/stroke or a CSS value, but never concatenate an
// alpha suffix onto it — tint with color-mix() or the .pillar-* classes.
export const PILLARS = {
  A: { code: "A", name: "Delivery & Timeliness", color: "var(--pillar-a)", kpiCount: 16 },
  B: { code: "B", name: "Data Quality & Governance", color: "var(--pillar-b)", kpiCount: 4 },
  C: { code: "C", name: "Forecasting & Cost Control Effectiveness", color: "var(--pillar-c)", kpiCount: 3 },
  D: { code: "D", name: "Communication & Stakeholders", color: "var(--pillar-d)", kpiCount: 2 },
  E: { code: "E", name: "Attendance, Reliability & Professional Conduct", color: "var(--pillar-e)", kpiCount: 4 },
  F: { code: "F", name: "Growth, Coaching & Department Contribution", color: "var(--pillar-f)", kpiCount: 2 },
} as const

export const PILLAR_CODES = ["A", "B", "C", "D", "E", "F"] as const

/** Sentence-case short names for tight spots (tiles, insights, table rows). */
export const PILLAR_SHORT: Record<string, string> = {
  A: "Delivery & timeliness",
  B: "Data quality & governance",
  C: "Forecasting & cost control",
  D: "Communication & stakeholders",
  E: "Attendance & conduct",
  F: "Growth & coaching",
}

/** The pillar % a score needs to count as "Strong" (80) — the target mark. */
export const STRONG_THRESHOLD = 80

// ─────────────────────────────────────
// Tier Labels
// ─────────────────────────────────────

export const TIER_LABELS = {
  JUNIOR: "Junior Cost Control Engineer",
  ENGINEER: "Cost Control Engineer",
  SENIOR: "Senior Cost Control Engineer",
  TEAM_LEAD: "Cost Control Team Lead",
  SECTION_HEAD: "Head of Department",
} as const

export const TIER_SHORT: Record<string, string> = {
  JUNIOR: "Junior",
  ENGINEER: "Engineer",
  SENIOR: "Senior",
  TEAM_LEAD: "Lead",
  SECTION_HEAD: "Head",
}

// ─────────────────────────────────────
// Score Colors (0–5)
// ─────────────────────────────────────

// Status tones from the design system: always shown with the number or a
// word beside them, never colour alone.
export type Tone = "ok" | "bad" | "warn" | "info" | "neutral"

export const TONE_COLORS: Record<Tone, string> = {
  ok: "var(--ok)",
  bad: "var(--bad)",
  warn: "var(--warn)",
  info: "var(--info)",
  neutral: "var(--ink-3)",
}

export const SCORE_COLORS = {
  5: "var(--ok)",
  4: "var(--ok)",
  3: "var(--warn)",
  2: "var(--warn)",
  1: "var(--bad)",
  0: "var(--bad)",
} as const

export function scoreTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return "neutral"
  if (score >= 4) return "ok"
  if (score >= 2) return "warn"
  return "bad"
}

// ─────────────────────────────────────
// Appraisal Band Definitions
// ─────────────────────────────────────

export const APPRAISAL_BANDS = {
  EXCEEDS: { label: "Exceeds expectations", min: 90, max: 100, color: "var(--ok)", tone: "ok" },
  STRONG: { label: "Strong", min: 80, max: 89, color: "var(--info)", tone: "info" },
  MEETS: { label: "Meets expectations", min: 70, max: 79, color: "var(--ink-3)", tone: "neutral" },
  NEEDS_IMPROVEMENT: { label: "Needs improvement", min: 60, max: 69, color: "var(--warn)", tone: "warn" },
  UNSATISFACTORY: { label: "Unsatisfactory", min: 0, max: 59, color: "var(--bad)", tone: "bad" },
} as const satisfies Record<string, { label: string; min: number; max: number; color: string; tone: Tone }>

// Actual submission workflow → status chip tone + label.
export const ACTUAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "bad" },
  PENDING: { label: "Pending", tone: "warn" },
}

// ─────────────────────────────────────
// Role Labels
// ─────────────────────────────────────

export const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
} as const

// ─────────────────────────────────────
// Notification Types
// ─────────────────────────────────────

export const NOTIFICATION_TYPES = {
  KPI_ASSIGNED: "KPI_ASSIGNED",
  DEADLINE_REMINDER: "DEADLINE_REMINDER",
  SCORE_PUBLISHED: "SCORE_PUBLISHED",
  ACTUAL_REJECTED: "ACTUAL_REJECTED",
  ACTUAL_APPROVED: "ACTUAL_APPROVED",
} as const

// ─────────────────────────────────────
// File Upload Limits
// ─────────────────────────────────────

export const UPLOAD_LIMITS = {
  maxFilesPerActual: 5,
  maxFileSize: {
    documents: 25 * 1024 * 1024,  // 25 MB
    images: 10 * 1024 * 1024,     // 10 MB
    archives: 50 * 1024 * 1024,   // 50 MB
  },
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "application/zip",
  ],
} as const
