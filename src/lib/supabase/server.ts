import { createClient } from "@supabase/supabase-js"

// Server-side client with service role (bypasses RLS)
// ONLY use in API routes and server-side code — NEVER in client components
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
