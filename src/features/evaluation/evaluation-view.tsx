"use client";

import React, { useState, useEffect } from "react";
import { Event, LiveLog, User, EventMeetingNote } from "@/types/domain";
import { INITIAL_EVENT, getNotesAccessMode } from "@/lib/mock-db";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatSecondsToMMSS, triggerHaptic } from "@/lib/utils";
import {
  ClipboardCheck,
  CheckCircle,
  FileText,
  Printer,
  Edit3,
  Check,
  AlertOctagon,
  ArrowRight,
} from "lucide-react";

interface EvaluationViewProps {
  event: Event;
  events?: Event[];
  logs: LiveLog[];
  users: User[];
  currentUser: User | null;
  onUpdateLog: (logId: string, updated: Partial<LiveLog>) => void;
  onUpdateEvent?: (updated: Partial<Event>) => void;
  onSelectEvent?: (eventId: string) => void;
}

export function EvaluationView({
  event,
  events,
  logs,
  users,
  currentUser,
  onUpdateLog,
  onUpdateEvent,
  onSelectEvent,
}: EvaluationViewProps) {
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
  const [selectedLog, setSelectedLog] = useState<LiveLog | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [inlineRemarks, setInlineRemarks] = useState<Record<string, string>>({});
  const [isLpjPreviewOpen, setIsLpjPreviewOpen] = useState(false);
  const [eventStatusFilter, setEventStatusFilter] = useState<"ALL" | "POST_EVENT" | "COMPLETED">("ALL");
  const [localEventStatus, setLocalEventStatus] = useState<Event["status"]>(event.status);

  // Sekretaris Post-Evaluation Meeting Notes (CT_MEETING_NOTES)
  const [meetingNotes, setMeetingNotes] = useState<EventMeetingNote[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  useEffect(() => {
    setLocalEventStatus(event.status);
  }, [event.status]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("CT_MEETING_NOTES");
      if (saved) {
        const parsed = JSON.parse(saved) as EventMeetingNote[];
        if (Array.isArray(parsed)) setMeetingNotes(parsed);
      }
    } catch {
      // Ignore localStorage errors
    }

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_MEETING_NOTES" && Array.isArray(msg.payload)) {
        setMeetingNotes(msg.payload as EventMeetingNote[]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Editable LPJ Fields
  const [lpjSummary, setLpjSummary] = useState(
    "Puji Tuhan, seluruh rangkaian Perayaan Natal 2026 telah terlaksana dengan baik dan dihadiri lebih dari 500 jemaat. Terjadi sedikit kendala teknis audio dan overtime pada sesi firman, namun berhasil dimitigasi secara terkoordinasi."
  );
  const [lpjRecommendation, setLpjRecommendation] = useState(
    "1. Perlunya gladi resik sound system 2 jam sebelum open gate.\n2. Pembatasan durasi khotbah dan cue monitor yang lebih jelas untuk pembicara."
  );

  const openLogs = logs.filter((l) => l.status === "OPEN");
  const closedLogs = logs.filter((l) => l.status === "CLOSED" || l.status === "RESOLVED");

  const filteredLogs = logs.filter((l) => {
    if (filter === "OPEN") return l.status === "OPEN";
    if (filter === "CLOSED") return l.status === "CLOSED" || l.status === "RESOLVED";
    return true;
  });

  // Calculate variances
  const overtimeLogs = logs.filter((l) => l.log_type === "OVERTIME");
  const earlyEndLogs = logs.filter((l) => l.log_type === "EARLYEND");
  const incidentLogs = logs.filter((l) => l.log_type === "INCIDENT");
  const queueChangeLogs = logs.filter((l) => l.log_type === "CHANGEQUEUE");

  const totalOvertimeSecs = overtimeLogs.reduce((acc, l) => acc + (l.delta_seconds || 0), 0);
  const totalEarlySecs = earlyEndLogs.reduce((acc, l) => acc + Math.abs(l.delta_seconds || 0), 0);

  const handleOpenResolve = (log: LiveLog) => {
    setSelectedLog(log);
    setResolutionNotes(inlineRemarks[log.id] ?? log.resolution_notes ?? "");
  };

  const handleSaveResolution = (markClosed: boolean) => {
    if (!selectedLog) return;
    if (markClosed) {
      triggerHaptic([40, 30, 40]);
    } else {
      triggerHaptic(40);
    }
    onUpdateLog(selectedLog.id, {
      resolution_notes: resolutionNotes,
      status: markClosed ? "CLOSED" : "RESOLVED",
      resolved_by: currentUser?.id,
      resolved_at: new Date().toISOString(),
    });
    if (markClosed) {
      const remainingOpen = logs.filter((l) => l.id !== selectedLog.id && l.status === "OPEN").length;
      if (remainingOpen === 0) {
        setLocalEventStatus("COMPLETED");
        onUpdateEvent?.({ status: "COMPLETED" });
      }
    }
    setSelectedLog(null);
  };

  const handleInlineMarkClosed = (log: LiveLog) => {
    const remark = (inlineRemarks[log.id] ?? log.resolution_notes ?? "").trim();
    triggerHaptic([40, 30, 40]);
    onUpdateLog(log.id, {
      resolution_notes: remark || "Ditandai selesai saat evaluasi tim.",
      status: "CLOSED",
      resolved_by: currentUser?.id,
      resolved_at: new Date().toISOString(),
    });
    const remainingOpen = logs.filter((l) => l.id !== log.id && l.status === "OPEN").length;
    if (remainingOpen === 0) {
      setLocalEventStatus("COMPLETED");
      onUpdateEvent?.({ status: "COMPLETED" });
    }
  };

  const handleMarkEventCompleted = () => {
    triggerHaptic([50, 40, 80]);
    setLocalEventStatus("COMPLETED");
    onUpdateEvent?.({ status: "COMPLETED" });
  };

  const handleAddPostEvalNote = () => {
    if (getNotesAccessMode(currentUser) !== "EDIT") return;
    if (!noteTitle.trim() || !noteContent.trim()) return;
    const newNote: EventMeetingNote = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
      event_id: event.id,
      meeting_date: new Date().toISOString().slice(0, 10),
      meeting_type: "POST_EVALUATION",
      notes_content: noteTitle.trim() ? `${noteTitle.trim()}\n${noteContent.trim()}` : noteContent.trim(),
      recorded_by: currentUser?.id || event.event_leader_id,
      created_at: new Date().toISOString(),
    };
    const updated = [newNote, ...meetingNotes];
    setMeetingNotes(updated);
    try {
      localStorage.setItem("CT_MEETING_NOTES", JSON.stringify(updated));
      publishSyncMessage("CT_MEETING_NOTES", updated);
    } catch {
      // Ignore localStorage errors
    }
    triggerHaptic(40);
    setNoteTitle("");
    setNoteContent("");
    setIsNoteModalOpen(false);
  };

  const postEvalNotes = meetingNotes.filter(
    (n) => n.meeting_type === "POST_EVALUATION" && (n.event_id || INITIAL_EVENT.id) === event.id
  );

  const availableEvents = (events && events.length > 0 ? events : [event]).filter((ev) => {
    if (eventStatusFilter === "ALL") {
      return ev.status === "POST_EVENT" || ev.status === "COMPLETED" || ev.id === event.id;
    }
    return ev.status === eventStatusFilter;
  });

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Multi-Event Filter & Action Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(["ALL", "POST_EVENT", "COMPLETED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setEventStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  eventStatusFilter === st
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
          <Badge variant={localEventStatus === "COMPLETED" ? "emerald" : "amber"} className="text-[11px]">
            {localEventStatus}
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {availableEvents.length > 1 && onSelectEvent && (
            <select
              value={event.id}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              {availableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.status})
                </option>
              ))}
            </select>
          )}
          {openLogs.length === 0 && localEventStatus !== "COMPLETED" && (
            <Button
              size="sm"
              variant="emerald"
              onClick={handleMarkEventCompleted}
              className="text-xs font-bold gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tandai Event COMPLETED</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Header Evaluation Summary */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              <span>Evaluasi Pasca-Acara</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{event.title}</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsLpjPreviewOpen(true)}
            className="text-xs font-bold gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Format LPJ</span>
          </Button>
        </div>

        {/* Metric Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-100 text-center">
            <div className="text-[10px] text-orange-700 font-bold uppercase tracking-wider">Insiden</div>
            <div className="text-xl font-black text-orange-600 mt-0.5">{incidentLogs.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 text-center">
            <div className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Overtime</div>
            <div className="text-xl font-black text-rose-600 mt-0.5">{overtimeLogs.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
            <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Early End</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">{earlyEndLogs.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
            <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Change Queue</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">{queueChangeLogs.length}</div>
          </div>
        </div>

        {openLogs.length > 0 ? (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Ada <strong>{openLogs.length} isu</strong> belum diselesaikan.
              </span>
            </div>
            <Badge variant="crimson" className="text-[10px]">OPEN</Badge>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Semua kendala dan insiden telah selesai dievaluasi (CLOSED).</span>
          </div>
        )}
      </Card>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setFilter("OPEN")}
          className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
            filter === "OPEN"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>OPEN Issues</span>
          <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-[10px] font-extrabold text-rose-700">
            {openLogs.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("CLOSED")}
          className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
            filter === "CLOSED"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>CLOSED</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-[10px] font-extrabold text-emerald-700">
            {closedLogs.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`py-2 rounded-xl font-bold transition ${
            filter === "ALL"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Semua ({logs.length})
        </button>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-400">
            Tidak ada data log evaluasi pada kategori ini.
          </Card>
        ) : (
          filteredLogs.map((log) => {
            const reporter = users.find((u) => u.id === log.reported_by);
            const isClosed = log.status === "CLOSED" || log.status === "RESOLVED";
            const inlineValue = inlineRemarks[log.id] ?? log.resolution_notes ?? "";

            return (
              <Card
                key={log.id}
                glow={isClosed ? "none" : log.log_type === "INCIDENT" ? "crimson" : "amber"}
                className={isClosed ? "bg-slate-50/70" : ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {log.log_type === "INCIDENT" && <Badge variant="orange">INCIDENT</Badge>}
                    {log.log_type === "OVERTIME" && <Badge variant="crimson">OVERTIME</Badge>}
                    {log.log_type === "EARLYEND" && <Badge variant="emerald">EARLY END</Badge>}
                    {log.log_type === "CHANGEQUEUE" && <Badge variant="amber">CHANGE QUEUE</Badge>}
                    {log.log_type === "PAUSE" && <Badge variant="cyan">PAUSE</Badge>}
                    {log.log_type === "RESUME" && <Badge variant="emerald">RESUME</Badge>}

                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <Badge variant={isClosed ? "emerald" : "crimson"} className="text-[10px]">
                    {log.status}
                  </Badge>
                </div>

                <p className="text-sm text-slate-900 font-semibold mt-2.5 leading-relaxed">
                  {log.description}
                </p>

                {log.delta_seconds !== undefined && log.delta_seconds !== null && (
                  <div className="text-xs font-mono font-bold text-amber-700 mt-1">
                    Selisih Waktu: {formatSecondsToMMSS(log.delta_seconds)}
                  </div>
                )}

                {log.log_type === "CHANGEQUEUE" && log.previous_queue && log.new_queue && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-bold block mb-0.5">Queue Sebelumnya:</span>
                      <span className="text-slate-700">
                        {log.previous_queue.slice(0, 3).map((q) => q.title).join(" -> ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-700 font-bold inline-flex items-center gap-1 mb-0.5">
                        <ArrowRight className="w-3 h-3" />
                        Queue Baru:
                      </span>
                      <div className="text-slate-900 font-medium">
                        {log.new_queue.slice(0, 3).map((q) => q.title).join(" -> ")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing Resolution Notes */}
                {log.resolution_notes && (
                  <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900">
                    <strong className="text-emerald-700 block mb-0.5">Resolution / Remark:</strong>
                    {log.resolution_notes}
                  </div>
                )}

                {/* Inline Add Resolution / Remark + Mint Mark as CLOSED for Open Issues */}
                {!isClosed ? (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={inlineValue}
                        onChange={(e) =>
                          setInlineRemarks((prev) => ({ ...prev, [log.id]: e.target.value }))
                        }
                        placeholder="Add Resolution / Remark..."
                        className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => handleInlineMarkClosed(log)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark as CLOSED</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Pelapor: {reporter?.full_name || "Crew Lapangan"}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenResolve(log)}
                        className="text-indigo-600 hover:underline font-semibold"
                      >
                        Simpan Draft / Form Lengkap
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Pelapor: {reporter?.full_name || "Crew Lapangan"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenResolve(log)}
                      className="text-xs py-1 px-2.5 h-auto min-h-[30px]"
                    >
                      Edit Remark
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Notulensi Rapat Evaluasi (Sekretaris) */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Notulensi Rapat Evaluasi (Sekretaris)</span>
          </h3>
          {getNotesAccessMode(currentUser) === "EDIT" && (
            <Button size="sm" variant="outline" onClick={() => setIsNoteModalOpen(true)} className="text-xs">
              + Catatan
            </Button>
          )}
        </div>
        {postEvalNotes.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada notulensi POST_EVALUATION.</p>
        ) : (
          <div className="space-y-2">
            {postEvalNotes.map((note) => (
              <div key={note.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 font-mono">{note.meeting_date}</span>
                  <Badge variant="purple" className="text-[10px]">POST_EVALUATION</Badge>
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{note.notes_content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL RESOLVE INCIDENT / LOG */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Form Penyelesaian Evaluasi"
        description="Masukkan analisa penyebab dan tindakan mitigasi untuk event berikutnya."
      >
        {selectedLog && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block mb-0.5">Kendala:</span>
              <p className="text-slate-900 font-bold">{selectedLog.description}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Catatan Solusi / Tindakan Mitigasi
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Contoh: Kabel mic sudah diganti baru. Ke depan kru audio wajib soundcheck 2 jam sebelumnya..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                size="md"
                variant="outline"
                onClick={() => handleSaveResolution(false)}
                className="text-xs font-bold"
              >
                Simpan Draft
              </Button>
              <Button
                size="md"
                variant="emerald"
                onClick={() => handleSaveResolution(true)}
                disabled={!resolutionNotes.trim()}
                className="text-xs font-bold gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark as CLOSED</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL LPJ GENERATOR (Editable & Print/PDF Ready) */}
      <Modal
        isOpen={isLpjPreviewOpen}
        onClose={() => setIsLpjPreviewOpen(false)}
        title="Laporan Pertanggungjawaban (LPJ)"
        description="Format laporan resmi yang dapat diedit sebelum dicetak / diekspor ke PDF."
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs space-y-3 font-sans">
            <div className="text-center border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                LAPORAN PERTANGGUNGJAWABAN (LPJ) CREATIVE TEAM
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {event.title} · {event.event_date}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-indigo-700 text-xs mb-1">I. STATISTIK WAKTU &amp; KENDALA</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200">
                <div>Total Overtime: <strong className="text-rose-600">{formatSecondsToMMSS(totalOvertimeSecs)}</strong></div>
                <div>Total Early End: <strong className="text-emerald-600">{formatSecondsToMMSS(totalEarlySecs)}</strong></div>
                <div>Jumlah Insiden: <strong className="text-orange-600">{incidentLogs.length} kasus</strong></div>
                <div>Perubahan Urutan: <strong className="text-amber-600">{queueChangeLogs.length} kali</strong></div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-indigo-700 text-xs mb-1 flex items-center justify-between">
                <span>II. RINGKASAN PELAKSANAAN (EDITABLE)</span>
                <Edit3 className="w-3 h-3 text-slate-400" />
              </h4>
              <textarea
                rows={3}
                value={lpjSummary}
                onChange={(e) => setLpjSummary(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <h4 className="font-bold text-indigo-700 text-xs mb-1 flex items-center justify-between">
                <span>III. REKOMENDASI EVENT BERIKUTNYA (EDITABLE)</span>
                <Edit3 className="w-3 h-3 text-slate-400" />
              </h4>
              <textarea
                rows={3}
                value={lpjRecommendation}
                onChange={(e) => setLpjRecommendation(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <h4 className="font-bold text-indigo-700 text-xs mb-1">IV. REKAPITULASI PENYELESAIAN KENDALA</h4>
              <div className="space-y-1.5">
                {logs.map((l, idx) => (
                  <div key={l.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-900">#{idx + 1} [{l.log_type}]</span> {l.description}
                    {l.log_type === "CHANGEQUEUE" && l.previous_queue && l.new_queue && (
                      <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-500 font-semibold">Sebelum:</span>{" "}
                          {l.previous_queue.slice(0, 2).map((q) => q.title).join(" -> ")}
                        </div>
                        <div>
                          <span className="text-emerald-700 font-semibold">Sesudah:</span>{" "}
                          {l.new_queue.slice(0, 2).map((q) => q.title).join(" -> ")}
                        </div>
                      </div>
                    )}
                    {l.resolution_notes && (
                      <div className="text-emerald-700 font-medium mt-0.5">Solusi: {l.resolution_notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-indigo-700 text-xs mb-1">V. NOTULENSI RAPAT EVALUASI (SEKRETARIS)</h4>
              {postEvalNotes.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Belum ada catatan rapat evaluasi pasca-acara.</p>
              ) : (
                <div className="space-y-1.5">
                  {postEvalNotes.map((note) => (
                    <div key={note.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px]">
                      <span className="font-bold text-slate-900">{note.meeting_date}</span>
                      <div className="text-slate-600 mt-0.5 whitespace-pre-wrap">{note.notes_content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            size="lg"
            variant="primary"
            onClick={() => window.print()}
            className="w-full font-bold gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan ke PDF</span>
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Tambah Notulensi Evaluasi"
        description="Catatan rapat evaluasi pasca-acara oleh Sekretaris."
      >
        <div className="space-y-3">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Judul rapat evaluasi..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <textarea
            rows={4}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Poin evaluasi & tindak lanjut..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <Button size="md" variant="primary" onClick={handleAddPostEvalNote} className="w-full font-bold">
            Simpan Notulensi
          </Button>
        </div>
      </Modal>
    </div>
  );
}
