import {
  User,
  Event,
  EventRosterMember,
  Rundown,
  RundownItem,
  LiveLog,
  TimelineTask,
  EventTechnicalGuide,
  EventBudgetLedgerItem,
  EventMeetingNote,
  SectionToolInventory,
  SectionPddShotlist,
  PddDriveReference,
  AppNotification,
  SectionType,
} from "@/types/domain";

import { getTodayIsoWIB } from "@/lib/utils";

// Empty initial seed arrays (populated dynamically from Supabase)
export const INITIAL_USERS: User[] = [];

export const INITIAL_EVENT: Event = {
  id: "",
  title: "Belum Ada Event",
  theme: "",
  event_date: getTodayIsoWIB(),
  status: "DRAFT",
  live_started_at: null,
  live_ended_at: null,
  live_paused_at: null,
  total_pause_seconds: 0,
  segment_pause_seconds: 0,
  current_item_id: null,
  current_item_started_at: null,
  time_tolerance_seconds: 60,
  event_leader_id: "",
  created_by: "",
  created_at: "",
  updated_at: "",
};

export const INITIAL_EVENTS: Event[] = [];

export const INITIAL_ROSTER: EventRosterMember[] = [];

export const INITIAL_RUNDOWN_ITEMS: RundownItem[] = [];

export const INITIAL_LIVE_LOGS: LiveLog[] = [];

const CORE_LEADER_ROLES = new Set([
  "CREATIVE_LEADER",
  "WAKIL_LEADER",
  "SEKRETARIS",
  "BENDAHARA",
]);

export function isUnassignedMember(user: User | null): boolean {
  if (!user) return false;
  if (user.is_superadmin || user.base_role !== "MEMBER") return false;
  return user.is_role_assigned === false || (!user.is_role_assigned && !user.default_section);
}

export function canUserAccessEvent(
  user: User | null,
  eventId: string,
  roster: EventRosterMember[]
): boolean {
  if (!user) return false;
  if (user.is_superadmin || CORE_LEADER_ROLES.has(user.base_role)) {
    return true;
  }
  if (isUnassignedMember(user)) {
    return true;
  }
  return roster.some((m) => m.event_id === eventId && m.user_id === user.id);
}

export function canUserInitiateBrief(
  user: User | null,
  event: Event,
  roster: EventRosterMember[]
): boolean {
  if (!user) return false;
  if (user.base_role === "CREATIVE_LEADER" || user.base_role === "WAKIL_LEADER" || user.is_superadmin) {
    return true;
  }
  return isUserEventLeader(user, event, roster);
}

export function isUserEventLeader(
  user: User | null,
  event: Event,
  roster: EventRosterMember[]
): boolean {
  if (!user) return false;
  if (user.id === event.event_leader_id) return true;
  return roster.some(
    (m) =>
      m.event_id === event.id &&
      m.user_id === user.id &&
      (m.role_in_event === "EVENT_LEADER" || m.is_co_controller)
  );
}

export type SectionAccessMode = "EDIT" | "MONITOR" | "LOCKED";

export function getSectionAccessMode(
  user: User | null,
  event: Event,
  roster: EventRosterMember[],
  targetSection: SectionType
): SectionAccessMode {
  if (!user || isUnassignedMember(user)) return "LOCKED";

  const isAssignedToSection = roster.some(
    (r) =>
      r.event_id === event.id &&
      r.user_id === user.id &&
      (r.section === targetSection || r.section === "ALL")
  );
  if (isAssignedToSection) {
    return "EDIT";
  }

  if (
    user.default_section &&
    (user.default_section === targetSection || user.default_section === "INTI" || user.default_section === "ALL") &&
    user.base_role === "SECTION_LEADER"
  ) {
    return "EDIT";
  }

  if (
    user.base_role === "CREATIVE_LEADER" ||
    user.base_role === "WAKIL_LEADER" ||
    user.is_superadmin ||
    isUserEventLeader(user, event, roster)
  ) {
    return "MONITOR";
  }

  return "LOCKED";
}

