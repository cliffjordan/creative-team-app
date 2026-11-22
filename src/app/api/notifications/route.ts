import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET() {
  noStore();
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: true, notifications: [] }, { headers: NO_CACHE_HEADERS });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, notifications: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, notifications: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, notifications: data ?? [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memuat notifikasi",
        notifications: [],
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const supabase = createServerClient();

    if (body?.markAll) {
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", session.userId)
        .is("read_at", null);
      return NextResponse.json({ success: true });
    }

    if (body?.id) {
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", body.id)
        .eq("user_id", session.userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Payload tidak valid" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
