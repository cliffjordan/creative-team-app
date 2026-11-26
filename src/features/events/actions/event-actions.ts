"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import {
  executeSupabaseEventDeletion,
  validateEventDeletionStatus,
} from "@/lib/events/delete-event";
import {
  INITIAL_EVENT,
  INITIAL_EVENTS,
  INITIAL_ROSTER,
  INITIAL_USERS,
} from "@/lib/mock-db";
import {
  CreateEventSchema,
  UpdateEventSchema,
  AssignRosterSchema,
} from "@/lib/validators/schemas";
import type {
  Event,
  EventRosterMember,
  EventStatus,
  EventRole,
  SectionType,
  TimelineTask,
  User,
} from "@/types/domain";

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  roster?: EventRosterMember[];
  error?: string;
}

export interface WorkspaceBootstrapData {
  events: EventWithLeader[];
  roster: EventRosterMember[];
  tasks: TimelineTask[];
}

export interface EventWithLeader extends Event {
  event_leader?: Pick<User, "id" | "full_name" | "base_role" | "avatar_url"> | null;
  roster_count?: number;
}

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

async function verifyRosterManagerPermission(params: {
  eventId: string;
  targetSection?: SectionType;
  targetRole?: EventRole;
}): Promise<{ allowed: boolean; error?: string; actorId?: string }> {
  const session = await getServerSession();
  if (!session) {
    return {
      allowed: false,
      error: "Sesi login tidak valid. Silakan login kembali.",
    };
  }

  if (!isSupabaseConfigured()) {
    const isGlobalLeader =
      session.baseRole === "CREATIVE_LEADER" ||
      session.baseRole === "WAKIL_LEADER" ||
      session.isSuperadmin;
    if (isGlobalLeader) {
      return { allowed: true, actorId: session.userId };
    }
    const actorRoster = demoRoster.find(
      (r) => r.event_id === params.eventId && r.user_id === session.userId
    );
    const ev = demoEvents.find((e) => e.id === params.eventId);
    if (
      ev?.event_leader_id === session.userId ||
      actorRoster?.role_in_event === "EVENT_LEADER" ||
      actorRoster?.is_co_controller
    ) {
      return { allowed: true, actorId: session.userId };
    }
    if (
      actorRoster?.role_in_event === "SECTION_LEADER" &&
      (!params.targetSection || actorRoster.section === params.targetSection) &&
      (!params.targetRole || params.targetRole === "MEMBER")
    ) {
      return { allowed: true, actorId: session.userId };
    }
    return {
      allowed: false,
      error: "Akses ditolak: Hanya Creative Leader, Event Leader, atau Section Leader divisi terkait.",
    };
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
        .eq("id", params.eventId)
        .maybeSingle(),
      supabase
        .from("event_roster")
        .select("section, role_in_event, is_co_controller")
        .eq("event_id", params.eventId)
        .eq("user_id", session.userId)
        .maybeSingle(),
    ]);

  if (!actor) {
    return { allowed: false, error: "Akun pengguna tidak ditemukan." };
  }

  const isGlobalLeader =
    actor.base_role === "CREATIVE_LEADER" ||
    actor.base_role === "WAKIL_LEADER" ||
    Boolean(actor.is_superadmin);
  const isEventLeader =
    targetEvent?.event_leader_id === session.userId ||
    actorRoster?.role_in_event === "EVENT_LEADER" ||
    Boolean(actorRoster?.is_co_controller);

  if (isGlobalLeader || isEventLeader) {
    return { allowed: true, actorId: session.userId };
  }

  const isMatchedSectionLeader =
    actorRoster?.role_in_event === "SECTION_LEADER" &&
    (!params.targetSection || actorRoster.section === params.targetSection) &&
    (!params.targetRole || params.targetRole === "MEMBER");

  if (isMatchedSectionLeader) {
    return { allowed: true, actorId: session.userId };
  }

  return {
    allowed: false,
    error:
      "Akses ditolak: Section Leader hanya dapat mengelola Member pada divisi yang dipimpinnya.",
  };
}

