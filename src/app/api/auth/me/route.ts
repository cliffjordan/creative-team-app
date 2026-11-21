import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  noStore();
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data: freshUser } = await supabase
        .from("users")
        .select(
          "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at"
        )
        .eq("id", session.userId)
        .maybeSingle();

      if (freshUser) {
        return NextResponse.json(
          { authenticated: true, user: freshUser },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
        );
      }
    } catch {
      // Fallback to session payload if DB lookup temporarily fails
    }
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      full_name: session.fullName,
      base_role: session.baseRole,
      is_superadmin: session.isSuperadmin,
    },
  });
}
