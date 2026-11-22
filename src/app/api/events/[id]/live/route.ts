import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { EventStatusSchema, LogSeveritySchema, LogStatusSchema, LogTypeSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateLogBodySchema = z.object({
  id: z.string().optional(),
  rundown_item_id: z.string().nullable().optional(),
  log_type: LogTypeSchema,
  delta_seconds: z.number().int().nullable().optional(),
  reported_by: z.string().optional(),
  description: z.string().min(1).max(2000),
  photo_url: z.string().nullable().optional(),
  severity: LogSeveritySchema.default("LOW"),
  status: LogStatusSchema.default("OPEN"),
});

const PatchRuntimeSchema = z.object({
  kind: z.enum(["event", "log"]).default("event"),
  // event fields
  status: EventStatusSchema.optional(),
  live_started_at: z.string().nullable().optional(),
  live_ended_at: z.string().nullable().optional(),
  live_paused_at: z.string().nullable().optional(),
  total_pause_seconds: z.number().int().min(0).optional(),
  segment_pause_seconds: z.number().int().min(0).optional(),
  current_item_id: z.string().nullable().optional(),
  current_item_started_at: z.string().nullable().optional(),
  // log fields
  logId: z.string().optional(),
  log_status: LogStatusSchema.optional(),
  resolution_notes: z.string().max(2000).nullable().optional(),
  resolved_by: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, event: null, logs: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const [{ data: ev }, { data: logs }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase
        .from("live_logs")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json(
      { success: true, event: ev ?? null, logs: logs ?? [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat live state", logs: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  const eventId = context.params.id;
  try {
    const body = await request.json();
    const parsed = CreateLogBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data log tidak valid" },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const validId = p.id && UUID_REGEX.test(p.id) ? p.id : undefined;
    const validItemId = p.rundown_item_id && UUID_REGEX.test(p.rundown_item_id) ? p.rundown_item_id : null;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: true,
          log: {
            id: validId ?? `log-${Date.now()}`,
            event_id: eventId,
            rundown_item_id: validItemId,
            log_type: p.log_type,
            delta_seconds: p.delta_seconds ?? null,
            reported_by: session.userId,
            description: p.description,
            photo_url: p.photo_url || null,
            severity: p.severity,
            status: p.status,
            created_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("live_logs")
      .insert({
        ...(validId ? { id: validId } : {}),
        event_id: eventId,
        rundown_item_id: validItemId,
        log_type: p.log_type,
        delta_seconds: p.delta_seconds ?? null,
        reported_by: session.userId,
        description: p.description,
        photo_url: p.photo_url || null,
        severity: p.severity,
        status: p.status,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Gagal menyimpan log" }, { status: 500 });
    }

    return NextResponse.json({ success: true, log: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  const eventId = context.params.id;
  try {
    const body = await request.json();
    const parsed = PatchRuntimeSchema.safeParse({
      ...body,
      ...(body.kind === "log" && body.status ? { log_status: body.status, status: undefined } : {}),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data update tidak valid" },
        { status: 400 }
      );
    }

    const p = parsed.data;
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true });
    }

    const supabase = createServerClient();
    if (p.kind === "log") {
      if (!p.logId) {
        return NextResponse.json({ success: false, error: "logId wajib diisi" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("live_logs")
        .update({
          ...(p.log_status !== undefined ? { status: p.log_status } : {}),
          ...(p.resolution_notes !== undefined ? { resolution_notes: p.resolution_notes } : {}),
          ...(p.resolved_by !== undefined ? { resolved_by: p.resolved_by } : {}),
          ...(p.resolved_at !== undefined ? { resolved_at: p.resolved_at } : {}),
        })
        .eq("id", p.logId)
        .eq("event_id", eventId)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, log: data });
    }

    const updateFields: Record<string, unknown> = {};
    if (p.status !== undefined) updateFields.status = p.status;
    if (p.live_started_at !== undefined) updateFields.live_started_at = p.live_started_at;
    if (p.live_ended_at !== undefined) updateFields.live_ended_at = p.live_ended_at;
    if (p.live_paused_at !== undefined) updateFields.live_paused_at = p.live_paused_at;
    if (p.total_pause_seconds !== undefined) updateFields.total_pause_seconds = p.total_pause_seconds;
    if (p.segment_pause_seconds !== undefined) updateFields.segment_pause_seconds = p.segment_pause_seconds;
    if (p.current_item_id !== undefined) {
      updateFields.current_item_id =
        p.current_item_id && UUID_REGEX.test(p.current_item_id) ? p.current_item_id : null;
    }
    if (p.current_item_started_at !== undefined) updateFields.current_item_started_at = p.current_item_started_at;

    const { data, error } = await supabase
      .from("events")
      .update(updateFields)
      .eq("id", eventId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data });
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
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  const url = new URL(request.url);
  const logId = url.searchParams.get("logId");
  if (!logId || !UUID_REGEX.test(logId)) {
    return NextResponse.json({ success: true });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("live_logs")
    .delete()
    .eq("id", logId)
    .eq("event_id", context.params.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