export async function getWorkspaceBootstrapAction(): Promise<
  ActionResult<WorkspaceBootstrapData>
> {
  noStore();
  if (!isSupabaseConfigured()) {
    return {
      success: true,
      data: {
        events: demoEvents,
        roster: demoRoster,
        tasks: [],
      },
    };
  }

  try {
    const supabase = createServerClient();
    const [eventsRes, rosterRes, tasksRes] = await Promise.all([
      supabase
        .from("events")
        .select(
          `
          *,
          event_leader:users!events_event_leader_id_fkey(id, full_name, base_role, avatar_url)
        `
        )
        .order("event_date", { ascending: false }),
      supabase
        .from("event_roster")
        .select(
          `
          *,
          user:users(id, full_name, base_role, avatar_url)
        `
        )
        .order("section", { ascending: true }),
      supabase
        .from("timeline_tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    if (eventsRes.error) {
      return { success: false, error: eventsRes.error.message };
    }

    return {
      success: true,
      data: {
        events: (eventsRes.data ?? []) as EventWithLeader[],
        roster: (rosterRes.data ?? []) as EventRosterMember[],
        tasks: (tasksRes.data ?? []) as TimelineTask[],
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Gagal memuat data workspace",
    };
  }
}

// In-memory demo store for fallback mode
const demoEvents: EventWithLeader[] = INITIAL_EVENTS.map((ev) => ({
  ...ev,
  event_leader:
    INITIAL_USERS.find((u) => u.id === ev.event_leader_id) ?? null,
}));
const demoRoster: EventRosterMember[] = INITIAL_ROSTER.map((r) => ({
  ...r,
  user: INITIAL_USERS.find((u) => u.id === r.user_id),
}));

export async function getEventsAction(
  statusFilter?: EventStatus | "ALL"
): Promise<ActionResult<EventWithLeader[]>> {
  noStore();
  if (!isSupabaseConfigured()) {
    const filtered =
      statusFilter && statusFilter !== "ALL"
        ? demoEvents.filter((e) => e.status === statusFilter)
        : demoEvents;
    return { success: true, data: filtered };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("events")
      .select(
        `
        *,
        event_leader:users!events_event_leader_id_fkey(id, full_name, base_role, avatar_url)
      `
      )
      .order("event_date", { ascending: false });

    if (statusFilter && statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as EventWithLeader[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar event",
    };
  }
}

export async function getEventDetailAction(eventId: string): Promise<
  ActionResult<{
    event: EventWithLeader;
    roster: EventRosterMember[];
    users: Pick<User, "id" | "full_name" | "base_role" | "avatar_url">[];
  }>
> {
  noStore();
  if (!isSupabaseConfigured()) {
    const ev = demoEvents.find((e) => e.id === eventId) ?? demoEvents[0];
    if (!ev) {
      return { success: false, error: "Event tidak ditemukan" };
    }
    return {
      success: true,
      data: {
        event: ev,
        roster: demoRoster.filter((r) => r.event_id === ev.id),
        users: INITIAL_USERS.filter((u) => !u.is_superadmin).map((u) => ({
          id: u.id,
          full_name: u.full_name,
          base_role: u.base_role,
          avatar_url: u.avatar_url,
        })),
      },
    };
  }

  try {
    const supabase = createServerClient();

    const [eventRes, rosterRes, usersRes] = await Promise.all([
      supabase
        .from("events")
        .select(
          `
          *,
          event_leader:users!events_event_leader_id_fkey(id, full_name, base_role, avatar_url)
        `
        )
        .eq("id", eventId)
        .single(),
      supabase
        .from("event_roster")
        .select(
          `
          *,
          user:users(id, full_name, base_role, avatar_url)
        `
        )
        .eq("event_id", eventId)
        .order("section", { ascending: true }),
      supabase
        .from("users")
        .select("id, full_name, base_role, avatar_url")
        .eq("is_superadmin", false)
        .order("full_name", { ascending: true }),
    ]);

    if (eventRes.error || !eventRes.data) {
      return {
        success: false,
        error: eventRes.error?.message ?? "Event tidak ditemukan",
      };
    }

    return {
      success: true,
      data: {
        event: eventRes.data as EventWithLeader,
        roster: (rosterRes.data ?? []) as EventRosterMember[],
        users: (usersRes.data ?? []) as Pick<
          User,
          "id" | "full_name" | "base_role" | "avatar_url"
        >[],
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat detail event",
    };
  }
}

export async function createEventAction(
  input: unknown
): Promise<ActionResult<Event>> {
  try {
    const session = await getServerSession();
    if (!session) {
      return {
        success: false,
        error: "Sesi login tidak valid. Silakan login kembali sebagai Creative Leader.",
      };
    }

    if (isSupabaseConfigured()) {
      const supabaseCheck = createServerClient();
      const { data: actor } = await supabaseCheck
        .from("users")
        .select("base_role, is_superadmin")
        .eq("id", session.userId)
        .maybeSingle();
      if (!actor || (actor.base_role !== "CREATIVE_LEADER" && !actor.is_superadmin)) {
        return {
          success: false,
          error: "Akses ditolak: Hanya Creative Leader yang berwenang membuat event baru.",
        };
      }
    } else if (session.baseRole !== "CREATIVE_LEADER" && !session.isSuperadmin) {
      return {
        success: false,
        error: "Akses ditolak: Hanya Creative Leader yang berwenang membuat event baru.",
      };
    }

    const parsed = CreateEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data event tidak valid",
      };
    }

    const sectionLeaders = parsed.data.section_leaders;
    if (!sectionLeaders) {
      return {
        success: false,
        error: "Wajib menunjuk 4 Section Leader (Acara, Dekorasi, Perlengkapan, PDD) saat membuat event.",
      };
    }

    const leaderIds = [
      sectionLeaders.ACARA,
      sectionLeaders.DEKORASI,
      sectionLeaders.PERLENGKAPAN,
      sectionLeaders.PDD,
    ];
    if (new Set(leaderIds).size !== 4) {
      return {
        success: false,
        error: "Keempat Section Leader harus orang yang berbeda (1 orang maksimal 1 section per event).",
      };
    }

    const createdBy = session.userId ?? parsed.data.event_leader_id;
    const sectionAssignments: Array<{ section: SectionType; userId: string }> = [
      { section: "ACARA", userId: sectionLeaders.ACARA },
      { section: "DEKORASI", userId: sectionLeaders.DEKORASI },
      { section: "PERLENGKAPAN", userId: sectionLeaders.PERLENGKAPAN },
      { section: "PDD", userId: sectionLeaders.PDD },
    ];
    const eventLeaderInSection = sectionAssignments.some(
      (s) => s.userId === parsed.data.event_leader_id
    );

    if (!isSupabaseConfigured()) {
      const now = new Date().toISOString();
      const newEvent: EventWithLeader = {
        id: crypto.randomUUID(),
        title: parsed.data.title,
        theme: parsed.data.theme,
        event_date: parsed.data.event_date,
        status: "DRAFT",
        total_pause_seconds: 0,
        time_tolerance_seconds: parsed.data.time_tolerance_seconds,
        event_leader_id: parsed.data.event_leader_id,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
        event_leader:
          INITIAL_USERS.find((u) => u.id === parsed.data.event_leader_id) ?? null,
      };
      demoEvents.unshift(newEvent);

      const createdRoster: EventRosterMember[] = sectionAssignments.map((s) => ({
        id: crypto.randomUUID(),
        event_id: newEvent.id,
        user_id: s.userId,
        section: s.section,
        role_in_event: "SECTION_LEADER",
        is_co_controller: s.userId === parsed.data.event_leader_id,
        user: INITIAL_USERS.find((u) => u.id === s.userId),
      }));

      if (!eventLeaderInSection) {
        createdRoster.push({
          id: crypto.randomUUID(),
          event_id: newEvent.id,
          user_id: parsed.data.event_leader_id,
          section: "INTI",
          role_in_event: "EVENT_LEADER",
          is_co_controller: false,
          user: INITIAL_USERS.find((u) => u.id === parsed.data.event_leader_id),
        });
      }

      demoRoster.push(...createdRoster);
      revalidatePath("/events");
      return { success: true, data: newEvent, roster: createdRoster };
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: parsed.data.title,
        theme: parsed.data.theme,
        event_date: parsed.data.event_date,
        event_leader_id: parsed.data.event_leader_id,
        time_tolerance_seconds: parsed.data.time_tolerance_seconds,
        status: "DRAFT",
        created_by: createdBy,
      })
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Gagal membuat event",
      };
    }

    const rosterRowsToInsert = sectionAssignments.map((s) => ({
      event_id: data.id,
      user_id: s.userId,
      section: s.section,
      role_in_event: "SECTION_LEADER" as const,
      is_co_controller: s.userId === parsed.data.event_leader_id,
    }));

    if (!eventLeaderInSection) {
      rosterRowsToInsert.push({
        event_id: data.id,
        user_id: parsed.data.event_leader_id,
        section: "INTI" as unknown as SectionType,
        role_in_event: "EVENT_LEADER" as unknown as "SECTION_LEADER",
        is_co_controller: false,
      });
    }

    const { data: insertedRoster } = await supabase
      .from("event_roster")
      .insert(rosterRowsToInsert)
      .select(
        `
        *,
        user:users(id, full_name, base_role, avatar_url)
      `
      );

    revalidatePath("/events");
    return {
      success: true,
      data: data as Event,
      roster: (insertedRoster ?? []) as EventRosterMember[],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat event",
    };
  }
}

