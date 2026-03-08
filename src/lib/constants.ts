// ─────────────────────────────────────
// Pillar Definitions
// ─────────────────────────────────────

export const PILLARS = {
  A: { code: "A", name: "Delivery & Timeliness", color: "#22c55e", kpiCount: 16 },
  B: { code: "B", name: "Data Quality & Governance", color: "#3b82f6", kpiCount: 4 },
  C: { code: "C", name: "Forecasting & Cost Control Effectiveness", color: "#f59e0b", kpiCount: 3 },
  D: { code: "D", name: "Communication & Stakeholders", color: "#8b5cf6", kpiCount: 2 },
  E: { code: "E", name: "Attendance, Reliability & Professional Conduct", color: "#ef4444", kpiCount: 4 },
  F: { code: "F", name: "Growth, Coaching & Department Contribution", color: "#06b6d4", kpiCount: 2 },
} as const

export const PILLAR_CODES = ["A", "B", "C", "D", "E", "F"] as const

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

export const SCORE_COLORS = {
  5: "#22c55e", // green
  4: "#84cc16", // lime
  3: "#f59e0b", // amber
  2: "#f97316", // orange
  1: "#ef4444", // red
  0: "#991b1b", // dark red
} as const

// ─────────────────────────────────────
// Appraisal Band Definitions
// ─────────────────────────────────────

export const APPRAISAL_BANDS = {
  EXCEEDS: { label: "Exceeds Expectations", min: 90, max: 100, color: "#22c55e" },
  STRONG: { label: "Strong", min: 80, max: 89, color: "#3b82f6" },
  MEETS: { label: "Meets Expectations", min: 70, max: 79, color: "#f59e0b" },
  NEEDS_IMPROVEMENT: { label: "Needs Improvement", min: 60, max: 69, color: "#f97316" },
  UNSATISFACTORY: { label: "Unsatisfactory", min: 0, max: 59, color: "#ef4444" },
} as const

// ─────────────────────────────────────
// Role Labels
// ─────────────────────────────────────

export const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
} as const

// ─────────────────────────────────────
// Theme Colors (Dark Mode)
// ─────────────────────────────────────

export const THEME = {
  dark: {
    background: "#0a0a0f",
    surface: "#111118",
    card: "#1a1a25",
    cardBorder: "#2a2a3a",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
  },
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
