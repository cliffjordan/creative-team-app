import { createClient } from "@supabase/supabase-js";

// Server client — uses service role key for admin operations.
// MUST ONLY be used in Server Actions, API Routes, and middleware.
// NEVER import this file in client components.

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://demo.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "demo-service-key";

/** Server-only Supabase client with service role privileges. */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