export async function updateEventAction(
  input: unknown
): Promise<ActionResult<Event>> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: "Sesi login diperlukan." };
    }

    const parsed = UpdateEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data update tidak valid",
      };
    }

    const { id, ...updates } = parsed.data;

    if (!isSupabaseConfigured()) {
      const idx = demoEvents.findIndex((e) => e.id === id);
      if (idx === -1) {
        return { success: false, error: "Event tidak ditemukan" };
      }
      demoEvents[idx] = {
        ...demoEvents[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      revalidatePath("/events");
      revalidatePath(`/events/${id}`);
      return { success: true, data: demoEvents[idx] };
    }

    const supabase = createServerClient();
    const [{ data: actor }, { data: targetEvent }, { data: rosterLeader }] = await Promise.all([
      supabase
        .from("users")
        .select("base_role, is_superadmin")
        .eq("id", session.userId)
        .maybeSingle(),
      supabase
        .from("events")
        .select("event_leader_id")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("event_roster")
        .select("id")
        .eq("event_id", id)
        .eq("user_id", session.userId)
        .or("role_in_event.eq.EVENT_LEADER,is_co_controller.eq.true")
        .maybeSingle(),
    ]);

    const canUpdate =
      actor &&
      (actor.base_role === "CREATIVE_LEADER" ||
        actor.base_role === "WAKIL_LEADER" ||
        Boolean(actor.is_superadmin) ||
        targetEvent?.event_leader_id === session.userId ||
        Boolean(rosterLeader));

    if (!canUpdate) {
      return {
        success: false,
        error: "Akses ditolak: Hanya Creative Leader, Wakil Leader, atau Event Leader yang dapat mengubah event.",
      };
    }

    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Gagal memperbarui event",
      };
    }

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return { success: true, data: data as Event };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui event",
    };
  }
}