export function getFinanceAccessMode(user: User | null): SectionAccessMode {
  if (!user || isUnassignedMember(user)) return "LOCKED";
  if (user.base_role === "BENDAHARA") return "EDIT";
  if (
    user.base_role === "CREATIVE_LEADER" ||
    user.base_role === "WAKIL_LEADER" ||
    user.base_role === "SEKRETARIS" ||
    user.base_role === "SECTION_LEADER" ||
    user.is_superadmin
  ) {
    return "MONITOR";
  }
  return "LOCKED";
}

export function getNotesAccessMode(user: User | null): SectionAccessMode {
  if (!user || isUnassignedMember(user)) return "LOCKED";
  if (user.base_role === "SEKRETARIS") return "EDIT";
  if (
    user.base_role === "CREATIVE_LEADER" ||
    user.base_role === "WAKIL_LEADER" ||
    user.base_role === "BENDAHARA" ||
    user.base_role === "SECTION_LEADER" ||
    user.is_superadmin
  ) {
    return "MONITOR";
  }
  return "LOCKED";
}

export function getProposalAccessMode(user: User | null): SectionAccessMode {
  if (!user || isUnassignedMember(user)) return "LOCKED";
  return "EDIT";
}

export function isCreativeLeader(user: User | null): boolean {
  if (!user) return false;
  return user.base_role === "CREATIVE_LEADER" || Boolean(user.is_superadmin);
}

const ALL_SECTIONS: SectionType[] = ["ACARA", "DEKORASI", "PERLENGKAPAN", "PDD"];

export function getUserHomeSection(
  user: User | null,
  eventId?: string,
  roster?: EventRosterMember[]
): SectionType | null {
  if (!user) return null;

  if (roster && roster.length > 0) {
    const exactMatch = eventId
      ? roster.find(
          (r) =>
            r.event_id === eventId &&
            r.user_id === user.id &&
            r.section !== "ALL"
        )
      : undefined;
    if (exactMatch && exactMatch.section !== "ALL") {
      return exactMatch.section;
    }

    const anyMatch = roster.find(
      (r) => r.user_id === user.id && r.section !== "ALL"
    );
    if (anyMatch && anyMatch.section !== "ALL") {
      return anyMatch.section;
    }
  }

  if (user.default_section && user.default_section !== "ALL") {
    return user.default_section;
  }

  const lower = user.full_name.toLowerCase();
  if (lower.includes("acara")) return "ACARA";
  if (lower.includes("dekor")) return "DEKORASI";
  if (lower.includes("perlengkapan")) return "PERLENGKAPAN";
  if (lower.includes("pdd")) return "PDD";

  return null;
}

export function getAllowedSectionsForUser(
  user: User | null,
  eventId?: string,
  roster?: EventRosterMember[]
): SectionType[] {
  if (!user) return ALL_SECTIONS;

  if (
    user.base_role === "CREATIVE_LEADER" ||
    user.base_role === "WAKIL_LEADER" ||
    user.base_role === "SEKRETARIS" ||
    user.base_role === "BENDAHARA" ||
    user.is_superadmin
  ) {
    return ALL_SECTIONS;
  }

  const homeSection = getUserHomeSection(user, eventId, roster);
  return homeSection ? [homeSection] : ALL_SECTIONS;
}

export function getUsersBySection(
  users: User[],
  targetSection: SectionType | "ALL",
  eventId?: string,
  roster?: EventRosterMember[]
): User[] {
  if (!targetSection || targetSection === "ALL") return users;

  return users.filter((u) => {
    if (roster && eventId) {
      const inEventRoster = roster.some(
        (r) =>
          r.event_id === eventId &&
          r.user_id === u.id &&
          r.section === targetSection
      );
      if (inEventRoster) return true;
    }
    return getUserHomeSection(u, eventId, roster) === targetSection;
  });
}

export const INITIAL_PDD_REFERENCES: PddDriveReference[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
