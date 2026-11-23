import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireEventAccess } from "@/lib/auth/guards";
import { RundownItemStatusSchema, SectionTypeSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SyncRundownSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order_index: z.number().int().min(0),
      title: z.string().min(1).max(300),
      section_pic: SectionTypeSchema.default("ACARA"),
      pic_user_id: z.string().uuid().nullable().optional(),
      planned_start_time: z.string().nullable().optional(),
      estimated_duration_minutes: z.number().int().min(0).max(600),
      actual_start_at: z.string().nullable().optional(),
      actual_end_at: z.string().nullable().optional(),
      status: RundownItemStatusSchema.default("PENDING"),
      technical_notes: z.string().max(2000).nullable().optional(),
      cue_props: z.string().max(1000).nullable().optional(),
    })
  ),
});

async function getOrCreateEventRundown(
  supabase: ReturnType<typeof createServerClient>,
  eventId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("rundowns")
    .select("id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("rundowns")
    .insert({ event_id: eventId, name: "Master Rundown Event", is_template: false })
    .select("id")
    .single();

  return created?.id ?? null;
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
      { success: false, error: access.error, rundownId: null, items: [] },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, rundownId: null, items: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data: rundown } = await supabase
      .from("rundowns")
      .select("id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rundown?.id) {
      return NextResponse.json({ success: true, rundownId: null, items: [] }, { headers: NO_CACHE_HEADERS });
    }

    const { data: rows, error } = await supabase
      .from("rundown_items")
      .select("*")
      .eq("rundown_id", rundown.id)
      .order("order_index", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, items: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const normalized = (rows ?? []).map((it) => ({ ...it, event_id: eventId }));
    return NextResponse.json(
      { success: true, rundownId: rundown.id, items: normalized },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat rundown", items: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const canEditRundown =
    access.isTopLeader ||
    access.roster?.section === "ACARA" ||
    access.roster?.section === "ALL";
  if (!canEditRundown) {
    return NextResponse.json(
      {
        success: false,
        error: "Hanya tim Seksi Acara atau Pimpinan Event yang dapat mengubah Master Rundown.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SyncRundownSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data rundown tidak valid" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, items: parsed.data.items });
    }

    const supabase = createServerClient();
    const rundownId = await getOrCreateEventRundown(supabase, eventId);
    if (!rundownId) {
      return NextResponse.json(
        { success: false, error: "Gagal menginisiasi master rundown." },
        { status: 500 }
      );
    }

    const { data: currentRows } = await supabase
      .from("rundown_items")
      .select("id")
      .eq("rundown_id", rundownId);

    const existingIds = new Set((currentRows ?? []).map((r) => r.id));
    const incomingRows = parsed.data.items.map((it, idx) => ({
      id: UUID_REGEX.test(it.id) ? it.id : crypto.randomUUID(),
      rundown_id: rundownId,
      order_index: it.order_index ?? idx,
      title: it.title.trim(),
      section_pic: it.section_pic,
      pic_user_id: it.pic_user_id || null,
      planned_start_time: it.planned_start_time || null,
      estimated_duration_minutes: it.estimated_duration_minutes,
      actual_start_at: it.actual_start_at || null,
      actual_end_at: it.actual_end_at || null,
      status: it.status,
      technical_notes: it.technical_notes || null,
      cue_props: it.cue_props || null,
    }));

    const keptIds = new Set(incomingRows.map((r) => r.id));
    const deletedIds = Array.from(existingIds).filter((id) => !keptIds.has(id));

    if (deletedIds.length > 0) {
      await supabase.from("rundown_items").delete().in("id", deletedIds);
    }

    if (incomingRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("rundown_items")
        .upsert(incomingRows, { onConflict: "id" });
      if (upsertErr) {
        return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      rundownId,
      items: incomingRows.map((r) => ({ ...r, event_id: eventId })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
