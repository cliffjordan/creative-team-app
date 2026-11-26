"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Event,
  EventRosterMember,
  LiveLog,
  RundownItem,
  SectionType,
  TimelineTask,
  User,
} from "@/types/domain";
import {
  isUserEventLeader,
  canManageEventRoster,
  getSectionAccessMode,
} from "@/lib/mock-db";
import { formatDateDisplayWIB } from "@/lib/utils";
import { TabType } from "@/components/layout/bottom-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ListOrdered,
  Radio,
  Sparkles,
  UserCheck,
} from "lucide-react";

interface HomeDashboardViewProps {
  currentUser: User | null;
  activeEvent: Event;
  accessibleEvents: Event[];
  roster: EventRosterMember[];
  items: RundownItem[];
  logs: LiveLog[];
  tasks: TimelineTask[];
  users: User[];
  onSelectEvent: (eventId: string) => void;
  onChangeTab: (tab: TabType) => void;
  onUpdateTask: (taskId: string, updated: Partial<TimelineTask>) => void;
}

const STEPPER_STAGES = [
  "Draft",
  "Planning",
  "Ready",
  "Live",
  "Completed",
  "Evaluation",
] as const;

function getEventStepIndex(event: Event, itemsCount: number): {
  activeStep: number;
  allDone: boolean;
} {
  if (event.status === "COMPLETED") {
    return { activeStep: 5, allDone: true };
  }
  if (event.status === "POST_EVENT" || !!event.live_ended_at) {
    return { activeStep: 5, allDone: false };
  }
  if (event.status === "EVENT_DAY" || !!event.live_started_at) {
    return { activeStep: 3, allDone: false };
  }
  if (event.status === "PRE_EVENT") {
    return { activeStep: itemsCount > 0 ? 2 : 1, allDone: false };
  }
  return { activeStep: 0, allDone: false };
}

function getSectionBadgeVariant(
  section: SectionType
): "purple" | "pink" | "orange" | "sky" | "neutral" {
  switch (section) {
    case "ACARA":
      return "purple";
    case "DEKORASI":
      return "pink";
    case "PERLENGKAPAN":
      return "orange";
    case "PDD":
      return "sky";
    default:
      return "neutral";
  }
}

