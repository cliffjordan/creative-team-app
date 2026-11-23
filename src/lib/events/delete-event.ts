import { createServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import type { EventStatus } from "@/types/domain";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHILD_TABLES_IN_DELETE_ORDER = [
  "notifications",
  "pdd_references",
  "section_decor_items",
  "section_pdd_shotlist",
  "section_tools_inventory",
  "event_meeting_notes",
  "event_documents",
  "event_ministers_structure",
  "event_committee_structure",
  "event_budget_ledger",
  "event_technical_guides",
  "timeline_tasks",
  "live_logs",
  "rundowns",
  "event_roster",
] as const;

export type DeleteEventResult =
  | {
      success: true;
      deletedEvent: {
        id: string;
        title: string;
        status: EventStatus;
      };
    }
  | {
      success: false;
      status: 400 | 401 | 403 | 404 | 500;
      error: string;
    };

export function validateEventDeletionStatus(
  status: EventStatus,
  rawReason?: string
): { valid: true; reason: string } | { valid: false; status: 400 | 403; error: string } {
  const trimmedReason = typeof rawReason === "string" ? rawReason.trim() : "";

  if (status === "EVENT_DAY" || status === "POST_EVENT" || status === "COMPLETED") {
    return {
      valid: false,
      status: 403,
      error: `Event berstatus ${status} sudah terkunci dan tidak dapat dihapus demi menjaga integritas laporan & arsip.`,
    };
  }

  if (status === "PRE_EVENT" && trimmedReason.length < 5) {
    return {
      valid: false,
      status: 400,
      error:
        "Penghapusan event berstatus PRE_EVENT wajib menyertakan alasan minimal 5 karakter.",
    };
  }

  if (trimmedReason.length > 1000) {
    return {
      valid: false,
      status: 400,
      error: "Alasan penghapusan maksimal 1000 karakter.",
    };
  }

  return { valid: true, reason: trimmedReason };
}

export async function executeSupabaseEventDeletion(
  eventId: string,
  rawReason?: string
): Promise<DeleteEventResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      status: 401,
      error: "Sesi login tidak valid. Silakan masuk terlebih dahulu.",
    };
  }

  if (!UUID_REGEX.test(eventId)) {
    return {
      success: false,
      status: 400,
      error: "ID event tidak valid.",
    };
  }

  const supabase = createServerClient();

  const { data: actor, error: actorError } = await supabase
    .from("users")
    .select("id, full_name, base_role, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();

  if (actorError || !actor) {
    return {
      success: false,
      status: 401,
      error: "Akun pengguna tidak ditemukan.",
    };
  }

  if (actor.base_role !== "CREATIVE_LEADER" && !actor.is_superadmin) {
    return {
      success: false,
      status: 403,
      error: "Hanya Creative Leader atau Superadmin yang berhak menghapus event.",
    };
  }

  const { data: existingEvent, error: eventLookupError } = await supabase
    .from("events")
    .select("id, title, status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventLookupError) {
    return {
      success: false,
      status: 500,
      error: eventLookupError.message,
    };
  }

  if (!existingEvent) {
    return {
      success: false,
      status: 404,
      error: "Event tidak ditemukan atau sudah dihapus.",
    };
  }

  const eventStatus = existingEvent.status as EventStatus;
  const validation = validateEventDeletionStatus(eventStatus, rawReason);
  if (!validation.valid) {
    return {
      success: false,
      status: validation.status,
      error: validation.error,
    };
  }

  const { error: auditError } = await supabase.from("operation_records").insert({
    operation_id: crypto.randomUUID(),
    event_id: null,
    action_type: "EVENT_DELETED",
    actor_id: actor.id,
    details: {
      deleted_event_id: existingEvent.id,
      event_title: existingEvent.title,
      event_status: eventStatus,
      reason:
        validation.reason ||
        (eventStatus === "DRAFT" ? "Dihapus saat berstatus Draft" : ""),
      actor_name: actor.full_name,
      deleted_at: new Date().toISOString(),
    },
  });

  if (auditError) {
    console.error("[delete-event] Gagal mencatat operation_records:", auditError.message);
    if (eventStatus === "PRE_EVENT") {
      return {
        success: false,
        status: 500,
        error:
          "Gagal mencatat alasan penghapusan ke audit log. Pastikan migration_v4.sql sudah dijalankan.",
      };
    }
  }

  // Lepaskan referensi circular current_item_id sebelum cascade child tables
  const { error: unlinkError } = await supabase
    .from("events")
    .update({ current_item_id: null })
    .eq("id", existingEvent.id);

  if (unlinkError) {
    return {
      success: false,
      status: 500,
      error: `Gagal melepas pointer rundown aktif: ${unlinkError.message}`,
    };
  }

  for (const tableName of CHILD_TABLES_IN_DELETE_ORDER) {
    const { error: childError } = await supabase
      .from(tableName)
      .delete()
      .eq("event_id", existingEvent.id);

    if (childError) {
      return {
        success: false,
        status: 500,
        error: `Gagal membersihkan data ${tableName}: ${childError.message}`,
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", existingEvent.id);

  if (deleteError) {
    return {
      success: false,
      status: 500,
      error: `Gagal menghapus event utama: ${deleteError.message}`,
    };
  }

  return {
    success: true,
    deletedEvent: {
      id: existingEvent.id,
      title: existingEvent.title,
      status: eventStatus,
    },
  };
}
