"use client";

import React, { useState, useEffect } from "react";
import { INITIAL_EVENT, getNotesAccessMode, isCreativeLeader } from "@/lib/mock-db";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { Event, EventMeetingNote, User } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  FileText,
  Plus,
  Calendar,
  User as UserIcon,
  Trash2,
  Eye,
  Lock,
} from "lucide-react";

type MeetingType = "PRE_EVENT_COORDINATION" | "TECHNICAL_MEETING" | "POST_EVALUATION";

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  PRE_EVENT_COORDINATION: "Koordinasi Pra-Acara",
  TECHNICAL_MEETING: "Technical Meeting",
  POST_EVALUATION: "Evaluasi Pasca-Acara",
};

const STORAGE_KEY = "CT_MEETING_NOTES";

const INITIAL_NOTES: EventMeetingNote[] = [];

interface MeetingNotesViewProps {
  users: User[];
  currentUser: User | null;
  activeEvent?: Event;
  readOnly?: boolean;
}

export function MeetingNotesView({
  users,
  currentUser,
  activeEvent = INITIAL_EVENT,
  readOnly = false,
}: MeetingNotesViewProps) {
  const accessMode = getNotesAccessMode(currentUser);
  const effectiveReadOnly = readOnly || (accessMode !== "EDIT" && !isCreativeLeader(currentUser));

  const [notes, setNotes] = useState<EventMeetingNote[]>(() => {
    if (typeof window === "undefined") return INITIAL_NOTES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed as EventMeetingNote[];
        }
      }
    } catch {
      // Fallback to initial notes
    }
    return INITIAL_NOTES;
  });

  const [filterType, setFilterType] = useState<"ALL" | MeetingType>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [meetingType, setMeetingType] = useState<MeetingType>("PRE_EVENT_COORDINATION");
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notesContent, setNotesContent] = useState("");
  const [recordedBy, setRecordedBy] = useState(currentUser?.full_name || "Sekretaris");

  useEffect(() => {
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/secretariat`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.success || !Array.isArray(data.notes)) return;
          const remoteNotes = data.notes as EventMeetingNote[];
          setNotes((prev) => {
            const others = prev.filter((n) => n.event_id !== activeEvent.id);
            const merged = [...remoteNotes, ...others];
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              publishSyncMessage(STORAGE_KEY, merged);
            } catch {}
            return merged;
          });
        })
        .catch(() => {});
    }

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === STORAGE_KEY && Array.isArray(msg.payload)) {
        setNotes(msg.payload as EventMeetingNote[]);
      }
    });
    return () => unsubscribe();
  }, [activeEvent.id]);

  const persistNotes = (next: EventMeetingNote[]) => {
    setNotes(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      publishSyncMessage(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const eventNotes = notes.filter(
    (n) => (n.event_id || INITIAL_EVENT.id) === activeEvent.id
  );

  const filteredNotes =
    filterType === "ALL"
      ? eventNotes
      : eventNotes.filter((n) => n.meeting_type === filterType);

  const handleAddNote = async () => {
    if (effectiveReadOnly || !notesContent.trim()) return;
    let savedNote: EventMeetingNote = {
      id: `mn-${Date.now()}`,
      event_id: activeEvent.id,
      meeting_type: meetingType,
      meeting_date: meetingDate,
      notes_content: notesContent.trim(),
      recorded_by: currentUser?.id || recordedBy.trim() || "Sekretaris",
      created_at: new Date().toISOString(),
    };

    if (activeEvent.id) {
      try {
        const res = await fetch(`/api/events/${activeEvent.id}/secretariat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "note",
            meeting_type: meetingType,
            meeting_date: meetingDate,
            notes_content: notesContent.trim(),
          }),
        });
        const data = await res.json();
        if (res.ok && data?.note) {
          savedNote = data.note as EventMeetingNote;
        }
      } catch {}
    }

    persistNotes([savedNote, ...notes]);
    setNotesContent("");
    setIsModalOpen(false);
  };

  const handleDeleteNote = (id: string) => {
    if (effectiveReadOnly) return;
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/secretariat?kind=note&itemId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    persistNotes(notes.filter((n) => n.id !== id));
  };

  if (accessMode === "LOCKED") {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Notulensi Dibatasi</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Notulensi Rapat hanya dapat dilihat oleh Ketua, Wakil, Bendahara, Section Leader, dan dikelola oleh Sekretaris.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-10 animate-fade-in">
      {accessMode === "MONITOR" && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2.5 text-xs text-indigo-800">
          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Mode Monitoring (Read-Only):</strong> Anda melihat notulensi rapat sebagai pimpinan/section leader. Penambahan dan perubahan notulensi hanya dapat dilakukan oleh <strong>Sekretaris</strong>.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Notulensi Rapat Sekretaris</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catatan koordinasi, technical meeting &amp; evaluasi untuk{" "}
            <strong className="text-slate-700">{activeEvent.title}</strong>
          </p>
        </div>

        {!effectiveReadOnly && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat</span>
          </Button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["ALL", "PRE_EVENT_COORDINATION", "TECHNICAL_MEETING", "POST_EVALUATION"] as const).map(
          (type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                filterType === type
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {type === "ALL" ? "Semua" : MEETING_TYPE_LABELS[type]}
            </button>
          )
        )}
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <Card className="p-6 text-center text-xs text-slate-400">
            Belum ada notulensi untuk kategori ini.
          </Card>
        ) : (
          filteredNotes.map((note) => {
            const recorderUser = users.find(
              (u) => u.id === note.recorded_by || u.full_name === note.recorded_by
            );
            const badgeVariant =
              note.meeting_type === "PRE_EVENT_COORDINATION"
                ? "purple"
                : note.meeting_type === "TECHNICAL_MEETING"
                ? "cyan"
                : "emerald";

            return (
              <Card key={note.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={badgeVariant} className="text-[10px]">
                      {MEETING_TYPE_LABELS[note.meeting_type as MeetingType] || note.meeting_type}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {note.meeting_date}
                    </span>
                  </div>

                  {!effectiveReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                      title="Hapus notulensi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {note.notes_content || (note as unknown as { content?: string }).content || ""}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dicatat oleh: {recorderUser?.full_name || note.recorded_by}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Note Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Notulensi Rapat"
        description="Catat hasil rapat koordinasi, technical meeting, atau evaluasi."
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Jenis Rapat
            </label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value as MeetingType)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="PRE_EVENT_COORDINATION">Koordinasi Pra-Acara</option>
              <option value="TECHNICAL_MEETING">Technical Meeting</option>
              <option value="POST_EVALUATION">Evaluasi Pasca-Acara</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tanggal Rapat
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Notulis
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                placeholder="Nama Sekretaris"
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Isi Notulensi
            </label>
            <textarea
              rows={4}
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="Tuliskan poin keputusan, pembagian tugas, atau catatan penting..."
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddNote}>
              Simpan Notulensi
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
