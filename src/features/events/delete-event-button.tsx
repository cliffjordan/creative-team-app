"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/providers/auth-provider";
import { isCreativeLeader } from "@/lib/mock-db";
import { publishSyncMessage } from "@/lib/sync/realtime-bus";
import type { Event, EventRosterMember, EventStatus, LiveLog, RundownItem, TimelineTask } from "@/types/domain";

interface DeleteEventButtonProps {
  eventId: string;
  eventTitle: string;
  status: EventStatus;
  redirectOnDelete?: string;
  onDeleted?: (eventId: string) => void;
  compact?: boolean;
}

function cleanupDeletedEventLocalCache(eventId: string) {
  if (typeof window === "undefined") return;

  const perEventKeys = [
    `CT_EVENT_BRIEF_V2_${eventId}`,
    `CT_SECRETARIAT_COMMITTEE_${eventId}`,
    `CT_SECRETARIAT_MINISTERS_${eventId}`,
  ];
  for (const key of perEventKeys) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  let nextEvents: Event[] = [];
  try {
    const rawEvents = localStorage.getItem("CT_EVENTS");
    if (rawEvents) {
      const parsed = JSON.parse(rawEvents) as Event[];
      nextEvents = parsed.filter((ev) => ev.id !== eventId);
      localStorage.setItem("CT_EVENTS", JSON.stringify(nextEvents));
      publishSyncMessage("CT_EVENTS", nextEvents);
    }
  } catch {}

  try {
    const rawActiveEvent = localStorage.getItem("CT_EVENT");
    if (rawActiveEvent) {
      const activeEv = JSON.parse(rawActiveEvent) as Event;
      if (activeEv.id === eventId) {
        if (nextEvents.length > 0) {
          localStorage.setItem("CT_EVENT", JSON.stringify(nextEvents[0]));
          publishSyncMessage("CT_EVENT", nextEvents[0]);
        } else {
          localStorage.removeItem("CT_EVENT");
        }
      }
    }
  } catch {}

  try {
    const rawRoster = localStorage.getItem("CT_ROSTER");
    if (rawRoster) {
      const nextRoster = (JSON.parse(rawRoster) as EventRosterMember[]).filter(
        (r) => r.event_id !== eventId
      );
      localStorage.setItem("CT_ROSTER", JSON.stringify(nextRoster));
      publishSyncMessage("CT_ROSTER", nextRoster);
    }
  } catch {}

  try {
    const rawTasks = localStorage.getItem("CT_TASKS");
    if (rawTasks) {
      const nextTasks = (JSON.parse(rawTasks) as TimelineTask[]).filter(
        (t) => t.event_id !== eventId
      );
      localStorage.setItem("CT_TASKS", JSON.stringify(nextTasks));
      publishSyncMessage("CT_TASKS", nextTasks);
    }
  } catch {}

  try {
    const rawItems = localStorage.getItem("CT_ITEMS");
    if (rawItems) {
      const nextItems = (JSON.parse(rawItems) as RundownItem[]).filter(
        (item) => item.event_id !== eventId
      );
      localStorage.setItem("CT_ITEMS", JSON.stringify(nextItems));
      publishSyncMessage("CT_ITEMS", nextItems);
    }
  } catch {}

  try {
    const rawLogs = localStorage.getItem("CT_LOGS");
    if (rawLogs) {
      const nextLogs = (JSON.parse(rawLogs) as LiveLog[]).filter(
        (log) => log.event_id !== eventId
      );
      localStorage.setItem("CT_LOGS", JSON.stringify(nextLogs));
      publishSyncMessage("CT_LOGS", nextLogs);
    }
  } catch {}
}

export function DeleteEventButton({
  eventId,
  eventTitle,
  status,
  redirectOnDelete,
  onDeleted,
  compact = false,
}: DeleteEventButtonProps) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCreativeLeader(currentUser)) {
    return null;
  }

  const isLocked =
    status === "EVENT_DAY" || status === "POST_EVENT" || status === "COMPLETED";
  const requiresReason = status === "PRE_EVENT";

  if (isLocked) {
    return (
      <span
        title={`Event berstatus ${status} terkunci dan tidak dapat dihapus demi integritas data.`}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
            : "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 cursor-not-allowed select-none"
        }
      >
        <Lock className={compact ? "h-3 w-3 text-slate-400" : "h-3.5 w-3.5 text-slate-400"} />
        {compact ? "Terkunci" : "Event Terkunci"}
      </span>
    );
  }

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = reason.trim();
    if (requiresReason && trimmed.length < 5) {
      setError(
        "Event berstatus PRE_EVENT wajib menyertakan alasan penghapusan minimal 5 karakter."
      );
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "Gagal menghapus event.");
        setIsDeleting(false);
        return;
      }

      cleanupDeletedEventLocalCache(eventId);
      setIsOpen(false);
      onDeleted?.(eventId);
      router.refresh();
      if (redirectOnDelete) {
        router.push(redirectOnDelete);
      }
    } catch {
      setError("Koneksi bermasalah saat menghapus event. Silakan coba lagi.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setReason("");
          setError(null);
          setIsOpen(true);
        }}
        className={
          compact
            ? "h-8 px-2.5 text-xs gap-1 border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
            : "gap-1.5 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300"
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>{compact ? "Hapus" : "Hapus Event"}</span>
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!isDeleting) setIsOpen(false);
        }}
        title={requiresReason ? "Hapus Event (Pre-Event)" : "Hapus Draft Event"}
        description={eventTitle}
      >
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Tindakan Permanen (Cascade Delete)</p>
              <p className="text-rose-800 leading-relaxed">
                {requiresReason ? (
                  <>
                    Event sedang dalam tahap persiapan (<strong>PRE_EVENT</strong>). Seluruh roster, task, rundown, budget, notulensi, dan dokumen event akan dihapus permanen. Alasan Anda akan disimpan di System Audit Log.
                  </>
                ) : (
                  <>
                    Event masih berstatus <strong>DRAFT</strong>. Seluruh data awal beserta roster dan task-nya akan dihapus permanen.
                  </>
                )}
              </p>
            </div>
          </div>

          {requiresReason ? (
            <div className="space-y-1.5">
              <label
                htmlFor={`delete-reason-${eventId}`}
                className="block text-xs font-semibold text-slate-700"
              >
                Alasan Penghapusan <span className="text-rose-600">*</span>
              </label>
              <textarea
                id={`delete-reason-${eventId}`}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Jadwal acara dibatalkan / digabung ke event minggu depan..."
                maxLength={1000}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <p className="text-[11px] text-slate-500">
                Minimal 5 karakter ({reason.trim().length}/5). Dicatat di audit log Superadmin.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor={`delete-reason-${eventId}`}
                className="block text-xs font-semibold text-slate-700"
              >
                Catatan / Alasan (Opsional)
              </label>
              <input
                id={`delete-reason-${eventId}`}
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Opsional: alasan penghapusan draft"
                maxLength={1000}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setIsOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isDeleting || (requiresReason && reason.trim().length < 5)}
              className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeleting ? "Menghapus..." : "Ya, Hapus Permanen"}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
