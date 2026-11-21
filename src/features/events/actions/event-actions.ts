"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
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
  User,
} from "@/types/domain";

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
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

async function verifyCreativeLeaderSession(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) {
    return "Sesi login tidak valid. Silakan login kembali sebagai Creative Leader.";
  }
  if (session.baseRole !== "CREATIVE_LEADER" && !session.isSuperadmin) {
    return "Akses ditolak: Hanya Creative Leader yang berwenang melakukan aksi ini.";
  }
  return null;
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
        users: INITIAL_USERS.map((u) => ({
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
    const authError = await verifyCreativeLeaderSession();
    if (authError) {
      return { success: false, error: authError };
    }

    const parsed = CreateEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data event tidak valid",
      };
    }

    const session = await getServerSession();
    const createdBy = session?.userId ?? parsed.data.event_leader_id;

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
      demoRoster.push({
        id: crypto.randomUUID(),
        event_id: newEvent.id,
        user_id: parsed.data.event_leader_id,
        section: "INTI",
        role_in_event: "EVENT_LEADER",
        is_co_controller: false,
        user: INITIAL_USERS.find((u) => u.id === parsed.data.event_leader_id),
      });
      revalidatePath("/events");
      return { success: true, data: newEvent };
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

    // Auto-assign Event Leader to roster in INTI section
    await supabase.from("event_roster").insert({
      event_id: data.id,
      user_id: parsed.data.event_leader_id,
      section: "INTI",
      role_in_event: "EVENT_LEADER",
      is_co_controller: false,
    });

    revalidatePath("/events");
    return { success: true, data: data as Event };
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
    const authError = await verifyCreativeLeaderSession();
    if (authError) {
      return { success: false, error: authError };
    }

    const parsed = AssignRosterSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data roster tidak valid",
      };
    }

    if (!isSupabaseConfigured()) {
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
      return { success: true, data: newMember };
    }

    const supabase = createServerClient();
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
      return {
        success: false,
        error: error?.message ?? "Gagal menambahkan anggota ke roster",
      };
    }

    revalidatePath(`/events/${parsed.data.event_id}`);
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
  const authError = await verifyCreativeLeaderSession();
  if (authError) {
    return { success: false, error: authError };
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
  const authError = await verifyCreativeLeaderSession();
  if (authError) {
    return { success: false, error: authError };
  }

  if (!isSupabaseConfigured()) {
    const idx = demoRoster.findIndex((r) => r.id === rosterId);
    if (idx !== -1) {
      demoRoster.splice(idx, 1);
    }
    revalidatePath(`/events/${eventId}`);
    return { success: true };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("event_roster")
      .delete()
      .eq("id", rosterId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/events/${eventId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus anggota roster",
    };
  }
}