export function HomeDashboardView({
  currentUser,
  activeEvent,
  accessibleEvents,
  roster,
  items,
  logs,
  tasks,
  users,
  onSelectEvent,
  onChangeTab,
  onUpdateTask,
}: HomeDashboardViewProps) {
  const [escalatingTask, setEscalatingTask] = useState<TimelineTask | null>(null);
  const [escalationNotes, setEscalationNotes] = useState("");
  const [escalationRecipientId, setEscalationRecipientId] = useState("");

  const isLeader = isUserEventLeader(currentUser, activeEvent, roster);
  const activeLeaderMember = roster.find(
    (r) => r.event_id === activeEvent.id && r.role_in_event === "EVENT_LEADER"
  );
  const activeLeaderId = activeLeaderMember?.user_id || activeEvent.event_leader_id;
  const activeLeaderName =
    users.find((u) => u.id === activeLeaderId)?.full_name || "Event Leader";

  const openIssuesCount = useMemo(
    () => logs.filter((l) => l.status === "OPEN").length,
    [logs]
  );

  const eventTasks = useMemo(
    () => tasks.filter((t) => !t.event_id || t.event_id === activeEvent.id),
    [tasks, activeEvent.id]
  );

  const myTasks = useMemo(() => {
    if (!currentUser) return [];
    return eventTasks.filter((t) => t.assigned_to === currentUser.id);
  }, [eventTasks, currentUser]);

  const displayedTasks = myTasks;
  const pendingTasksCount = useMemo(
    () => myTasks.filter((t) => t.status !== "DONE").length,
    [myTasks]
  );

  const { activeStep, allDone } = useMemo(
    () => getEventStepIndex(activeEvent, items.length),
    [activeEvent, items.length]
  );

  // Weekly strip anchored around current date (Mon - Sun)
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    return labels.map((label, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + idx);
      const iso = d.toISOString().slice(0, 10);
      const hasEvent = accessibleEvents.some((ev) => ev.event_date === iso);
      const isToday = iso === today.toISOString().slice(0, 10);
      return {
        label,
        dateNum: d.getDate(),
        iso,
        isToday,
        hasEvent,
      };
    });
  }, [accessibleEvents]);

  const firstName = currentUser?.full_name.split(" ")[0] || "Tim";

  const handleToggleTaskDone = (task: TimelineTask) => {
    const nextStatus = task.status === "DONE" ? "IN_PROGRESS" : "DONE";
    onUpdateTask(task.id, { status: nextStatus });
  };

  const handleOpenEscalate = (task: TimelineTask) => {
    setEscalatingTask(task);
    setEscalationNotes(task.escalation_notes || "");
    setEscalationRecipientId(task.escalation_recipient_id || activeLeaderId);
  };

  const handleSubmitEscalation = () => {
    if (!escalatingTask || !escalationNotes.trim()) return;
    onUpdateTask(escalatingTask.id, {
      status: "ESCALATED",
      escalation_notes: escalationNotes.trim(),
      escalated_by: currentUser?.id,
      escalated_at: new Date().toISOString(),
      escalation_recipient_id: escalationRecipientId || activeLeaderId,
    });
    setEscalatingTask(null);
    setEscalationNotes("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 text-white p-5 sm:p-7 shadow-xl shadow-indigo-600/15 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 border border-white/25 text-white">
                <Sparkles className="w-3 h-3" />
                {currentUser ? currentUser.base_role.replace("_", " ") : "Guest Mode"}
              </span>
              {isLeader && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 border border-emerald-300/40 text-emerald-100">
                  <UserCheck className="w-3 h-3" />
                  Event Leader Aktif
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Halo, {firstName}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 max-w-xl">
              Pantau progres acara aktif, kontrol live stage, dan tindak lanjuti tugas tim kreatif gereja dalam satu dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onChangeTab("live")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs sm:text-sm shadow-md transition"
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              Buka Live Stage
            </button>
            {getSectionAccessMode(currentUser ?? null, activeEvent, roster, "ACARA") !== "LOCKED" && (
              <button
                type="button"
                onClick={() => onChangeTab("sections")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-xs sm:text-sm transition"
              >
                <ListOrdered className="w-4 h-4" />
                Build Rundown
              </button>
            )}
          </div>
        </div>

        {/* Mini KPI Strip */}
        <div className="relative grid grid-cols-3 gap-2.5 sm:gap-4 mt-5 pt-4 border-t border-white/15">
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-xs">
            <div className="text-[11px] text-indigo-100/80 font-medium">Segmen Rundown</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5">{items.length}</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-xs">
            <div className="text-[11px] text-indigo-100/80 font-medium">Tugas Aktif</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5">
              {pendingTasksCount}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-xs">
            <div className="text-[11px] text-indigo-100/80 font-medium">Open Issues</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5">
              {openIssuesCount}
            </div>
          </div>
        </div>
      </section>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Current Active Event + Stepper + MY TASKS */}
        <div className="lg:col-span-7 space-y-6">
          {/* Current Active Event Card */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                    Current Active Event
                  </span>
                  <Badge
                    variant={
                      activeEvent.status === "COMPLETED"
                        ? "emerald"
                        : activeEvent.status === "EVENT_DAY"
                        ? "crimson"
                        : activeEvent.status === "POST_EVENT"
                        ? "amber"
                        : "purple"
                    }
                  >
                    {activeEvent.status.replace("_", " ")}
                  </Badge>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {activeEvent.title}
                </h3>
                <p className="text-xs text-slate-500">Tema: {activeEvent.theme}</p>
              </div>

              {canManageEventRoster(
                currentUser ?? null,
                roster,
                activeEvent.id,
                activeEvent.event_leader_id
              ) && (
                <Link
                  href={`/events/${activeEvent.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition"
                >
                  Detail &amp; Roster
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                {formatDateDisplayWIB(activeEvent.event_date, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Leader: <strong className="text-slate-900">{activeLeaderName}</strong>
              </span>
            </div>

            {/* 6-Stage Progress Stepper */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-3">
                <span>Alur Siklus Event</span>
                <span className="text-indigo-600 font-bold">
                  {allDone ? "Selesai 100%" : `Tahap: ${STEPPER_STAGES[activeStep]}`}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {STEPPER_STAGES.map((stage, idx) => {
                  const isCompleted = allDone || idx < activeStep;
                  const isCurrent = !allDone && idx === activeStep;
                  return (
                    <div
                      key={stage}
                      className={`flex flex-col items-center text-center p-2 rounded-xl border transition ${
                        isCurrent
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : isCompleted
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mb-1 ${
                          isCurrent
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                            : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className="text-[11px] font-semibold truncate w-full">{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Tab Jumps */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChangeTab("live")}
                className="justify-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Stage</span>
              </Button>
              {getSectionAccessMode(currentUser ?? null, activeEvent, roster, "ACARA") !== "LOCKED" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChangeTab("sections")}
                  className="justify-center gap-1.5"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rundown</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChangeTab("evaluation")}
                className="justify-center gap-1.5"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-orange-500" />
                <span>Evaluasi</span>
              </Button>
            </div>
          </Card>

          {/* MY TASKS Section */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">MY TASKS</h3>
                <p className="text-xs text-slate-500">
                  Daftar tugas tanggungan Anda pada event ini.
                </p>
              </div>
              <Badge variant="purple" className="text-xs font-bold">
                Tugas Saya ({myTasks.length})
              </Badge>
            </div>

            <div className="space-y-2.5">
              {displayedTasks.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
                  Anda belum memiliki tanggungan tugas pada event ini.
                </div>
              ) : (
                displayedTasks.map((task) => {
                  const isDone = task.status === "DONE";
                  const isEscalated = task.status === "ESCALATED";
                  const assigneeName =
                    users.find((u) => u.id === task.assigned_to)?.full_name.split(" ")[0] ||
                    "Anggota";

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-2xl border transition ${
                        isDone
                          ? "bg-slate-50/80 border-slate-200/70 opacity-75"
                          : isEscalated
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-white border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskDone(task)}
                            aria-label={`Tandai tugas ${task.title}`}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                              isDone
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 hover:border-indigo-500 bg-white"
                            }`}
                          >
                            {isDone && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={getSectionBadgeVariant(task.section)}
                                className="text-[10px]"
                              >
                                {task.section}
                              </Badge>
                              <Badge
                                variant={
                                  task.phase === "EVENT_DAY"
                                    ? "crimson"
                                    : task.phase === "POST_EVENT"
                                    ? "amber"
                                    : "cyan"
                                }
                                className="text-[10px]"
                              >
                                {task.phase.replace("_", " ")}
                              </Badge>
                              {isEscalated && (
                                <Badge variant="crimson" className="text-[10px]">
                                  ESCALATED
                                </Badge>
                              )}
                            </div>

                            <div
                              className={`text-sm font-bold leading-snug ${
                                isDone ? "line-through text-slate-400" : "text-slate-900"
                              }`}
                            >
                              {task.title}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                              <span>PIC: {assigneeName}</span>
                              {task.due_date && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Due {task.due_date}
                                </span>
                              )}
                            </div>

                            {isEscalated && task.escalation_notes && (
                              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 mt-1">
                                Eskalasi: {task.escalation_notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {!isDone && !isEscalated && (
                          <button
                            type="button"
                            onClick={() => handleOpenEscalate(task)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-bold transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Escalate Issue</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => onChangeTab("timeline")}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Kelola Semua di Timeline &amp; Tugas
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Weekly Calendar & Upcoming Schedule */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Jadwal Minggu Ini</h3>
                <p className="text-xs text-slate-500">Kalender &amp; daftar event yang ditugaskan.</p>
              </div>
              <button
                type="button"
                onClick={() => onChangeTab("calendar")}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl transition"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Buka Kalender Penuh</span>
              </button>
            </div>

            {/* 7-day strip */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => (
                <div
                  key={day.iso}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center transition ${
                    day.isToday
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                      : day.hasEvent
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">{day.label}</span>
                  <span className="text-sm font-extrabold mt-0.5">{day.dateNum}</span>
                  {day.hasEvent && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        day.isToday ? "bg-emerald-300" : "bg-indigo-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Upcoming Schedule List */}
            <div className="space-y-2.5 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Upcoming Schedule ({accessibleEvents.length})
              </div>
              {accessibleEvents.map((ev) => {
                const isSelected = ev.id === activeEvent.id;
                const leaderName =
                  users.find((u) => u.id === ev.event_leader_id)?.full_name.split(" ")[0] ||
                  "Leader";
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onSelectEvent(ev.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-300 shadow-xs"
                        : "bg-white border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {ev.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatDateDisplayWIB(ev.event_date, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · Leader: {leaderName}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          ev.status === "COMPLETED"
                            ? "emerald"
                            : ev.status === "EVENT_DAY"
                            ? "crimson"
                            : ev.status === "POST_EVENT"
                            ? "amber"
                            : "purple"
                        }
                        className="text-[10px]"
                      >
                        {ev.status === "EVENT_DAY" ? "LIVE" : ev.status.replace("_", " ")}
                      </Badge>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-600 inline-flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Escalate Issue Modal */}
      <Modal
        isOpen={!!escalatingTask}
        onClose={() => setEscalatingTask(null)}
        title="Escalate Task Issue"
        description={escalatingTask?.title}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kirim Eskalasi Ke
            </label>
            <select
              value={escalationRecipientId}
              onChange={(e) => setEscalationRecipientId(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            >
              {users
                .filter((u) => u.base_role !== "MEMBER")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.base_role.replace("_", " ")})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Deskripsi Hambatan / Kendala
            </label>
            <textarea
              rows={3}
              value={escalationNotes}
              onChange={(e) => setEscalationNotes(e.target.value)}
              placeholder="Contoh: Vendor lampu menunda pengiriman, butuh persetujuan dana tambahan..."
              className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <Button
            type="button"
            variant="crimson"
            size="lg"
            disabled={!escalationNotes.trim()}
            onClick={handleSubmitEscalation}
            className="w-full font-bold"
          >
            Kirim Eskalasi Sekarang
          </Button>
        </div>
      </Modal>
    </div>
  );
}
