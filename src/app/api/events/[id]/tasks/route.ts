import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { requireEventAccess } from "@/lib/auth/guards";
import { SectionTypeSchema, TaskPhaseSchema, TaskStatusSchema } from "@/lib/validators/schemas";
import type { TaskPicHistoryEntry } from "@/types/domain";

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
  is_auto_brief_init: z.boolean().optional(),
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
  pic_change_reason: z.string().trim().max(1000).nullable().optional(),
  pic_history: z.array(z.any()).optional(),
});

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error, tasks: [] },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }
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
    const [{ data: actor }, { data: targetEvent }, { data: actorRoster }] =
      await Promise.all([
        supabase
          .from("users")
          .select("base_role, is_superadmin")
          .eq("id", session.userId)
          .maybeSingle(),
        supabase
          .from("events")
          .select("event_leader_id")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_roster")
          .select("section, role_in_event, is_co_controller")
          .eq("event_id", eventId)
          .eq("user_id", session.userId)
          .maybeSingle(),
      ]);

    const isAutoBriefInitLeader =
      Boolean(p.is_auto_brief_init) &&
      (actor?.base_role === "CREATIVE_LEADER" ||
        actor?.base_role === "WAKIL_LEADER" ||
        Boolean(actor?.is_superadmin) ||
        targetEvent?.event_leader_id === session.userId ||
        actorRoster?.role_in_event === "EVENT_LEADER" ||
        Boolean(actorRoster?.is_co_controller));

    const isMatchedSectionLeader =
      actorRoster?.role_in_event === "SECTION_LEADER" &&
      actorRoster.section === p.section;

    if (!isMatchedSectionLeader && !isAutoBriefInitLeader) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pembuatan task baru hanya dapat dilakukan oleh Section Leader untuk divisinya sendiri.",
        },
        { status: 403 }
      );
    }

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

    const { id, pic_change_reason, pic_history: _ignoredClientHistory, ...rest } = parsed.data;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        task: {
          id,
          event_id: eventId,
          ...rest,
          ...(pic_change_reason ? { pic_change_reason } : {}),
        },
      });
    }

    const supabase = createServerClient();

    // Fetch existing task safely (fallback if pic_history column isn't migrated yet)
    let existingTask: {
      id: string;
      section: string;
      assigned_to: string | null;
      pic_history?: TaskPicHistoryEntry[] | null;
    } | null = null;

    const firstLookup = await supabase
      .from("timeline_tasks")
      .select("id, section, assigned_to, pic_history")
      .eq("id", id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (firstLookup.error && firstLookup.error.code === "42703") {
      const fallbackLookup = await supabase
        .from("timeline_tasks")
        .select("id, section, assigned_to")
        .eq("id", id)
        .eq("event_id", eventId)
        .maybeSingle();
      existingTask = fallbackLookup.data;
    } else {
      existingTask = firstLookup.data as typeof existingTask;
    }

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: "Task tidak ditemukan." },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, unknown> = { ...rest };
    const isPicChanged =
      rest.assigned_to !== undefined &&
      (rest.assigned_to || null) !== (existingTask.assigned_to || null);

    if (isPicChanged) {
      const [{ data: actor }, { data: targetEvent }, { data: actorRoster }] =
        await Promise.all([
          supabase
            .from("users")
            .select("base_role, is_superadmin")
            .eq("id", session.userId)
            .maybeSingle(),
          supabase
            .from("events")
            .select("event_leader_id")
            .eq("id", eventId)
            .maybeSingle(),
          supabase
            .from("event_roster")
            .select("section, role_in_event, is_co_controller")
            .eq("event_id", eventId)
            .eq("user_id", session.userId)
            .maybeSingle(),
        ]);

      const isSectionLeaderOfTask =
        actorRoster?.role_in_event === "SECTION_LEADER" &&
        actorRoster.section === existingTask.section;
      const isTopLeader =
        actor?.base_role === "CREATIVE_LEADER" ||
        actor?.base_role === "WAKIL_LEADER" ||
        Boolean(actor?.is_superadmin) ||
        targetEvent?.event_leader_id === session.userId ||
        actorRoster?.role_in_event === "EVENT_LEADER" ||
        Boolean(actorRoster?.is_co_controller);

      if (!isSectionLeaderOfTask && !isTopLeader) {
        return NextResponse.json(
          {
            success: false,
            error: "Hanya Section Leader divisi terkait atau Pimpinan Event yang dapat mendelegasikan PIC.",
          },
          { status: 403 }
        );
      }

      const trimmedReason = (pic_change_reason ?? "").trim();
      if (trimmedReason.length < 3) {
        return NextResponse.json(
          {
            success: false,
            error: "Alasan pergantian / delegasi PIC wajib diisi minimal 3 karakter.",
          },
          { status: 400 }
        );
      }

      const prevHistory = Array.isArray(existingTask.pic_history)
        ? existingTask.pic_history
        : [];
      const nextHistory: TaskPicHistoryEntry[] = [
        ...prevHistory,
        {
          from_user_id: existingTask.assigned_to ?? null,
          to_user_id: rest.assigned_to ?? null,
          changed_by: session.userId,
          reason: trimmedReason,
          changed_at: new Date().toISOString(),
        },
      ];
      updatePayload.pic_change_reason = trimmedReason;
      updatePayload.pic_history = nextHistory;
    }

    let updateRes = await supabase
      .from("timeline_tasks")
      .update(updatePayload)
      .eq("id", id)
      .eq("event_id", eventId)
      .select("*")
      .single();

    if (updateRes.error && updateRes.error.code === "42703") {
      // Fallback if pic_change_reason/pic_history haven't been migrated in Supabase yet
      const { pic_change_reason: _pcr, pic_history: _ph, ...legacyPayload } = updatePayload;
      updateRes = await supabase
        .from("timeline_tasks")
        .update(legacyPayload)
        .eq("id", id)
        .eq("event_id", eventId)
        .select("*")
        .single();
    }

    if (updateRes.error || !updateRes.data) {
      return NextResponse.json(
        { success: false, error: updateRes.error?.message || "Gagal memperbarui task" },
        { status: 500 }
      );
    }

    const updated = updateRes.data;

    if (isPicChanged && updated.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: updated.assigned_to,
        event_id: eventId,
        type: "TASK_ASSIGNED",
        title: `Delegasi PIC Task: ${updated.title}`,
        body: `Alasan: ${pic_change_reason}`,
      });
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
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
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
  const { data: targetTask } = await supabase
    .from("timeline_tasks")
    .select("id, section")
    .eq("id", taskId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!targetTask) {
    return NextResponse.json({ success: false, error: "Task tidak ditemukan." }, { status: 404 });
  }

  const canDelete =
    access.isTopLeader ||
    (access.roster?.role_in_event === "SECTION_LEADER" &&
      access.roster?.section === targetTask.section);

  if (!canDelete) {
    return NextResponse.json(
      {
        success: false,
        error: "Hanya Section Leader divisi terkait atau Pimpinan Event yang berhak menghapus task ini.",
      },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("timeline_tasks")
    .delete()
    .eq("id", taskId)
    .eq("event_id", eventId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
