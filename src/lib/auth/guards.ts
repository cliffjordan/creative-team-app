import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession, type SessionPayload } from "@/lib/auth/session";
import {
  isValidHttpUrl,
  SafeHttpUrlSchema,
  SafeNameSchema,
} from "@/lib/validators/schemas";
import type { EventRole, SectionType, UserBaseRole } from "@/types/domain";

export { isValidHttpUrl, SafeHttpUrlSchema, SafeNameSchema };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORE_LEADER_ROLES = new Set<string>([
  "CREATIVE_LEADER",
  "WAKIL_LEADER",
  "SEKRETARIS",
  "BENDAHARA",
]);

export type SectionResourceKind =
  | "tools"
  | "decor"
  | "shotlist"
  | "references"
  | "guides";

const SECTION_KIND_MAP: Record<SectionResourceKind, SectionType> = {
  tools: "PERLENGKAPAN",
  decor: "DEKORASI",
  shotlist: "PDD",
  references: "PDD",
  guides: "ACARA",
};

export interface EventAccessActor {
  id: string;
  base_role: UserBaseRole;
  is_superadmin: boolean;
  is_role_assigned: boolean;
}

export interface EventAccessRoster {
  section: SectionType;
  role_in_event: EventRole;
  is_co_controller: boolean;
}

export type EventAccessResult =
  | {
      allowed: false;
      status: 400 | 401 | 403 | 404;
      error: string;
    }
  | {
      allowed: true;
      session: SessionPayload;
      actor: EventAccessActor;
      roster: EventAccessRoster | null;
      isTopLeader: boolean;
    };

export async function requireEventAccess(
  eventId: string
): Promise<EventAccessResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      allowed: false,
      status: 401,
      error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.",
    };
  }

  if (!isSupabaseConfigured()) {
    const isTopLeader =
      session.isSuperadmin ||
      session.baseRole === "CREATIVE_LEADER" ||
      session.baseRole === "WAKIL_LEADER";
    return {
      allowed: true,
      session,
      actor: {
        id: session.userId,
        base_role: session.baseRole,
        is_superadmin: Boolean(session.isSuperadmin),
        is_role_assigned: true,
      },
      roster: null,
      isTopLeader,
    };
  }

  if (!UUID_REGEX.test(eventId)) {
    return {
      allowed: false,
      status: 400,
      error: "ID event tidak valid.",
    };
  }

  const supabase = createServerClient();
  const [{ data: actor }, { data: eventRow }, { data: rosterRow }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, base_role, is_superadmin, is_role_assigned")
        .eq("id", session.userId)
        .maybeSingle(),
      supabase
        .from("events")
        .select("id, event_leader_id")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("event_roster")
        .select("section, role_in_event, is_co_controller")
        .eq("event_id", eventId)
        .eq("user_id", session.userId)
        .maybeSingle(),
    ]);

  if (!actor) {
    return {
      allowed: false,
      status: 401,
      error: "Akun pengguna tidak ditemukan.",
    };
  }

  if (!eventRow) {
    return {
      allowed: false,
      status: 404,
      error: "Event tidak ditemukan.",
    };
  }

  const normalizedActor: EventAccessActor = {
    id: actor.id,
    base_role: actor.base_role as UserBaseRole,
    is_superadmin: Boolean(actor.is_superadmin),
    is_role_assigned: Boolean(actor.is_role_assigned),
  };

  const normalizedRoster: EventAccessRoster | null = rosterRow
    ? {
        section: rosterRow.section as SectionType,
        role_in_event: rosterRow.role_in_event as EventRole,
        is_co_controller: Boolean(rosterRow.is_co_controller),
      }
    : null;

  const isTopLeader =
    normalizedActor.is_superadmin ||
    normalizedActor.base_role === "CREATIVE_LEADER" ||
    normalizedActor.base_role === "WAKIL_LEADER" ||
    eventRow.event_leader_id === normalizedActor.id ||
    normalizedRoster?.role_in_event === "EVENT_LEADER" ||
    Boolean(normalizedRoster?.is_co_controller);

  const hasAccess =
    isTopLeader ||
    CORE_LEADER_ROLES.has(normalizedActor.base_role) ||
    Boolean(normalizedRoster);

  if (!hasAccess) {
    return {
      allowed: false,
      status: 403,
      error: "Akses ditolak: Anda tidak terdaftar pada event ini.",
    };
  }

  return {
    allowed: true,
    session,
    actor: normalizedActor,
    roster: normalizedRoster,
    isTopLeader,
  };
}

export async function requireEventController(
  eventId: string
): Promise<EventAccessResult> {
  const access = await requireEventAccess(eventId);
  if (!access.allowed) return access;
  if (!access.isTopLeader) {
    return {
      allowed: false,
      status: 403,
      error:
        "Akses ditolak: Hanya Creative Leader, Event Leader, atau Co-Controller yang berwenang.",
    };
  }
  return access;
}

export async function requireSectionWriteAccess(
  eventId: string,
  kind: SectionResourceKind
): Promise<EventAccessResult> {
  const access = await requireEventAccess(eventId);
  if (!access.allowed) return access;

  const requiredSection = SECTION_KIND_MAP[kind];
  const hasSectionPermission =
    access.isTopLeader ||
    access.roster?.section === requiredSection ||
    access.roster?.section === "ALL";

  if (!hasSectionPermission) {
    return {
      allowed: false,
      status: 403,
      error: `Akses ditolak: Hanya anggota divisi ${requiredSection} atau pimpinan event yang dapat mengubah data ini.`,
    };
  }
  return access;
}
