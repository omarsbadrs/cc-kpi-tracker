// Rate limiting middleware using Upstash Redis
// Configured per CLAUDE.md Section 7.15

// Note: This is a stub. Full implementation requires Upstash Redis credentials.
// Rate limit tiers:
//   /api/auth/signin:         5 req / 15 min  (by IP)
//   /api/auth/forgot-password: 3 req / 1 hour  (by IP + email)
//   /api/upload:              20 req / 1 hour  (by user ID)
//   /api/kpis/scoring/run:    5 req / 1 hour   (by user ID)
//   All other /api/*:         100 req / 1 min  (by user ID)

export async function checkRateLimit(
  _identifier: string,
  _category: "auth" | "upload" | "scoring" | "general"
): Promise<{ success: boolean; remaining: number; reset: number }> {
  // Stub: always allow in development
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { success: true, remaining: 100, reset: 0 }
  }

  // TODO: Implement with @upstash/ratelimit when credentials are configured
  return { success: true, remaining: 100, reset: 0 }
}