export async function assignRosterAction(
  input: unknown
): Promise<ActionResult<EventRosterMember>> {
  try {
    const parsed = AssignRosterSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data roster tidak valid",
      };
    }

    const perm = await verifyRosterManagerPermission({
      eventId: parsed.data.event_id,
      targetSection: parsed.data.section,
      targetRole: parsed.data.role_in_event,
    });
    if (!perm.allowed) {
      return { success: false, error: perm.error ?? "Akses ditolak." };
    }

    if (!isSupabaseConfigured()) {
      const existingSameEvent = demoRoster.find(
        (r) =>
          r.event_id === parsed.data.event_id &&
          r.user_id === parsed.data.user_id
      );
      if (existingSameEvent) {
        return {
          success: false,
          error: `Anggota ini sudah terdaftar di divisi ${existingSameEvent.section} pada event ini (maksimal 1 section per event).`,
        };
      }
      const newMember: EventRosterMember = {
        id: crypto.randomUUID(),
        event_id: parsed.data.event_id,
        user_id: parsed.data.user_id,
        section: parsed.data.section,
        role_in_event: parsed.data.role_in_event,
        is_co_controller: parsed.data.is_co_controller,
        user: INITIAL_USERS.find((u) => u.id === parsed.data.user_id),
      };
      demoRoster.push(newMember);
      revalidatePath(`/events/${parsed.data.event_id}`);
      revalidatePath("/events");
      revalidatePath("/");
      return { success: true, data: newMember };
    }

    const supabase = createServerClient();
    const [{ data: targetUser }, { data: existingEntry }] = await Promise.all([
      supabase
        .from("users")
        .select("id, is_superadmin")
        .eq("id", parsed.data.user_id)
        .maybeSingle(),
      supabase
        .from("event_roster")
        .select("id, section")
        .eq("event_id", parsed.data.event_id)
        .eq("user_id", parsed.data.user_id)
        .maybeSingle(),
    ]);

    if (!targetUser) {
      return { success: false, error: "Akun anggota target tidak ditemukan." };
    }
    if (targetUser.is_superadmin) {
      return {
        success: false,
        error: "Akun teknis Superadmin tidak dapat ditugaskan ke dalam roster event.",
      };
    }

    if (existingEntry) {
      return {
        success: false,
        error: `Anggota ini sudah terdaftar di divisi ${existingEntry.section} pada event ini (maksimal 1 section per event).`,
      };
    }

    const { data, error } = await supabase
      .from("event_roster")
      .insert({
        event_id: parsed.data.event_id,
        user_id: parsed.data.user_id,
        section: parsed.data.section,
        role_in_event: parsed.data.role_in_event,
        is_co_controller: parsed.data.is_co_controller,
      })
      .select(
        `
        *,
        user:users(id, full_name, base_role, avatar_url)
      `
      )
      .single();

    if (error || !data) {
      const msg =
        error?.code === "23505"
          ? "Anggota ini sudah terdaftar di divisi lain pada event ini (maksimal 1 section per event)."
          : error?.message ?? "Gagal menambahkan anggota ke roster";
      return {
        success: false,
        error: msg,
      };
    }

    revalidatePath(`/events/${parsed.data.event_id}`);
    revalidatePath("/events");
    revalidatePath("/");
    return { success: true, data: data as EventRosterMember };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menambahkan roster",
    };
  }
}

