// Domain Enums
export type UserBaseRole =
  | 'CREATIVE_LEADER'
  | 'WAKIL_LEADER'
  | 'SEKRETARIS'
  | 'BENDAHARA'
  | 'SECTION_LEADER'
  | 'MEMBER';

export type EventStatus =
  | 'DRAFT'
  | 'PRE_EVENT'
  | 'EVENT_DAY'
  | 'POST_EVENT'
  | 'COMPLETED';

export type SectionType =
  | 'ACARA'
  | 'DEKORASI'
  | 'PERLENGKAPAN'
  | 'PDD'
  | 'INTI'
  | 'ALL';

export type EventRole =
  | 'EVENT_LEADER'
  | 'CO_CONTROLLER'
  | 'SECTION_LEADER'
  | 'MEMBER';

export type RundownItemStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'FINISHED'
  | 'SKIPPED';

export type LogType =
  | 'OVERTIME'
  | 'EARLYEND'
  | 'CHANGEQUEUE'
  | 'INCIDENT'
  | 'PAUSE'
  | 'RESUME';

export type LogSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type LogStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';

export type TaskPhase = 'PRE_EVENT' | 'EVENT_DAY' | 'POST_EVENT';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'ESCALATED' | 'DONE';

// Domain Entities
export interface User {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  is_superadmin: boolean;
  base_role: UserBaseRole;
  default_section?: SectionType | null;
  is_role_assigned?: boolean;
  avatar_url?: string;
  failed_pin_attempts: number;
  locked_until?: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  theme: string;
  event_date: string;
  status: EventStatus;
  live_started_at?: string | null;
  live_ended_at?: string | null;
  live_paused_at?: string | null;
  total_pause_seconds: number;
  segment_pause_seconds?: number;
  current_item_id?: string | null;
  current_item_started_at?: string | null;
  time_tolerance_seconds: number; // default 60s
  event_leader_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventRosterMember {
  id: string;
  event_id: string;
  user_id: string;
  section: SectionType;
  role_in_event: EventRole;
  is_co_controller: boolean;
  user?: User;
}

export interface Rundown {
  id: string;
  event_id: string;
  name: string;
  is_template: boolean;
  template_category?: string | null;
  items?: RundownItem[];
  created_at: string;
}

export interface RundownItem {
  id: string;
  event_id?: string;
  rundown_id: string;
  order_index: number;
  title: string;
  section_pic: SectionType;
  pic_user_id?: string | null;
  planned_start_time?: string | null;
  estimated_duration_minutes: number;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  status: RundownItemStatus;
  technical_notes?: string | null;
  cue_props?: string | null;
  pic_user?: User;
}

export interface LiveLog {
  id: string;
  event_id: string;
  rundown_item_id?: string | null;
  log_type: LogType;
  delta_seconds?: number | null;
  reported_by: string;
  reporter?: User;
  description: string;
  photo_url?: string | null;
  severity: LogSeverity;
  status: LogStatus;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  previous_queue?: Array<{ id: string; order_index: number; title: string }> | null;
  new_queue?: Array<{ id: string; order_index: number; title: string }> | null;
  operation_id?: string | null;
  created_at: string;
}

export interface TaskPicHistoryEntry {
  from_user_id: string | null;
  to_user_id: string | null;
  changed_by: string;
  reason: string;
  changed_at: string;
}

export interface TechnicalExecutionSection {
  id: string;
  title: string;
  items: string[];
}

export interface OperationRecord {
  operation_id: string;
  event_id?: string | null;
  action_type: string;
  actor_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
  actor?: Pick<User, 'id' | 'full_name' | 'base_role'> | null;
}

export interface TimelineTask {
  id: string;
  event_id: string;
  section: SectionType;
  phase: TaskPhase;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  assignee?: User;
  due_date?: string | null;
  status: TaskStatus;
  escalation_notes?: string | null;
  escalated_by?: string | null;
  escalated_at?: string | null;
  escalation_recipient_id?: string | null;
  escalation_resolution?: string | null;
  escalation_resolved_at?: string | null;
  pic_change_reason?: string | null;
  pic_history?: TaskPicHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface EventTechnicalGuide {
  id: string;
  event_id: string;
  category: 'CANDLE_LIGHT' | 'SEATING_ORTU' | 'CLASS_PERFORMANCE_GATE' | 'TATA_TERTIB' | string;
  title: string;
  instructions_markdown: string;
  layout_image_url?: string | null;
  target_sections: SectionType[];
  created_at: string;
}

export interface EventBudgetLedgerItem {
  id: string;
  event_id: string;
  section: SectionType;
  budget_category?: string;
  item_name: string;
  required_date?: string | null;
  quantity?: number;
  uom?: string;
  unit_price?: number;
  estimated_amount: number;
  actual_amount: number;
  budget_status?: "Planning" | "Approved" | "Paid" | string;
  receipt_photo_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface EventCommitteeMember {
  id: string;
  event_id: string;
  order_index: number;
  position_name: string;
  pic_user_id?: string | null;
  pic_name: string;
  contact_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventMinisterRow {
  id: string;
  event_id: string;
  order_index: number;
  ministry_role: string;
  minister_names: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventProjectBriefDocument {
  id: string;
  event_id: string;
  document_data: Record<string, unknown>;
  org_chart_url?: string | null;
  created_by: string;
  updated_by?: string | null;
  tasks_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventMeetingNote {
  id: string;
  event_id: string;
  meeting_type: 'PRE_EVENT_COORDINATION' | 'TECHNICAL_MEETING' | 'POST_EVALUATION' | string;
  meeting_date: string;
  notes_content: string;
  recorded_by: string;
  recorder?: User;
  created_at: string;
}

export interface SectionToolInventory {
  id: string;
  event_id: string;
  tool_name: string;
  quantity: number;
  source: 'IN_HOUSE' | 'RENTAL' | 'PURCHASE';
  pic_user_id?: string | null;
  pic_user?: User;
  is_ready: boolean;
  notes?: string | null;
}

export interface SectionPddShotlist {
  id: string;
  event_id: string;
  scene_title: string;
  shot_type: 'PHOTO' | 'VIDEO' | 'REEL';
  camera_angle?: string | null;
  pic_user_id?: string | null;
  pic_user?: User;
  status: 'PENDING' | 'TAKEN' | 'EDITED';
  drive_link?: string | null;
}

export type DecorInstallationStatus = 'PLANNING' | 'IN_PROGRESS' | 'READY' | 'INSTALLED';

export interface SectionDecorItem {
  id: string;
  event_id: string;
  item_name: string;
  estimated_cost: number;
  actual_cost: number;
  installation_status: DecorInstallationStatus;
  pic_user_id?: string | null;
  pic_user?: User;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PddDriveReference {
  id: string;
  event_id: string;
  phase: TaskPhase;
  title: string;
  url: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  event_id?: string | null;
  type: 'TASK_ASSIGNED' | 'TASK_ESCALATED' | 'INCIDENT_REPORTED' | 'QUEUE_CHANGED' | 'EVENT_STATUS';
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
}
