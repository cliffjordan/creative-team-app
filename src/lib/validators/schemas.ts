import { z } from "zod";

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const SafeHttpUrlSchema = z
  .string()
  .trim()
  .max(2000, "URL terlalu panjang")
  .refine(
    (v) => v === "" || isValidHttpUrl(v),
    "URL hanya boleh menggunakan protokol http:// atau https://"
  )
  .nullable()
  .optional();

export const SafeNameSchema = z
  .string()
  .trim()
  .min(2, "Nama lengkap minimal 2 karakter")
  .max(120, "Nama terlalu panjang")
  .refine(
    (v) => !/[<>]/.test(v),
    "Nama tidak boleh mengandung karakter HTML (< atau >)"
  );

// ─── Enum Schemas ──────────────────────────────────────────────────────────────

export const UserBaseRoleSchema = z.enum([
  "CREATIVE_LEADER",
  "WAKIL_LEADER",
  "SEKRETARIS",
  "BENDAHARA",
  "SECTION_LEADER",
  "MEMBER",
]);

export const EventStatusSchema = z.enum([
  "DRAFT",
  "PRE_EVENT",
  "EVENT_DAY",
  "POST_EVENT",
  "COMPLETED",
]);

export const SectionTypeSchema = z.enum([
  "ACARA",
  "DEKORASI",
  "PERLENGKAPAN",
  "PDD",
  "INTI",
  "ALL",
]);

export const EventRoleSchema = z.enum([
  "EVENT_LEADER",
  "CO_CONTROLLER",
  "SECTION_LEADER",
  "MEMBER",
]);

export const RundownItemStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "FINISHED",
  "SKIPPED",
]);

export const LogTypeSchema = z.enum([
  "OVERTIME",
  "EARLYEND",
  "CHANGEQUEUE",
  "INCIDENT",
  "PAUSE",
  "RESUME",
]);

export const LogSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const LogStatusSchema = z.enum(["OPEN", "RESOLVED", "CLOSED"]);

export const TaskPhaseSchema = z.enum(["PRE_EVENT", "EVENT_DAY", "POST_EVENT"]);

export const TaskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "ESCALATED",
  "DONE",
]);

// ─── Auth Schemas ──────────────────────────────────────────────────────────────

export const PinLoginSchema = z.object({
  user_id: z.string().uuid("ID pengguna tidak valid"),
  pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus berupa angka"),
});

export const PinResetSchema = z.object({
  user_id: z.string().uuid(),
  new_pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus berupa angka"),
});

// ─── Event Schemas ─────────────────────────────────────────────────────────────

export const SectionLeadersMapSchema = z.object({
  ACARA: z.string().uuid("Pilih Section Leader Acara"),
  DEKORASI: z.string().uuid("Pilih Section Leader Dekorasi"),
  PERLENGKAPAN: z.string().uuid("Pilih Section Leader Perlengkapan"),
  PDD: z.string().uuid("Pilih Section Leader PDD"),
});

export const CreateEventSchema = z.object({
  title: z.string().min(3, "Judul event minimal 3 karakter").max(200),
  theme: z.string().min(2, "Tema wajib diisi").max(300),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
  dresscode: z.string().max(500).optional(),
  event_leader_id: z.string().uuid("Pilih Event Leader"),
  section_leaders: SectionLeadersMapSchema.optional(),
  time_tolerance_seconds: z.number().int().min(0).max(600).default(60),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  id: z.string().uuid(),
  status: EventStatusSchema.optional(),
});

// ─── Rundown Schemas ───────────────────────────────────────────────────────────

export const CreateRundownSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(2, "Nama rundown minimal 2 karakter").max(200),
  is_template: z.boolean().default(false),
  template_category: z.string().max(100).nullable().optional(),
});

