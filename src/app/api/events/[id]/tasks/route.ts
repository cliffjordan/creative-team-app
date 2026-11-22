import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { SectionTypeSchema, TaskPhaseSchema, TaskStatusSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const CreateTaskSchema = z.object({
  id: z.string().optional(),
  section: SectionTypeSchema,
  phase: TaskPhaseSchema.default("PRE_EVENT"),
  title: z.string().trim().min(2).max(300),
  description: z.string().max(2000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: TaskStatusSchema.default("TODO"),
});

const UpdateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  section: SectionTypeSchema.optional(),
  phase: TaskPhaseSchema.optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: TaskStatusSchema.optional(),
  escalation_notes: z.string().max(2000).nullable().optional(),
  escalated_by: z.string().uuid().nullable().optional(),
  escalated_at: z.string().nullable().optional(),
  escalation_recipient_id: z.string().uuid().nullable().optional(),
  escalation_resolution: z.string().max(2000).nullable().optional(),
  escalation_resolved_at: z.string().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, tasks: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("timeline_tasks")
      .select("*")
      .eq("event_id", eventId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, tasks: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ success: true, tasks: data ?? [] }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat task", tasks: [] },
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
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data task tidak valid" },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const isUuid = p.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
    const insertPayload = {
      ...(isUuid ? { id: p.id } : {}),
      event_id: eventId,
      section: p.section,
      phase: p.phase,
      title: p.title,
      description: p.description?.trim() || null,
      assigned_to: p.assigned_to || null,
      due_date: p.due_date || null,
      status: p.status,
    };

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: true,
          task: {
            id: isUuid ? p.id! : `task-${Date.now()}`,
            ...insertPayload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data: created, error } = await supabase
      .from("timeline_tasks")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal menambah task" },
        { status: 500 }
      );
    }

    if (created.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: created.assigned_to,
        event_id: eventId,
        type: "TASK_ASSIGNED",
        title: "Tugas Timeline Baru",
        body: created.title,
      });
    }

    return NextResponse.json({ success: true, task: created }, { status: 201 });
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
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data update tidak valid" },
        { status: 400 }
      );
    }

    const { id, ...rest } = parsed.data;
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, task: { id, event_id: eventId, ...rest } });
    }

    const supabase = createServerClient();
    const { data: updated, error } = await supabase
      .from("timeline_tasks")
      .update(rest)
      .eq("id", id)
      .eq("event_id", eventId)
      .select("*")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal memperbarui task" },
        { status: 500 }
      );
    }

    if (rest.status === "ESCALATED") {
      let recipientId = rest.escalation_recipient_id || null;
      if (!recipientId) {
        const { data: leaderRow } = await supabase
          .from("users")
          .select("id")
          .eq("base_role", "CREATIVE_LEADER")
          .limit(1)
          .maybeSingle();
        recipientId = leaderRow?.id || null;
      }
      if (recipientId) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          event_id: eventId,
          type: "TASK_ESCALATED",
          title: `Eskalasi Task: ${updated.title}`,
          body: rest.escalation_notes || "Membutuhkan tindak lanjut pimpinan.",
        });
      }
    }

    return NextResponse.json({ success: true, task: updated });
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
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ success: false, error: "taskId wajib diisi" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("timeline_tasks")
    .delete()
    .eq("id", taskId)
    .eq("event_id", context.params.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
