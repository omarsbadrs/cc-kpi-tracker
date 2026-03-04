export const queryKeys = {
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", id] as const,
    me: ["users", "me"] as const,
  },
  kpis: {
    definitions: ["kpis", "definitions"] as const,
    assignments: (userId: string, periodId: string) =>
      ["kpis", "assignments", userId, periodId] as const,
    actuals: (userId: string, periodId: string) =>
      ["kpis", "actuals", userId, periodId] as const,
  },
  scoring: {
    results: (userId: string, periodId: string) =>
      ["scoring", "results", userId, periodId] as const,
    trend: (userId: string, pillar: string, months: number) =>
      ["scoring", "trend", userId, pillar, months] as const,
  },
  periods: {
    all: ["periods"] as const,
    active: ["periods", "active"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
}