export const CreateRundownItemSchema = z.object({
  rundown_id: z.string().uuid(),
  order_index: z.number().int().min(0),
  title: z.string().min(2, "Nama segment minimal 2 karakter").max(200),
  section_pic: SectionTypeSchema,
  pic_user_id: z.string().uuid().nullable().optional(),
  planned_start_time: z.string().nullable().optional(),
  estimated_duration_minutes: z
    .number()
    .int()
    .min(1, "Durasi minimal 1 menit")
    .max(600),
  technical_notes: z.string().max(2000).nullable().optional(),
  cue_props: z.string().max(1000).nullable().optional(),
});

export const UpdateRundownItemSchema = CreateRundownItemSchema.partial().extend({
  id: z.string().uuid(),
  status: RundownItemStatusSchema.optional(),
  actual_start_at: z.string().nullable().optional(),
  actual_end_at: z.string().nullable().optional(),
});

// ─── Live Log Schemas ──────────────────────────────────────────────────────────

export const CreateLiveLogSchema = z.object({
  event_id: z.string().uuid(),
  rundown_item_id: z.string().uuid().nullable().optional(),
  log_type: LogTypeSchema,
  delta_seconds: z.number().int().nullable().optional(),
  reported_by: z.string().uuid(),
  description: z.string().min(1, "Deskripsi wajib diisi").max(2000),
  photo_url: z.string().url().nullable().optional(),
  severity: LogSeveritySchema.default("MEDIUM"),
  status: LogStatusSchema.default("OPEN"),
});

export const ResolveLogSchema = z.object({
  id: z.string().uuid(),
  resolution_notes: z.string().min(1, "Catatan penyelesaian wajib diisi").max(2000),
  resolved_by: z.string().uuid(),
  status: z.enum(["RESOLVED", "CLOSED"]),
});

// ─── Timeline Task Schemas ─────────────────────────────────────────────────────

export const CreateTimelineTaskSchema = z.object({
  event_id: z.string().uuid(),
  section: SectionTypeSchema,
  phase: TaskPhaseSchema,
  title: z.string().min(2, "Judul task minimal 2 karakter").max(300),
  description: z.string().max(2000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: TaskStatusSchema.default("TODO"),
  is_auto_brief_init: z.boolean().optional(),
});

export const UpdateTimelineTaskSchema = CreateTimelineTaskSchema.partial().extend({
  id: z.string().uuid(),
  escalation_notes: z.string().max(2000).nullable().optional(),
  pic_change_reason: z.string().trim().max(1000).nullable().optional(),
});

// ─── Roster Schema ─────────────────────────────────────────────────────────────

export const AssignRosterSchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
  section: SectionTypeSchema,
  role_in_event: EventRoleSchema,
  is_co_controller: z.boolean().default(false),
});

// ─── Section Module Schemas ────────────────────────────────────────────────────

export const CreateToolInventorySchema = z.object({
  event_id: z.string().uuid(),
  tool_name: z.string().min(2).max(300),
  quantity: z.number().int().min(1),
  source: z.enum(["IN_HOUSE", "RENTAL", "PURCHASE"]),
  pic_user_id: z.string().uuid().nullable().optional(),
  is_ready: z.boolean().default(false),
  notes: z.string().max(1000).nullable().optional(),
});

