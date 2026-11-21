import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  noStore();
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

    return NextResponse.json(
      {
        success: true,
        users: data ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server", users: [] },
      { status: 500 }
    );
  }
}
