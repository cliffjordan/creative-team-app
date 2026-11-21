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

// Initial Seed Users (Team members with default PIN '1234')
export const INITIAL_USERS: User[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    full_name: "Jordan (Creative Leader)",
    email: "jordan@church.org",
    phone: "081234567890",
    is_superadmin: true,
    base_role: "CREATIVE_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    full_name: "Kevin (Wakil Creative Leader)",
    email: "kevin@church.org",
    phone: "081234567891",
    is_superadmin: false,
    base_role: "WAKIL_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kevin",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    full_name: "Grace (Sekretaris)",
    email: "grace@church.org",
    phone: "081234567892",
    is_superadmin: false,
    base_role: "SEKRETARIS",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Grace",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    full_name: "David (Bendahara)",
    email: "david@church.org",
    phone: "081234567893",
    is_superadmin: false,
    base_role: "BENDAHARA",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    full_name: "Budi (Leader Acara)",
    email: "budi@church.org",
    phone: "081234567894",
    is_superadmin: false,
    base_role: "SECTION_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Budi",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    full_name: "Sarah (Leader Dekorasi)",
    email: "sarah@church.org",
    phone: "081234567895",
    is_superadmin: false,
    base_role: "SECTION_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    full_name: "Daniel (Leader Perlengkapan)",
    email: "daniel@church.org",
    phone: "081234567896",
    is_superadmin: false,
    base_role: "SECTION_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    full_name: "Michael (Leader PDD)",
    email: "michael@church.org",
    phone: "081234567897",
    is_superadmin: false,
    base_role: "SECTION_LEADER",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
  },
  // Members Acara
  { id: "00000000-0000-4000-8000-000000000009", full_name: "Andi (Member Acara 1)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000010", full_name: "Bella (Member Acara 2)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000011", full_name: "Cynthia (Member Acara 3)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  // Members Dekor
  { id: "00000000-0000-4000-8000-000000000012", full_name: "Doni (Member Dekor 1)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000013", full_name: "Elsa (Member Dekor 2)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000014", full_name: "Ferry (Member Dekor 3)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  // Members Perlengkapan
  { id: "00000000-0000-4000-8000-000000000015", full_name: "Gerry (Member Perlengkapan 1)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000016", full_name: "Hanna (Member Perlengkapan 2)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000017", full_name: "Ivan (Member Perlengkapan 3)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  // Members PDD
  { id: "00000000-0000-4000-8000-000000000018", full_name: "Jessica (Member PDD 1)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000019", full_name: "Koko (Member PDD 2)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
  { id: "00000000-0000-4000-8000-000000000020", full_name: "Lisa (Member PDD 3)", base_role: "MEMBER", is_superadmin: false, failed_pin_attempts: 0, created_at: new Date().toISOString() },
];

export const INITIAL_EVENT: Event = {
  id: "20000000-0000-4000-8000-000000000001",
  title: "Perayaan Natal Kreatif 2026",
  theme: "Light of Hope - Terang di Tengah Kegelapan",
  event_date: "2026-12-25",
  status: "EVENT_DAY",
  live_started_at: null,
  live_ended_at: null,
  live_paused_at: null,
  total_pause_seconds: 0,
  segment_pause_seconds: 0,
  current_item_id: "rnd-item-1",
  current_item_started_at: null,
  time_tolerance_seconds: 60,
  event_leader_id: "00000000-0000-4000-8000-000000000005", // Budi (Event Leader untuk acara Natal ini)
  created_by: "00000000-0000-4000-8000-000000000001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const INITIAL_EVENTS: Event[] = [
  INITIAL_EVENT,
  {
    id: "20000000-0000-4000-8000-000000000002",
    title: "Ibadah Jumat Agung & Paskah 2027",
    theme: "Risen Hope - Kuasa Kebangkitan",
    event_date: "2027-03-28",
    status: "PRE_EVENT",
    live_started_at: null,
    live_ended_at: null,
    live_paused_at: null,
    total_pause_seconds: 0,
    current_item_id: null,
    current_item_started_at: null,
    time_tolerance_seconds: 60,
    event_leader_id: "00000000-0000-4000-8000-000000000006", // Sarah
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    title: "Malam Pujian & KKR Pemuda 2026",
    theme: "Ignite Generation",
    event_date: "2026-10-17",
    status: "POST_EVENT",
    live_started_at: null,
    live_ended_at: null,
    live_paused_at: null,
    total_pause_seconds: 0,
    current_item_id: null,
    current_item_started_at: null,
    time_tolerance_seconds: 60,
    event_leader_id: "00000000-0000-4000-8000-000000000008", // Michael
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const INITIAL_ROSTER: EventRosterMember[] = [
  // Event 1: Natal 2026 (Leader: Budi)
  { id: "50000000-0000-4000-8000-000000000001", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000005", section: "ACARA", role_in_event: "EVENT_LEADER", is_co_controller: true },
  { id: "50000000-0000-4000-8000-000000000002", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000001", section: "INTI", role_in_event: "CO_CONTROLLER", is_co_controller: true },
  { id: "50000000-0000-4000-8000-000000000003", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000002", section: "INTI", role_in_event: "CO_CONTROLLER", is_co_controller: true },
  { id: "50000000-0000-4000-8000-000000000004", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000006", section: "DEKORASI", role_in_event: "SECTION_LEADER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000005", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000007", section: "PERLENGKAPAN", role_in_event: "SECTION_LEADER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000006", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000008", section: "PDD", role_in_event: "SECTION_LEADER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000007", event_id: "20000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000009", section: "ACARA", role_in_event: "MEMBER", is_co_controller: false },
  // Event 2: Paskah 2027 (Leader: Sarah)
  { id: "50000000-0000-4000-8000-000000000008", event_id: "20000000-0000-4000-8000-000000000002", user_id: "00000000-0000-4000-8000-000000000006", section: "DEKORASI", role_in_event: "EVENT_LEADER", is_co_controller: true },
  { id: "50000000-0000-4000-8000-000000000009", event_id: "20000000-0000-4000-8000-000000000002", user_id: "00000000-0000-4000-8000-000000000005", section: "ACARA", role_in_event: "MEMBER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000010", event_id: "20000000-0000-4000-8000-000000000002", user_id: "00000000-0000-4000-8000-000000000012", section: "DEKORASI", role_in_event: "MEMBER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000011", event_id: "20000000-0000-4000-8000-000000000002", user_id: "00000000-0000-4000-8000-000000000015", section: "PERLENGKAPAN", role_in_event: "MEMBER", is_co_controller: false },
  // Event 3: KKR Pemuda 2026 (Leader: Michael)
  { id: "50000000-0000-4000-8000-000000000012", event_id: "20000000-0000-4000-8000-000000000003", user_id: "00000000-0000-4000-8000-000000000008", section: "PDD", role_in_event: "EVENT_LEADER", is_co_controller: true },
  { id: "50000000-0000-4000-8000-000000000013", event_id: "20000000-0000-4000-8000-000000000003", user_id: "00000000-0000-4000-8000-000000000007", section: "PERLENGKAPAN", role_in_event: "SECTION_LEADER", is_co_controller: false },
  { id: "50000000-0000-4000-8000-000000000014", event_id: "20000000-0000-4000-8000-000000000003", user_id: "00000000-0000-4000-8000-000000000018", section: "PDD", role_in_event: "MEMBER", is_co_controller: false },
];

export const INITIAL_RUNDOWN_ITEMS: RundownItem[] = [
  {
    id: "rnd-item-1",
    rundown_id: "rnd-1",
    order_index: 1,
    title: "Open Gate & Penyambutan Jemaat",
    section_pic: "ACARA",
    pic_user_id: "00000000-0000-4000-8000-000000000005",
    planned_start_time: "17:00",
    estimated_duration_minutes: 30,
    status: "PENDING",
    technical_notes: "BGM Natal instrumen diputar pelan, usher standby di pintu masuk utama.",
    cue_props: "Buku tamu, souvenir lilin natal",
  },
  {
    id: "rnd-item-2",
    rundown_id: "rnd-1",
    order_index: 2,
    title: "Opening Video Countdown & Teatrikal Pembuka",
    section_pic: "PDD",
    pic_user_id: "00000000-0000-4000-8000-000000000008",
    planned_start_time: "17:30",
    estimated_duration_minutes: 10,
    status: "PENDING",
    technical_notes: "Lighting blackout total, video countdown diputar di videotron, cue audio boom.",
    cue_props: "Videotron file: countdown_final.mp4",
  },
  {
    id: "rnd-item-3",
    rundown_id: "rnd-1",
    order_index: 3,
    title: "Praise & Worship (3 Lagu)",
    section_pic: "ACARA",
    pic_user_id: "00000000-0000-4000-8000-000000000009",
    planned_start_time: "17:40",
    estimated_duration_minutes: 25,
    status: "PENDING",
    technical_notes: "Lighting dinamis warm white & gold, lirik PPT disiapkan PDD.",
    cue_props: "Mic WL 2x, Singer 3x, Band",
  },
  {
    id: "rnd-item-4",
    rundown_id: "rnd-1",
    order_index: 4,
    title: "Penampilan Kelas Anak (Sekolah Minggu)",
    section_pic: "ACARA",
    pic_user_id: "00000000-0000-4000-8000-0000000000010",
    planned_start_time: "18:05",
    estimated_duration_minutes: 15,
    status: "PENDING",
    technical_notes: "Gate in pintu kiri panggung, gate out pintu kanan. Guru pendamping standby.",
    cue_props: "Bando malaikat, mic clip-on guru",
  },
  {
    id: "rnd-item-5",
    rundown_id: "rnd-1",
    order_index: 5,
    title: "Pemberitaan Firman Tuhan (Khotbah Natal)",
    section_pic: "ACARA",
    pic_user_id: "00000000-0000-4000-8000-000000000005",
    planned_start_time: "18:20",
    estimated_duration_minutes: 40,
    status: "PENDING",
    technical_notes: "Spotlight mimbar utama, audio record dinyalakan.",
    cue_props: "Mimbar, segelas air minum",
  },
  {
    id: "rnd-item-6",
    rundown_id: "rnd-1",
    order_index: 6,
    title: "Candle Light Service (Malam Kudus)",
    section_pic: "PERLENGKAPAN",
    pic_user_id: "00000000-0000-4000-8000-000000000007",
    planned_start_time: "19:00",
    estimated_duration_minutes: 20,
    status: "PENDING",
    technical_notes: "Lampu gedung dimatikan bertahap. Tim perlengkapan bagi api lilin dari depan ke belakang.",
    cue_props: "Lilin induk, pemantik api 10x, lilin jemaat",
  },
  {
    id: "rnd-item-7",
    rundown_id: "rnd-1",
    order_index: 7,
    title: "Doa Berkat & Foto Bersama Seluruh Jemaat",
    section_pic: "PDD",
    pic_user_id: "00000000-0000-4000-8000-000000000008",
    planned_start_time: "19:20",
    estimated_duration_minutes: 15,
    status: "PENDING",
    technical_notes: "Lighting full house, drone/kamera wide di balkon tengah.",
    cue_props: "Kamera Sony A7IV + Lens 16-35mm",
  },
];

export const INITIAL_LIVE_LOGS: LiveLog[] = [
  {
    id: "log-1",
    event_id: "20000000-0000-4000-8000-000000000001",
    log_type: "INCIDENT",
    description: "Kabel mic clip-on guru di backstage pintu kiri sempat kresek-kresek, sudah diganti kabel cadangan.",
    reported_by: "00000000-0000-4000-8000-000000000015",
    severity: "MEDIUM",
    status: "OPEN",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

const CORE_LEADER_ROLES = new Set([
  "CREATIVE_LEADER",
  "WAKIL_LEADER",
  "SEKRETARIS",
  "BENDAHARA",
]);

export function canUserAccessEvent(
  user: User | null,
  eventId: string,
  roster: EventRosterMember[]
): boolean {
  if (!user) return false;
  if (user.is_superadmin || CORE_LEADER_ROLES.has(user.base_role)) {
    return true;
  }
  return roster.some((m) => m.event_id === eventId && m.user_id === user.id);
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
  if (!user) return "LOCKED";

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
  if (!user) return "LOCKED";
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
  if (!user) return "LOCKED";
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

export const INITIAL_PDD_REFERENCES: PddDriveReference[] = [
  {
    id: "pdd-ref-1",
    event_id: "20000000-0000-4000-8000-000000000001",
    phase: "PRE_EVENT",
    title: "Folder Aset Desain & Bumper Natal 2026",
    url: "https://drive.google.com/drive/folders/natal-2026-pre-event",
    created_at: new Date().toISOString(),
  },
  {
    id: "pdd-ref-2",
    event_id: "20000000-0000-4000-8000-000000000001",
    phase: "EVENT_DAY",
    title: "Raw Footage & Live Photos Natal 2026",
    url: "https://drive.google.com/drive/folders/natal-2026-event-day",
    created_at: new Date().toISOString(),
  },
  {
    id: "pdd-ref-3",
    event_id: "20000000-0000-4000-8000-000000000001",
    phase: "POST_EVENT",
    title: "Aftermovie & Highlight Reels Natal 2026",
    url: "https://drive.google.com/drive/folders/natal-2026-post-event",
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    user_id: "00000000-0000-4000-8000-000000000001",
    event_id: "20000000-0000-4000-8000-000000000001",
    type: "INCIDENT_REPORTED",
    title: "Insiden Audio Backstage",
    body: "Kabel mic clip-on guru di backstage pintu kiri sempat kresek-kresek, sudah diganti kabel cadangan.",
    read_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "notif-2",
    user_id: "00000000-0000-4000-8000-000000000005",
    event_id: "20000000-0000-4000-8000-000000000001",
    type: "EVENT_STATUS",
    title: "Event Day Dimulai",
    body: "Perayaan Natal Kreatif 2026 memasuki fase EVENT_DAY. Pastikan semua PIC seksi standby.",
    read_at: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];