export const CreateBudgetItemSchema = z.object({
  event_id: z.string().uuid(),
  section: SectionTypeSchema,
  budget_category: z.string().max(120).optional().default("Dekorasi"),
  item_name: z.string().trim().min(2, "Nama item minimal 2 karakter").max(2000),
  required_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  quantity: z.number().finite().positive("Kuantitas harus lebih dari 0").max(1000000).default(1),
  uom: z.string().min(1).max(40).default("Set"),
  unit_price: z.number().finite().min(0).max(10000000000).default(0),
  estimated_amount: z.number().finite().min(0).max(100000000000).optional(),
  actual_amount: z.number().finite().min(0).max(100000000000).default(0),
  budget_status: z.enum(["Planning", "Approved", "Paid"]).optional().default("Planning"),
  receipt_photo_url: SafeHttpUrlSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateBudgetItemSchema = CreateBudgetItemSchema.partial().extend({
  id: z.string().min(1),
});

export const CommitteeMemberRowSchema = z.object({
  id: z.string().optional(),
  order_index: z.number().int().min(0).default(0),
  position_name: z.string().trim().min(1, "Nama jabatan wajib diisi").max(200),
  pic_user_id: z.string().uuid().nullable().optional(),
  pic_name: z.string().trim().max(200).default(""),
  contact_notes: z.string().max(500).nullable().optional(),
});

export const MinisterRowSchema = z.object({
  id: z.string().optional(),
  order_index: z.number().int().min(0).default(0),
  ministry_role: z.string().trim().min(1, "Posisi / Tim pelayanan wajib diisi").max(200),
  minister_names: z.string().trim().max(500).default(""),
  notes: z.string().max(500).nullable().optional(),
});

export const BriefSectionScopeSchema = z.enum([
  "FULL",
  "OVERVIEW",
  "ACARA",
  "DEKORASI",
  "PERLENGKAPAN",
  "PDD",
  "BUDGET",
  "SEKRETARIAT",
  "RUNDOWN",
  "TECHNICAL",
  "APPROVAL",
]);

export const SaveDocumentSchema = z.object({
  document_data: z.record(z.unknown()),
  org_chart_url: SafeHttpUrlSchema,
  section_scope: BriefSectionScopeSchema.optional(),
});

export function validateDocumentUrls(docData: Record<string, unknown>): string | null {
  for (const field of ["decorImageUrl", "orgChartUrl"] as const) {
    if (field in docData && docData[field] !== undefined && docData[field] !== null && docData[field] !== "") {
      const res = SafeHttpUrlSchema.safeParse(docData[field]);
      if (!res.success) {
        return res.error.issues[0]?.message || `URL ${field} tidak valid`;
      }
    }
  }
  return null;
}

export const CreateShotlistSchema = z.object({
  event_id: z.string().uuid(),
  scene_title: z.string().min(2).max(300),
  shot_type: z.enum(["PHOTO", "VIDEO", "REEL"]),
  camera_angle: z.string().max(500).nullable().optional(),
  pic_user_id: z.string().uuid().nullable().optional(),
  status: z.enum(["PENDING", "TAKEN", "EDITED"]).default("PENDING"),
  drive_link: SafeHttpUrlSchema,
});

export const CreateTechnicalGuideSchema = z.object({
  event_id: z.string().uuid(),
  category: z.string().min(2).max(100),
  title: z.string().min(2).max(300),
  instructions_markdown: z.string().min(1).max(5000),
  layout_image_url: SafeHttpUrlSchema,
  target_sections: z.array(SectionTypeSchema).min(1),
});

export const CreateMeetingNoteSchema = z.object({
  event_id: z.string().uuid(),
  meeting_type: z.enum([
    "PRE_EVENT_COORDINATION",
    "TECHNICAL_MEETING",
    "POST_EVALUATION",
  ]),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes_content: z.string().min(1, "Notulensi wajib diisi").max(10000),
  recorded_by: z.string().uuid(),
});

// ─── Change Queue Schema (Live reorder) ────────────────────────────────────────

export const ChangeQueueSchema = z.object({
  event_id: z.string().uuid(),
  moved_item_id: z.string().uuid(),
  new_order_index: z.number().int().min(0),
  reason: z.string().min(1, "Alasan wajib diisi").max(500),
  changed_by: z.string().uuid(),
});

// ─── Insert On-The-Fly Segment Schema ──────────────────────────────────────────

export const InsertLiveSegmentSchema = z.object({
  rundown_id: z.string().uuid(),
  event_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  estimated_duration_minutes: z.number().int().min(1).max(120),
  section_pic: SectionTypeSchema.default("ACARA"),
  technical_notes: z.string().max(2000).nullable().optional(),
  inserted_by: z.string().uuid(),
});