export async function rollRosterSectionAction(params: {
  roster_id: string;
  event_id: string;
  section: SectionType;
  role_in_event: EventRole;
  is_co_controller: boolean;
}): Promise<ActionResult<EventRosterMember>> {
  const perm = await verifyRosterManagerPermission({
    eventId: params.event_id,
  });
  if (!perm.allowed) {
    return { success: false, error: perm.error ?? "Akses ditolak." };
  }

  if (!isSupabaseConfigured()) {
    const idx = demoRoster.findIndex((r) => r.id === params.roster_id);
    if (idx === -1) {
      return { success: false, error: "Anggota roster tidak ditemukan" };
    }
    demoRoster[idx] = {
      ...demoRoster[idx],
      section: params.section,
      role_in_event: params.role_in_event,
      is_co_controller: params.is_co_controller,
    };
    revalidatePath(`/events/${params.event_id}`);
    return { success: true, data: demoRoster[idx] };
  }

  try {
    const supabase = createServerClient();
    const { data: actor } = await supabase
      .from("users")
      .select("base_role, is_superadmin")
      .eq("id", perm.actorId!)
      .maybeSingle();
    const { data: targetEvent } = await supabase
      .from("events")
      .select("event_leader_id")
      .eq("id", params.event_id)
      .maybeSingle();
    const isTopLeader =
      actor?.base_role === "CREATIVE_LEADER" ||
      actor?.base_role === "WAKIL_LEADER" ||
      Boolean(actor?.is_superadmin) ||
      targetEvent?.event_leader_id === perm.actorId;
    if (!isTopLeader) {
      return {
        success: false,
        error: "Rolling section antar divisi hanya dilakukan oleh Creative Leader / Event Leader.",
      };
    }

    const { data, error } = await supabase
      .from("event_roster")
      .update({
        section: params.section,
        role_in_event: params.role_in_event,
        is_co_controller: params.is_co_controller,
      })
      .eq("id", params.roster_id)
      .select(
        `
        *,
        user:users(id, full_name, base_role, avatar_url)
      `
      )
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Gagal melakukan rolling section",
      };
    }

    revalidatePath(`/events/${params.event_id}`);
    revalidatePath("/events");
    revalidatePath("/");
    return { success: true, data: data as EventRosterMember };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal melakukan rolling section",
    };
  }
}

