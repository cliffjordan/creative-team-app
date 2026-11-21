import { createClient } from "@supabase/supabase-js";

// Browser client — safe to use in client components.
// Falls back to demo values when env vars are missing (local dev without Supabase).

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://demo.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key";

/** Singleton browser Supabase client (anon key). */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
