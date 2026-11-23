"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  INITIAL_EVENT,
  INITIAL_EVENTS,
  INITIAL_ROSTER,
  getUsersBySection,
  isUserEventLeader,
} from "@/lib/mock-db";
import {
  Event,
  EventRosterMember,
  TimelineTask,
  SectionType,
  TaskPhase,
  TaskPicHistoryEntry,
  TaskStatus,
  User,
} from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  User as UserIcon,
  Plus,
  ArrowUpRight,
  Check,
  UserCheck,
  History,
} from "lucide-react";

interface TimelineViewProps {
  tasks: TimelineTask[];
  users: User[];
  currentUser: User | null;
  events?: Event[];
  activeEvent?: Event;
  roster?: EventRosterMember[];
  onSelectEvent?: (eventId: string) => void;
  onUpdateTask: (taskId: string, updated: Partial<TimelineTask>) => void;
  onAddTask: (task: Omit<TimelineTask, "id" | "created_at" | "updated_at">) => void;
}

const EVENT_LANE_COLORS = [
  { bg: "bg-teal-500", light: "bg-teal-50 border-teal-200 text-teal-800", bar: "bg-teal-500 text-white" },
  { bg: "bg-sky-500", light: "bg-sky-50 border-sky-200 text-sky-800", bar: "bg-sky-500 text-white" },
  { bg: "bg-amber-500", light: "bg-amber-50 border-amber-200 text-amber-800", bar: "bg-amber-500 text-white" },
  { bg: "bg-rose-500", light: "bg-rose-50 border-rose-200 text-rose-800", bar: "bg-rose-500 text-white" },
  { bg: "bg-indigo-500", light: "bg-indigo-50 border-indigo-200 text-indigo-800", bar: "bg-indigo-500 text-white" },
];

const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8"];

function getWeekMonthLabels(anchorDateStr?: string): { weekLabel: string; monthYear: string }[] {
  const baseDate = anchorDateStr ? new Date(anchorDateStr) : new Date();
  const validBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  return WEEKS.map((weekLabel, idx) => {
    const d = new Date(validBase);
    // Week 1 = H-6 minggu, Week 7 = minggu event, Week 8 = H+1 minggu
    d.setDate(d.getDate() + (idx - 6) * 7);
    const monthYear = d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
    return { weekLabel, monthYear };
  });
}

function getTaskWeekSpan(task: TimelineTask, indexInEvent: number): { startCol: number; span: number } {
  if (task.phase === "EVENT_DAY") return { startCol: 5, span: 2 };
  if (task.phase === "POST_EVENT") return { startCol: 7, span: 2 };
  const start = Math.min(4, (indexInEvent * 2) % 4 + 1);
  return { startCol: start, span: 2 };
}

