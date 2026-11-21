import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("demo.supabase.co") &&
      !key.includes("demo-service-key")
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: true,
      users: INITIAL_USERS,
    });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, full_name, email, phone, is_superadmin, base_role, avatar_url, failed_pin_attempts, locked_until, created_at"
      )
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Gagal memuat daftar pengguna", users: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users: data ?? [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server", users: [] },
      { status: 500 }
    );
  }
}
