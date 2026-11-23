import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { hashPin } from "@/lib/auth/pin-hash";
import { UserBaseRoleSchema } from "@/lib/validators/schemas";
import type { OperationRecord } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const CORE_TABLES = [
  "users",
  "events",
  "event_roster",
  "rundowns",
  "rundown_items",
  "timeline_tasks",
  "event_documents",
  "event_budget_ledger",
  "operation_records",
  "notifications",
] as const;

const MaintenanceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("EMERGENCY_RESET_PIN"),
    user_id: z.string().uuid("ID akun tidak valid"),
    new_pin: z
      .string()
      .length(4, "PIN baru harus 4 digit")
      .regex(/^\d{4}$/, "PIN harus 4 digit angka"),
  }),
  z.object({
    action: z.literal("EMERGENCY_SET_ROLE"),
    user_id: z.string().uuid("ID akun tidak valid"),
    base_role: UserBaseRoleSchema,
  }),
  z.object({
    action: z.literal("PURGE_OLD_NOTIFICATIONS"),
    days: z.number().int().min(1).max(365).default(30),
  }),
  z.object({
    action: z.literal("PURGE_OLD_AUDIT_LOGS"),
    days: z.number().int().min(7).max(365).default(90),
  }),
]);

async function requireStrictSuperadmin() {
  const session = await getServerSession();
  if (!session) {
    return {
      allowed: false as const,
      status: 401,
      error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.",
      actorId: null,
    };
  }

  if (!isSupabaseConfigured()) {
    return session.isSuperadmin
      ? {
          allowed: true as const,
          status: 200,
          error: "",
          actorId: session.userId,
        }
      : {
          allowed: false as const,
          status: 403,
          error: "Akses ditolak: Khusus akun teknis Superadmin.",
          actorId: null,
        };
  }

  const supabase = createServerClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();

  if (!actor || !actor.is_superadmin) {
    return {
      allowed: false as const,
      status: 403,
      error: "Akses ditolak: Halaman ini khusus Superadmin Maintenance.",
      actorId: null,
    };
  }

  return {
    allowed: true as const,
    status: 200,
    error: "",
    actorId: actor.id,
  };
}

