import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { requireEventAccess } from "@/lib/auth/guards";
import {
  CommitteeMemberRowSchema,
  MinisterRowSchema,
} from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const NoteInsertSchema = z.object({
  kind: z.literal("note"),
  meeting_type: z.enum(["PRE_EVENT_COORDINATION", "TECHNICAL_MEETING", "POST_EVALUATION"]),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes_content: z.string().min(1).max(10000),
});

const CommitteeSyncSchema = z.object({
  kind: z.literal("committee"),
  rows: z.array(CommitteeMemberRowSchema),
});

const MinistersSyncSchema = z.object({
  kind: z.literal("ministers"),
  rows: z.array(MinisterRowSchema),
});

async function requireSecretaryOrLeader() {
  const session = await getServerSession();
  if (!session) {
    return { allowed: false, status: 401, error: "Sesi tidak ditemukan. Silakan login.", userId: null };
  }
  if (!isSupabaseConfigured()) {
    const ok =
      session.baseRole === "SEKRETARIS" ||
      session.baseRole === "CREATIVE_LEADER" ||
      session.isSuperadmin;
    return ok
      ? { allowed: true, userId: session.userId }
      : { allowed: false, status: 403, error: "Hanya Sekretaris atau Creative Leader yang dapat mengubah data Sekretariat.", userId: null };
  }
  const supabase = createServerClient();
  const { data: actor } = await supabase
    .from("users")
    .select("base_role, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();
  if (!actor) {
    return { allowed: false, status: 401, error: "Akun tidak ditemukan.", userId: null };
  }
  const ok =
    actor.base_role === "SEKRETARIS" ||
    actor.base_role === "CREATIVE_LEADER" ||
    Boolean(actor.is_superadmin);
  return ok
    ? { allowed: true, userId: session.userId }
    : { allowed: false, status: 403, error: "Hanya Sekretaris atau Creative Leader yang dapat mengubah data Sekretariat.", userId: null };
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error, notes: [], committee: [], ministers: [] },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: true, notes: [], committee: [], ministers: [] },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const [notesRes, committeeRes, ministersRes] = await Promise.all([
      supabase
        .from("event_meeting_notes")
        .select("*")
        .eq("event_id", eventId)
        .order("meeting_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("event_committee_structure")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true }),
      supabase
        .from("event_ministers_structure")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true }),
    ]);

    return NextResponse.json(
      {
        success: true,
        notes: notesRes.data ?? [],
        committee: committeeRes.data ?? [],
        ministers: ministersRes.data ?? [],
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memuat data Sekretariat",
        notes: [],
        committee: [],
        ministers: [],
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireSecretaryOrLeader();
  if (!auth.allowed || !auth.userId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = NoteInsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data notulensi tidak valid" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: true,
          note: {
            id: `mn-${Date.now()}`,
            event_id: context.params.id,
            meeting_type: parsed.data.meeting_type,
            meeting_date: parsed.data.meeting_date,
            notes_content: parsed.data.notes_content.trim(),
            recorded_by: auth.userId,
            created_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("event_meeting_notes")
      .insert({
        event_id: context.params.id,
        meeting_type: parsed.data.meeting_type,
        meeting_date: parsed.data.meeting_date,
        notes_content: parsed.data.notes_content.trim(),
        recorded_by: auth.userId,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal menyimpan notulensi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, note: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireSecretaryOrLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const eventId = context.params.id;
  try {
    const body = await request.json();

    if (body?.kind === "committee") {
      const parsed = CommitteeSyncSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.issues[0]?.message || "Data struktur panitia tidak valid" },
          { status: 400 }
        );
      }
      const rows = parsed.data.rows.map((r, idx) => ({
        event_id: eventId,
        order_index: idx,
        position_name: r.position_name.trim(),
        pic_user_id: r.pic_user_id || null,
        pic_name: r.pic_name.trim(),
        contact_notes: r.contact_notes?.trim() || null,
      }));

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          committee: rows.map((r, idx) => ({ id: `cm-${Date.now()}-${idx}`, ...r })),
        });
      }

      const supabase = createServerClient();
      await supabase.from("event_committee_structure").delete().eq("event_id", eventId);
      if (rows.length === 0) {
        return NextResponse.json({ success: true, committee: [] });
      }
      const { data, error } = await supabase
        .from("event_committee_structure")
        .insert(rows)
        .select("*")
        .order("order_index", { ascending: true });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, committee: data ?? [] });
    }

    if (body?.kind === "ministers") {
      const parsed = MinistersSyncSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.issues[0]?.message || "Data struktur pelayan tidak valid" },
          { status: 400 }
        );
      }
      const rows = parsed.data.rows.map((r, idx) => ({
        event_id: eventId,
        order_index: idx,
        ministry_role: r.ministry_role.trim(),
        minister_names: r.minister_names.trim(),
        notes: r.notes?.trim() || null,
      }));

      if (!isSupabaseConfigured()) {
        return NextResponse.json({
          success: true,
          ministers: rows.map((r, idx) => ({ id: `mnr-${Date.now()}-${idx}`, ...r })),
        });
      }

      const supabase = createServerClient();
      await supabase.from("event_ministers_structure").delete().eq("event_id", eventId);
      if (rows.length === 0) {
        return NextResponse.json({ success: true, ministers: [] });
      }
      const { data, error } = await supabase
        .from("event_ministers_structure")
        .insert(rows)
        .select("*")
        .order("order_index", { ascending: true });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, ministers: data ?? [] });
    }

    return NextResponse.json({ success: false, error: "Tipe operasi tidak dikenali" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireSecretaryOrLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "note";
  const itemId = url.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ success: false, error: "itemId wajib diisi" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const table =
    kind === "committee"
      ? "event_committee_structure"
      : kind === "ministers"
      ? "event_ministers_structure"
      : "event_meeting_notes";

  const supabase = createServerClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", itemId)
    .eq("event_id", context.params.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