export async function removeRosterAction(
  rosterId: string,
  eventId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    const idx = demoRoster.findIndex((r) => r.id === rosterId);
    const target = idx !== -1 ? demoRoster[idx] : undefined;
    const perm = await verifyRosterManagerPermission({
      eventId,
      targetSection: target?.section,
      targetRole: target?.role_in_event,
    });
    if (!perm.allowed) {
      return { success: false, error: perm.error ?? "Akses ditolak." };
    }
    if (idx !== -1) {
      demoRoster.splice(idx, 1);
    }
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/");
    return { success: true };
  }

  try {
    const supabase = createServerClient();
    const { data: targetRow } = await supabase
      .from("event_roster")
      .select("section, role_in_event")
      .eq("id", rosterId)
      .maybeSingle();

    const perm = await verifyRosterManagerPermission({
      eventId,
      targetSection: targetRow?.section as SectionType | undefined,
      targetRole: targetRow?.role_in_event as EventRole | undefined,
    });
    if (!perm.allowed) {
      return { success: false, error: perm.error ?? "Akses ditolak." };
    }

    const { error } = await supabase
      .from("event_roster")
      .delete()
      .eq("id", rosterId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus anggota roster",
    };
  }
}

export async function deleteEventAction(
  eventId: string,
  reason?: string
): Promise<ActionResult<{ id: string; title: string; status: EventStatus }>> {
  if (!isSupabaseConfigured()) {
    const session = await getServerSession();
    if (!session) {
      return {
        success: false,
        error: "Sesi login tidak valid. Silakan masuk terlebih dahulu.",
      };
    }
    if (session.baseRole !== "CREATIVE_LEADER" && !session.isSuperadmin) {
      return {
        success: false,
        error: "Hanya Creative Leader atau Superadmin yang berhak menghapus event.",
      };
    }

    const idx = demoEvents.findIndex((ev) => ev.id === eventId);
    if (idx === -1) {
      return { success: false, error: "Event tidak ditemukan." };
    }
    const target = demoEvents[idx];
    const validation = validateEventDeletionStatus(target.status, reason);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    demoEvents.splice(idx, 1);
    for (let i = demoRoster.length - 1; i >= 0; i -= 1) {
      if (demoRoster[i].event_id === eventId) {
        demoRoster.splice(i, 1);
      }
    }

    revalidatePath("/events");
    revalidatePath("/");
    return {
      success: true,
      data: { id: target.id, title: target.title, status: target.status },
    };
  }

  try {
    const result = await executeSupabaseEventDeletion(eventId, reason);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/events");
    revalidatePath("/");
    return { success: true, data: result.deletedEvent };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus event",
    };
  }
}