export async function GET() {
  noStore();
  const auth = await requireStrictSuperadmin();
  if (!auth.allowed) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: NO_CACHE_HEADERS }
    );
  }

  const checkedAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: true,
        health: {
          connected: false,
          mode: "OFFLINE_DEMO",
          latencyMs: 0,
          keepAliveEndpoint: "/api/health/keep-alive",
          checkedAt,
        },
        tableCounts: CORE_TABLES.map((t) => ({ table: t, count: 0 })),
        users: [],
        logs: [],
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const started = Date.now();
    const { error: pingErr } = await supabase.from("users").select("id").limit(1);
    const latencyMs = Date.now() - started;

    const countPromises = CORE_TABLES.map(async (tableName) => {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select("*", { count: "exact", head: true });
        return { table: tableName, count: error ? -1 : count ?? 0 };
      } catch {
        return { table: tableName, count: -1 };
      }
    });

    const [tableCounts, usersRes, logsRes] = await Promise.all([
      Promise.all(countPromises),
      supabase
        .from("users")
        .select(
          "id, full_name, email, phone, base_role, is_superadmin, is_role_assigned, failed_pin_attempts, locked_until, created_at"
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("operation_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const allUsers = usersRes.data ?? [];
    const userMap = new Map(
      allUsers.map((u) => [
        u.id,
        { id: u.id, full_name: u.full_name, base_role: u.base_role },
      ])
    );

    const logs: OperationRecord[] = (logsRes.data ?? []).map((row) => ({
      operation_id: row.operation_id,
      event_id: row.event_id ?? null,
      action_type: row.action_type,
      actor_id: row.actor_id ?? null,
      details: (row.details as Record<string, unknown> | null) ?? null,
      created_at: row.created_at,
      actor: row.actor_id ? userMap.get(row.actor_id) ?? null : null,
    }));

    return NextResponse.json(
      {
        success: true,
        health: {
          connected: !pingErr,
          mode: "SUPABASE_LIVE",
          latencyMs,
          keepAliveEndpoint: "/api/health/keep-alive",
          checkedAt,
        },
        tableCounts,
        users: allUsers,
        logs,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memeriksa diagnostik sistem",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireStrictSuperadmin();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = MaintenanceActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Perintah maintenance tidak valid" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: "Aksi maintenance selesai (Mode Demo Offline).",
      });
    }

    const supabase = createServerClient();
    const payload = parsed.data;

    if (payload.action === "EMERGENCY_RESET_PIN") {
      const { data: target, error } = await supabase
        .from("users")
        .update({
          pin_hash: hashPin(payload.new_pin),
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq("id", payload.user_id)
        .select("id, full_name, base_role")
        .single();

      if (error || !target) {
        return NextResponse.json(
          { success: false, error: error?.message || "Gagal mereset PIN darurat." },
          { status: 500 }
        );
      }

      try {
        await supabase.from("operation_records").insert({
          operation_id: crypto.randomUUID(),
          event_id: null,
          action_type: "SUPERADMIN_EMERGENCY_PIN_RESET",
          actor_id: auth.actorId,
          details: { target_user_id: target.id, target_name: target.full_name, pin_reset: true },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `PIN darurat untuk ${target.full_name} berhasil direset & lockout dibuka.`,
      });
    }

    if (payload.action === "EMERGENCY_SET_ROLE") {
      const { data: existing } = await supabase
        .from("users")
        .select("id, full_name, base_role, is_superadmin")
        .eq("id", payload.user_id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ success: false, error: "Akun tidak ditemukan." }, { status: 404 });
      }
      if (existing.is_superadmin) {
        return NextResponse.json(
          { success: false, error: "Akun teknis Superadmin tetap terisolasi dari jabatan operasional." },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabase
        .from("users")
        .update({ base_role: payload.base_role, is_role_assigned: true })
        .eq("id", payload.user_id)
        .select("id, full_name, base_role")
        .single();

      if (error || !updated) {
        return NextResponse.json(
          { success: false, error: error?.message || "Gagal memulihkan role akun." },
          { status: 500 }
        );
      }

      try {
        await supabase.from("operation_records").insert({
          operation_id: crypto.randomUUID(),
          event_id: null,
          action_type: "SUPERADMIN_EMERGENCY_ROLE_RECOVERY",
          actor_id: auth.actorId,
          details: {
            target_user_id: updated.id,
            target_name: updated.full_name,
            previous_role: existing.base_role,
            new_role: updated.base_role,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Jabatan ${updated.full_name} dipulihkan menjadi ${updated.base_role}.`,
      });
    }

    if (payload.action === "PURGE_OLD_NOTIFICATIONS") {
      const cutoff = new Date(Date.now() - payload.days * 86400000).toISOString();
      const { error } = await supabase
        .from("notifications")
        .delete()
        .lt("created_at", cutoff);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      try {
        await supabase.from("operation_records").insert({
          operation_id: crypto.randomUUID(),
          event_id: null,
          action_type: "SUPERADMIN_PURGE_NOTIFICATIONS",
          actor_id: auth.actorId,
          details: { older_than_days: payload.days },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Notifikasi lebih lama dari ${payload.days} hari telah dibersihkan.`,
      });
    }

    // PURGE_OLD_AUDIT_LOGS
    const cutoff = new Date(Date.now() - payload.days * 86400000).toISOString();
    const { error } = await supabase
      .from("operation_records")
      .delete()
      .lt("created_at", cutoff);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    try {
      await supabase.from("operation_records").insert({
        operation_id: crypto.randomUUID(),
        event_id: null,
        action_type: "SUPERADMIN_PURGE_AUDIT_LOGS",
        actor_id: auth.actorId,
        details: { older_than_days: payload.days },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Log audit lebih lama dari ${payload.days} hari telah dibersihkan.`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
