import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import type { OperationRecord } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET() {
  noStore();
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Sesi tidak valid. Silakan login." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  if (!isSupabaseConfigured()) {
    if (!session.isSuperadmin) {
      return NextResponse.json(
        { success: false, error: "Hanya Superadmin yang dapat melihat System Audit Trail." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }
    return NextResponse.json({ success: true, logs: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data: actor } = await supabase
      .from("users")
      .select("is_superadmin")
      .eq("id", session.userId)
      .maybeSingle();

    if (!actor?.is_superadmin) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak: Khusus Superadmin." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const [{ data: logs, error }, { data: users }] = await Promise.all([
      supabase
        .from("operation_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("users")
        .select("id, full_name, base_role"),
    ]);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, logs: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const userMap = new Map(
      (users ?? []).map((u) => [u.id, { id: u.id, full_name: u.full_name, base_role: u.base_role }])
    );

    const enriched: OperationRecord[] = (logs ?? []).map((row) => ({
      operation_id: row.operation_id,
      event_id: row.event_id ?? null,
      action_type: row.action_type,
      actor_id: row.actor_id ?? null,
      details: (row.details as Record<string, unknown> | null) ?? null,
      created_at: row.created_at,
      actor: row.actor_id ? userMap.get(row.actor_id) ?? null : null,
    }));

    return NextResponse.json({ success: true, logs: enriched }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat log audit", logs: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