export function TimelineView({
  tasks,
  users,
  currentUser,
  events = INITIAL_EVENTS,
  activeEvent = INITIAL_EVENT,
  roster = INITIAL_ROSTER,
  onSelectEvent,
  onUpdateTask,
  onAddTask,
}: TimelineViewProps) {
  const [phaseFilter, setPhaseFilter] = useState<"ALL" | TaskPhase>("ALL");
  const [taskScope, setTaskScope] = useState<"ALL" | "MINE">("ALL");
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);
  const [selectedTaskForEscalate, setSelectedTaskForEscalate] = useState<TimelineTask | null>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [selectedTaskForResolve, setSelectedTaskForResolve] = useState<TimelineTask | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [resolveTargetStatus, setResolveTargetStatus] = useState<"IN_PROGRESS" | "DONE">("IN_PROGRESS");

  // PIC Delegation State
  const [delegateTargetTask, setDelegateTargetTask] = useState<TimelineTask | null>(null);
  const [delegatePicId, setDelegatePicId] = useState<string>("");
  const [delegateReason, setDelegateReason] = useState<string>("");

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newEventId, setNewEventId] = useState(activeEvent.id);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSection, setNewSection] = useState<SectionType>("ACARA");
  const [newPhase, setNewPhase] = useState<TaskPhase>("PRE_EVENT");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState(activeEvent.event_date || "2026-12-20");

  // Strict requirement: only Section Leaders assigned to an event can create manual tasks for their section
  const sectionLeaderRosterForSelectedEvent = useMemo(() => {
    if (!currentUser) return undefined;
    return roster.find(
      (r) =>
        r.event_id === (newEventId || activeEvent.id) &&
        r.user_id === currentUser.id &&
        r.role_in_event === "SECTION_LEADER"
    );
  }, [currentUser, roster, newEventId, activeEvent.id]);

  const eventsLedAsSectionLeader = useMemo(() => {
    if (!currentUser) return [];
    return events.filter((ev) =>
      roster.some(
        (r) =>
          r.event_id === ev.id &&
          r.user_id === currentUser.id &&
          r.role_in_event === "SECTION_LEADER"
      )
    );
  }, [currentUser, events, roster]);

  const canCreateManualTask = eventsLedAsSectionLeader.length > 0;

  useEffect(() => {
    if (sectionLeaderRosterForSelectedEvent) {
      setNewSection(sectionLeaderRosterForSelectedEvent.section);
    }
  }, [sectionLeaderRosterForSelectedEvent]);

  const sectionUsers = useMemo(() => {
    const targetEvId = newEventId || activeEvent.id;
    const rosterMemberIds = new Set(
      roster
        .filter((r) => r.event_id === targetEvId && r.section === newSection)
        .map((r) => r.user_id)
    );
    if (rosterMemberIds.size > 0) {
      return users.filter((u) => rosterMemberIds.has(u.id));
    }
    return getUsersBySection(users, newSection, targetEvId, roster);
  }, [users, newSection, newEventId, activeEvent.id, roster]);

  useEffect(() => {
    if (newAssignee && !sectionUsers.some((u) => u.id === newAssignee)) {
      setNewAssignee("");
    }
  }, [newAssignee, sectionUsers]);

  const isLeader =
    currentUser?.base_role === "CREATIVE_LEADER" ||
    currentUser?.base_role === "WAKIL_LEADER" ||
    Boolean(currentUser?.is_superadmin) ||
    currentUser?.base_role === "SECTION_LEADER";

  const canDelegateTaskPic = (task: TimelineTask): boolean => {
    if (!currentUser) return false;
    const targetEv = events.find((e) => e.id === task.event_id) ?? activeEvent;
    if (
      currentUser.base_role === "CREATIVE_LEADER" ||
      currentUser.base_role === "WAKIL_LEADER" ||
      Boolean(currentUser.is_superadmin) ||
      isUserEventLeader(currentUser, targetEv, roster)
    ) {
      return true;
    }
    return roster.some(
      (r) =>
        r.event_id === task.event_id &&
        r.user_id === currentUser.id &&
        r.role_in_event === "SECTION_LEADER" &&
        r.section === task.section
    );
  };

  const delegateCandidateUsers = useMemo(() => {
    if (!delegateTargetTask) return [];
    const rosterIds = new Set(
      roster
        .filter(
          (r) =>
            r.event_id === delegateTargetTask.event_id &&
            r.section === delegateTargetTask.section
        )
        .map((r) => r.user_id)
    );
    if (rosterIds.size > 0) {
      return users.filter((u) => rosterIds.has(u.id));
    }
    if (delegateTargetTask.section === "INTI") {
      return users.filter((u) =>
        ["CREATIVE_LEADER", "WAKIL_LEADER", "SEKRETARIS", "BENDAHARA"].includes(u.base_role)
      );
    }
    return users;
  }, [delegateTargetTask, roster, users]);

  const weekHeaders = useMemo(
    () => getWeekMonthLabels(activeEvent?.event_date),
    [activeEvent?.event_date]
  );

  const periodRangeLabel = useMemo(() => {
    if (weekHeaders.length === 0) return "";
    const first = weekHeaders[0].monthYear;
    const last = weekHeaders[weekHeaders.length - 1].monthYear;
    return first === last ? first : `${first} – ${last}`;
  }, [weekHeaders]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        (phaseFilter === "ALL" || t.phase === phaseFilter) &&
        (taskScope === "ALL" || t.assigned_to === currentUser?.id)
    );
  }, [tasks, phaseFilter, taskScope, currentUser?.id]);

  const handleEscalateSubmit = () => {
    if (!selectedTaskForEscalate || !escalationReason.trim()) return;
    const nowIso = new Date().toISOString();

    onUpdateTask(selectedTaskForEscalate.id, {
      status: "ESCALATED",
      escalation_notes: escalationReason,
      escalated_by: currentUser?.id || null,
      escalated_at: nowIso,
    });

    setSelectedTaskForEscalate(null);
    setSelectedTask(null);
    setEscalationReason("");
  };

  const handleResolveEscalation = () => {
    if (!selectedTaskForResolve || !resolutionText.trim()) return;
    onUpdateTask(selectedTaskForResolve.id, {
      status: resolveTargetStatus,
      escalation_resolution: resolutionText.trim(),
      escalation_resolved_at: new Date().toISOString(),
    });
    setSelectedTaskForResolve(null);
    setSelectedTask(null);
    setResolutionText("");
  };

  const handleToggleDone = (task: TimelineTask) => {
    const nextStatus: TaskStatus = task.status === "DONE" ? "IN_PROGRESS" : "DONE";
    onUpdateTask(task.id, { status: nextStatus });
    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...task, status: nextStatus });
    }
  };

  const handleCreateTask = () => {
    if (!canCreateManualTask || !sectionLeaderRosterForSelectedEvent || !newTitle.trim()) return;
    onAddTask({
      event_id: newEventId || activeEvent.id,
      section: sectionLeaderRosterForSelectedEvent.section,
      phase: newPhase,
      title: newTitle.trim(),
      description: newDesc.trim(),
      assigned_to: newAssignee || null,
      due_date: newDueDate,
      status: "TODO",
    });
    setIsAddTaskModalOpen(false);
    setNewTitle("");
    setNewDesc("");
  };

  const handleOpenDelegateModal = (task: TimelineTask) => {
    setDelegateTargetTask(task);
    setDelegatePicId(task.assigned_to || "");
    setDelegateReason("");
  };

  const handleDelegateSubmit = () => {
    if (!delegateTargetTask || delegateReason.trim().length < 3) return;
    const trimmedReason = delegateReason.trim();
    const prevHistory = Array.isArray(delegateTargetTask.pic_history)
      ? delegateTargetTask.pic_history
      : [];
    const newEntry: TaskPicHistoryEntry = {
      from_user_id: delegateTargetTask.assigned_to ?? null,
      to_user_id: delegatePicId || null,
      changed_by: currentUser?.id || "",
      reason: trimmedReason,
      changed_at: new Date().toISOString(),
    };
    const nextHistory = [...prevHistory, newEntry];
    const updates: Partial<TimelineTask> = {
      assigned_to: delegatePicId || null,
      pic_change_reason: trimmedReason,
      pic_history: nextHistory,
    };
    onUpdateTask(delegateTargetTask.id, updates);
    if (selectedTask?.id === delegateTargetTask.id) {
      setSelectedTask({ ...selectedTask, ...updates });
    }
    setDelegateTargetTask(null);
    setDelegateReason("");
  };

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            <span>Event &amp; Task Planning Timeline</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar task horizontal per masing-masing event yang ditugaskan.
          </p>
        </div>

        {canCreateManualTask && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const defaultEv =
                eventsLedAsSectionLeader.find((ev) => ev.id === activeEvent.id) ??
                eventsLedAsSectionLeader[0];
              if (defaultEv) {
                setNewEventId(defaultEv.id);
              }
              setIsAddTaskModalOpen(true);
            }}
            className="text-xs font-bold gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Task</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
          {(["ALL", "PRE_EVENT", "EVENT_DAY", "POST_EVENT"] as const).map((phase) => (
            <button
              key={phase}
              type="button"
              onClick={() => setPhaseFilter(phase)}
              className={`py-1.5 rounded-xl font-bold transition truncate px-1 ${
                phaseFilter === phase
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {phase === "ALL" ? "Semua Fase" : phase.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setTaskScope("ALL")}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              taskScope === "ALL" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
            }`}
          >
            Semua Task
          </button>
          <button
            type="button"
            onClick={() => setTaskScope("MINE")}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              taskScope === "MINE" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
            }`}
          >
            Task Saya
          </button>
        </div>
      </div>

      {/* Horizontal Event-Task Matrix (Tanpa Milestone Header) */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Period Month-Year Banner */}
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/70 border-b border-slate-200 text-xs">
              <span className="font-bold text-indigo-800">
                Periode Timeline: {periodRangeLabel}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Acuan Event: {activeEvent.title}
              </span>
            </div>

            {/* Week Header Row */}
            <div className="grid grid-cols-10 border-b border-slate-200 bg-slate-50">
              <div className="col-span-2 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-600 border-r border-slate-200 flex items-center">
                Event
              </div>
              {weekHeaders.map((w) => (
                <div
                  key={w.weekLabel}
                  className="col-span-1 px-2 py-2.5 text-center border-r border-slate-200/70 last:border-r-0"
                >
                  <div className="text-xs font-bold text-slate-700">{w.weekLabel}</div>
                  <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">{w.monthYear}</div>
                </div>
              ))}
            </div>

            {/* Event Lanes + Task Bars */}
            <div className="divide-y divide-slate-200">
              {events.map((ev, evIdx) => {
                const color = EVENT_LANE_COLORS[evIdx % EVENT_LANE_COLORS.length];
                const evTasks = filteredTasks.filter((t) => t.event_id === ev.id);

                return (
                  <div key={ev.id} className="grid grid-cols-10 items-stretch min-h-[76px]">
                    {/* Left Event Cell */}
                    <button
                      type="button"
                      onClick={() => onSelectEvent?.(ev.id)}
                      className={`col-span-2 px-3.5 py-3 text-left border-r border-slate-200 flex flex-col justify-center gap-1 transition hover:opacity-95 ${color.bg} text-white`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                        Event {evIdx + 1}
                      </span>
                      <span className="text-xs font-extrabold leading-snug line-clamp-2">
                        {ev.title}
                      </span>
                      <span className="text-[10px] opacity-90 font-medium">
                        {new Date(ev.event_date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[10px] opacity-85 font-mono">
                        {evTasks.length} task
                      </span>
                    </button>

                    {/* Right Tasks Grid */}
                    <div className="col-span-8 p-2.5 bg-white relative">
                      {evTasks.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          Belum ada task untuk event ini.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {evTasks.map((task, tIdx) => {
                            const { startCol, span } = getTaskWeekSpan(task, tIdx);
                            const assignee = users.find((u) => u.id === task.assigned_to);
                            const isDone = task.status === "DONE";
                            const isEscalated = task.status === "ESCALATED";

                            return (
                              <div key={task.id} className="grid grid-cols-8 gap-1 items-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTask(task)}
                                  style={{
                                    gridColumnStart: startCol,
                                    gridColumnEnd: `span ${span}`,
                                  }}
                                  className={`text-left px-3 py-1.5 rounded-r-full rounded-l-lg text-xs font-bold shadow-xs transition flex items-center justify-between gap-2 truncate ${
                                    isDone
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200 line-through opacity-80"
                                      : isEscalated
                                      ? "bg-rose-500 text-white"
                                      : color.bar
                                  }`}
                                  title={`${task.title} (${task.section})`}
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    {isDone && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    {isEscalated && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                    <span className="truncate">{task.title}</span>
                                  </span>
                                  <span className="text-[10px] opacity-85 shrink-0 font-mono">
                                    {assignee ? assignee.full_name.split(" ")[0] : task.section}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Task Detail Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || "Detail Task"}
        description={selectedTask ? `${selectedTask.section} · ${selectedTask.phase.replace("_", " ")}` : undefined}
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedTask.status === "DONE" ? "emerald" : selectedTask.status === "ESCALATED" ? "crimson" : "cyan"}>
                {selectedTask.status}
              </Badge>
              {selectedTask.due_date && (
                <span className="text-xs font-mono text-slate-500 inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due: {selectedTask.due_date}
                </span>
              )}
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" />
                {users.find((u) => u.id === selectedTask.assigned_to)?.full_name || "Belum ada PIC"}
              </span>
            </div>

            {selectedTask.description && (
              <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedTask.description}
              </p>
            )}

            {(selectedTask.pic_change_reason || (selectedTask.pic_history && selectedTask.pic_history.length > 0)) && (
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Riwayat Delegasi PIC</span>
                </div>
                {selectedTask.pic_change_reason && (
                  <p className="text-[11px]">
                    <strong>Alasan Terakhir:</strong> {selectedTask.pic_change_reason}
                  </p>
                )}
                {selectedTask.pic_history && selectedTask.pic_history.length > 0 && (
                  <ul className="space-y-1 pt-1 border-t border-indigo-200/70 text-[11px]">
                    {selectedTask.pic_history.map((h, i) => {
                      const toName =
                        users.find((u) => u.id === h.to_user_id)?.full_name || "Unassigned";
                      return (
                        <li key={`${h.changed_at}-${i}`}>
                          → <strong>{toName}</strong>: {h.reason}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {selectedTask.status === "ESCALATED" && selectedTask.escalation_notes && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                <div>
                  <strong className="block text-rose-700">Kendala Dieskalasi:</strong>
                  {selectedTask.escalation_notes}
                </div>
                {isLeader && (
                  <Button
                    size="sm"
                    variant="emerald"
                    onClick={() => setSelectedTaskForResolve(selectedTask)}
                    className="w-full"
                  >
                    Selesaikan Eskalasi (Leader)
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedTask.status === "TODO" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onUpdateTask(selectedTask.id, { status: "IN_PROGRESS" });
                    setSelectedTask({ ...selectedTask, status: "IN_PROGRESS" });
                  }}
                >
                  Kerjakan
                </Button>
              )}
              {canDelegateTaskPic(selectedTask) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDelegateModal(selectedTask)}
                  className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Delegasi / Ubah PIC
                </Button>
              )}
              {selectedTask.status !== "DONE" && selectedTask.status !== "ESCALATED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTaskForEscalate(selectedTask)}
                  className="text-orange-700 border-orange-200 hover:bg-orange-50 gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Escalate Issue
                </Button>
              )}
              <Button
                size="sm"
                variant={selectedTask.status === "DONE" ? "outline" : "emerald"}
                onClick={() => handleToggleDone(selectedTask)}
                className="ml-auto"
              >
                {selectedTask.status === "DONE" ? "Batal Selesai" : "Tandai Selesai"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL SELESAIKAN ESKALASI (LEADER) */}
      <Modal
        isOpen={!!selectedTaskForResolve}
        onClose={() => setSelectedTaskForResolve(null)}
        title="Selesaikan Eskalasi Task"
      >
        {selectedTaskForResolve && (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="Tuliskan keputusan / solusi leader..."
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Status Baru:</span>
              <select
                value={resolveTargetStatus}
                onChange={(e) => setResolveTargetStatus(e.target.value as "IN_PROGRESS" | "DONE")}
                className="p-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
              >
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="DONE">DONE</option>
              </select>
            </div>
            <Button variant="emerald" size="md" onClick={handleResolveEscalation} className="w-full font-bold">
              Simpan Resolusi
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL ESKALASI KENDALA */}
      <Modal
        isOpen={!!selectedTaskForEscalate}
        onClose={() => setSelectedTaskForEscalate(null)}
        title="Eskalasi Kendala ke Leader"
      >
        {selectedTaskForEscalate && (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              placeholder="Jelaskan hambatan yang dihadapi..."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900"
            />
            <Button
              size="lg"
              variant="crimson"
              onClick={handleEscalateSubmit}
              disabled={!escalationReason.trim()}
              className="w-full font-bold"
            >
              Kirim Eskalasi Sekarang
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL DELEGASI / UBAH PIC DENGAN ALASAN WAJIB */}
      <Modal
        isOpen={!!delegateTargetTask}
        onClose={() => setDelegateTargetTask(null)}
        title="Delegasi / Ubah PIC Task"
        description={
          delegateTargetTask
            ? `${delegateTargetTask.title} (${delegateTargetTask.section})`
            : undefined
        }
      >
        {delegateTargetTask && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Pilih PIC Baru (Anggota Divisi {delegateTargetTask.section})
              </label>
              <select
                value={delegatePicId}
                onChange={(e) => setDelegatePicId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900"
              >
                <option value="">-- Pilih Anggota --</option>
                {delegateCandidateUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.base_role.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Alasan Pergantian / Delegasi PIC *
              </label>
              <textarea
                rows={3}
                value={delegateReason}
                onChange={(e) => setDelegateReason(e.target.value)}
                placeholder="Wajib diisi (min. 3 karakter), misal: Delegasi ke anggota seksi Acara agar fokus ke rundown..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDelegateTargetTask(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={
                  !delegatePicId ||
                  delegatePicId === (delegateTargetTask.assigned_to || "") ||
                  delegateReason.trim().length < 3
                }
                onClick={handleDelegateSubmit}
                className="font-bold"
              >
                Simpan Delegasi PIC
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL TAMBAH TASK (KHUSUS SECTION LEADER) */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        title="Tambah Task Divisi Baru"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Event</label>
            <select
              value={newEventId}
              onChange={(e) => setNewEventId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900"
            >
              {eventsLedAsSectionLeader.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Judul Task</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Contoh: Beli lilin natal 500 pcs"
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Section (Terkunci)</label>
              <input
                type="text"
                readOnly
                value={sectionLeaderRosterForSelectedEvent?.section || newSection}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Fase</label>
              <select
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value as TaskPhase)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              >
                <option value="PRE_EVENT">PRE_EVENT</option>
                <option value="EVENT_DAY">EVENT_DAY</option>
                <option value="POST_EVENT">POST_EVENT</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tenggat</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Pilih PIC Anggota</label>
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900"
            >
              <option value="">-- Pilih Anggota --</option>
              {sectionUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.base_role.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Rincian tugas..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900"
            />
          </div>

          <Button size="lg" variant="primary" onClick={handleCreateTask} className="w-full font-bold">
            Simpan Task
          </Button>
        </div>
      </Modal>
    </div>
  );
}
