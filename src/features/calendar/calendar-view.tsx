"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  INITIAL_ROSTER,
  getAllowedSectionsForUser,
  getFinanceAccessMode,
  getUsersBySection,
} from "@/lib/mock-db";
import { subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import {
  Event,
  EventBudgetLedgerItem,
  EventRosterMember,
  RundownItem,
  SectionType,
  TaskPhase,
  TimelineTask,
  User,
} from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Wallet,
} from "lucide-react";

interface CalendarViewProps {
  events: Event[];
  activeEvent: Event;
  tasks: TimelineTask[];
  items: RundownItem[];
  users: User[];
  currentUser?: User | null;
  roster?: EventRosterMember[];
  onSelectEvent: (eventId: string) => void;
  onUpdateTask: (taskId: string, updated: Partial<TimelineTask>) => void;
  onAddTask: (task: Omit<TimelineTask, "id" | "created_at" | "updated_at">) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00 - 22:00
const DAY_LABELS = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

export function CalendarView({
  events,
  activeEvent,
  tasks,
  items,
  users,
  currentUser = null,
  roster = INITIAL_ROSTER,
  onSelectEvent,
  onUpdateTask,
  onAddTask,
}: CalendarViewProps) {
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [searchPic, setSearchPic] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showRundown, setShowRundown] = useState(true);
  const [showBudgets, setShowBudgets] = useState(true);

  const canViewBudgetSchedule = getFinanceAccessMode(currentUser) !== "LOCKED";
  const [budgetItems, setBudgetItems] = useState<EventBudgetLedgerItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("CT_SECTION_BUDGETS");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as EventBudgetLedgerItem[];
      }
    } catch {}
    return [];
  });
  const [selectedBudget, setSelectedBudget] = useState<EventBudgetLedgerItem | null>(null);

  useEffect(() => {
    if (!activeEvent.id || !canViewBudgetSchedule) return;
    let mounted = true;
    fetch(`/api/events/${activeEvent.id}/budget`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.success || !Array.isArray(data.items)) return;
        setBudgetItems((prev) => [
          ...prev.filter((b) => b.event_id !== activeEvent.id),
          ...(data.items as EventBudgetLedgerItem[]),
        ]);
      })
      .catch(() => {});

    const unsub = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_SECTION_BUDGETS" && Array.isArray(msg.payload)) {
        setBudgetItems(msg.payload as EventBudgetLedgerItem[]);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [activeEvent.id, canViewBudgetSchedule]);

  const scheduledBudgets = useMemo(() => {
    if (!canViewBudgetSchedule) return [];
    return budgetItems.filter(
      (b) => b.event_id === activeEvent.id && Boolean(b.required_date)
    );
  }, [budgetItems, activeEvent.id, canViewBudgetSchedule]);

  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEventId, setNewEventId] = useState(activeEvent.id);
  const [newSection, setNewSection] = useState<SectionType>("ACARA");
  const [newAssignee, setNewAssignee] = useState("");

  const allowedSections = useMemo(
    () => getAllowedSectionsForUser(currentUser, newEventId, roster),
    [currentUser, newEventId, roster]
  );

  const sectionUsers = useMemo(
    () => getUsersBySection(users, newSection, newEventId, roster),
    [users, newSection, newEventId, roster]
  );

  useEffect(() => {
    if (allowedSections.length === 1 && newSection !== allowedSections[0]) {
      setNewSection(allowedSections[0]);
    }
  }, [allowedSections, newSection]);

  useEffect(() => {
    if (newAssignee && !sectionUsers.some((u) => u.id === newAssignee)) {
      setNewAssignee("");
    }
  }, [newAssignee, sectionUsers]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const weekDays = useMemo(() => {
    const start = new Date(anchorDate);
    start.setDate(anchorDate.getDate() - anchorDate.getDay()); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        date: d,
        iso: d.toISOString().slice(0, 10),
        dayName: DAY_LABELS[i],
        dayNum: d.getDate(),
      };
    });
  }, [anchorDate]);

  const monthDays = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 35 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return {
        date: d,
        iso: d.toISOString().slice(0, 10),
        inMonth: d.getMonth() === month,
        dayNum: d.getDate(),
      };
    });
  }, [anchorDate]);

  const filteredTasks = useMemo(() => {
    const q = searchPic.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const pic = users.find((u) => u.id === t.assigned_to)?.full_name.toLowerCase() || "";
      return t.title.toLowerCase().includes(q) || pic.includes(q);
    });
  }, [tasks, searchPic, users]);

  const navigatePeriod = (dir: -1 | 1) => {
    const next = new Date(anchorDate);
    if (viewMode === "WEEK") {
      next.setDate(anchorDate.getDate() + dir * 7);
    } else {
      next.setMonth(anchorDate.getMonth() + dir);
    }
    setAnchorDate(next);
  };

  const handleCreateQuickTask = () => {
    if (!newTitle.trim()) return;
    onAddTask({
      event_id: newEventId || activeEvent.id,
      section: newSection,
      phase: "PRE_EVENT" as TaskPhase,
      title: newTitle.trim(),
      assigned_to: newAssignee || null,
      due_date: newDate,
      status: "TODO",
    });
    setIsCreateOpen(false);
    setNewTitle("");
  };

  const nowHour = new Date().getHours();
  const nowMinutes = new Date().getMinutes();

  return (
    <div className="space-y-4 pb-28 lg:pb-12 animate-fade-in">
      {/* Google-Calendar Style Top Toolbar */}
      <Card className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAnchorDate(new Date())}
            className="text-xs font-semibold"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigatePeriod(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Periode sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigatePeriod(1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Periode berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            {anchorDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("WEEK")}
            className={`px-3 py-1 rounded-lg font-bold transition ${
              viewMode === "WEEK" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("MONTH")}
            className={`px-3 py-1 rounded-lg font-bold transition ${
              viewMode === "MONTH" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
            }`}
          >
            Month
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sidebar: Mini Calendar + Filter + Search People */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>
                {anchorDate.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
              </span>
              <CalendarDays className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
              {DAY_LABELS.map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {monthDays.map((d) => {
                const isToday = d.iso === todayIso;
                const isSelected = d.iso === anchorDate.toISOString().slice(0, 10);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setAnchorDate(d.date)}
                    className={`w-7 h-7 mx-auto rounded-full text-[11px] font-semibold flex items-center justify-center transition ${
                      isToday
                        ? "bg-indigo-600 text-white font-bold"
                        : isSelected
                        ? "bg-indigo-100 text-indigo-700 font-bold"
                        : d.inMonth
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-300"
                    }`}
                  >
                    {d.dayNum}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPic}
                onChange={(e) => setSearchPic(e.target.value)}
                placeholder="Search for people / task..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sinkronisasi Kalender
              </div>
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEvents}
                  onChange={(e) => setShowEvents(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Events ({events.length})</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTasks}
                  onChange={(e) => setShowTasks(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Tasks ({filteredTasks.length})</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRundown}
                  onChange={(e) => setShowRundown(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Rundown ({items.length})</span>
              </label>
              {canViewBudgetSchedule && (
                <label className="flex items-center gap-2 text-emerald-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBudgets}
                    onChange={(e) => setShowBudgets(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Pembiayaan / Belanja ({scheduledBudgets.length})</span>
                </label>
              )}
            </div>
          </Card>
        </div>

        {/* Main Calendar Grid */}
        <div className="lg:col-span-9">
          {viewMode === "WEEK" ? (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
                    <div className="p-2.5 text-[10px] font-bold text-slate-400 border-r border-slate-200 flex items-end justify-center">
                      GMT+7
                    </div>
                    {weekDays.map((d) => {
                      const isToday = d.iso === todayIso;
                      const dayTasks = showTasks
                        ? filteredTasks.filter((t) => t.due_date === d.iso)
                        : [];
                      const pendingCount = dayTasks.filter((t) => t.status !== "DONE").length;
                      const dayEvents = showEvents
                        ? events.filter((ev) => ev.event_date === d.iso)
                        : [];
                      const dayBudgets =
                        showBudgets && canViewBudgetSchedule
                          ? scheduledBudgets.filter((b) => b.required_date === d.iso)
                          : [];

                      return (
                        <div
                          key={d.iso}
                          className="p-2 text-center border-r border-slate-200/70 last:border-r-0 space-y-1"
                        >
                          <div className="text-[10px] font-bold text-slate-500">{d.dayName}</div>
                          <div
                            className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-extrabold ${
                              isToday ? "bg-indigo-600 text-white" : "text-slate-800"
                            }`}
                          >
                            {d.dayNum}
                          </div>
                          {pendingCount > 0 && (
                            <div className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[10px] font-bold truncate">
                              {pendingCount} pending tasks
                            </div>
                          )}
                          {dayEvents.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => onSelectEvent(ev.id)}
                              className="w-full px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold truncate block"
                            >
                              {ev.title}
                            </button>
                          ))}
                          {dayBudgets.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBudget(b)}
                              className="w-full px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold truncate block"
                            >
                              💰 {b.item_name.split("\n")[0]}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hourly Time Grid */}
                  <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 relative">
                    {HOURS.map((hour) => {
                      const isCurrentHour = hour === nowHour;
                      return (
                        <div key={hour} className="grid grid-cols-8 min-h-[52px] relative">
                          <div className="p-1.5 text-[10px] font-mono text-slate-400 text-right pr-2 border-r border-slate-200">
                            {String(hour).padStart(2, "0")}:00
                          </div>
                          {weekDays.map((d) => {
                            const isToday = d.iso === todayIso;
                            const hourTasks =
                              showTasks && hour === 9
                                ? filteredTasks.filter((t) => t.due_date === d.iso)
                                : [];
                            const hourRundown =
                              showRundown && d.iso === activeEvent.event_date
                                ? items.filter((it) => {
                                    const h = Number((it.planned_start_time || "").split(":")[0]);
                                    return h === hour;
                                  })
                                : [];

                            return (
                              <div
                                key={`${d.iso}-${hour}`}
                                className="p-1 border-r border-slate-100 last:border-r-0 space-y-1 relative"
                              >
                                {isToday && isCurrentHour && (
                                  <div
                                    style={{ top: `${Math.min(90, (nowMinutes / 60) * 100)}%` }}
                                    className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                                  >
                                    <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
                                    <div className="h-[2px] flex-1 bg-rose-500" />
                                  </div>
                                )}
                                {hourTasks.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setSelectedTask(t)}
                                    className={`w-full text-left px-2 py-1 rounded-md text-[10px] font-bold truncate flex items-center gap-1 ${
                                      t.status === "DONE"
                                        ? "bg-emerald-100 text-emerald-800 line-through"
                                        : "bg-sky-500 text-white"
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{t.title}</span>
                                  </button>
                                ))}
                                {hourRundown.map((it) => (
                                  <div
                                    key={it.id}
                                    className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-semibold truncate"
                                  >
                                    {it.planned_start_time} {it.title}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 pb-2">
                {DAY_LABELS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((d) => {
                  const dayTasks = showTasks
                    ? filteredTasks.filter((t) => t.due_date === d.iso)
                    : [];
                  const dayEvents = showEvents
                    ? events.filter((ev) => ev.event_date === d.iso)
                    : [];
                  const dayBudgets =
                    showBudgets && canViewBudgetSchedule
                      ? scheduledBudgets.filter((b) => b.required_date === d.iso)
                      : [];
                  return (
                    <div
                      key={d.iso}
                      className={`min-h-[82px] p-1.5 rounded-xl border text-left space-y-1 ${
                        d.iso === todayIso
                          ? "bg-indigo-50/70 border-indigo-300"
                          : d.inMonth
                          ? "bg-white border-slate-200"
                          : "bg-slate-50 border-slate-100 opacity-60"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-700">{d.dayNum}</div>
                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onSelectEvent(ev.id)}
                          className="w-full text-left px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold truncate"
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayTasks.slice(0, 2).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTask(t)}
                          className="w-full text-left px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-semibold truncate"
                        >
                          {t.title}
                        </button>
                      ))}
                      {dayBudgets.slice(0, 2).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBudget(b)}
                          className="w-full text-left px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold truncate"
                        >
                          💰 {b.item_name.split("\n")[0]}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || "Detail Task"}
      >
        {selectedTask && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={selectedTask.status === "DONE" ? "emerald" : "cyan"}>
                {selectedTask.status}
              </Badge>
              {selectedTask.due_date && (
                <span className="text-xs font-mono text-slate-500 inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedTask.due_date}
                </span>
              )}
            </div>
            {selectedTask.description && (
              <p className="text-xs text-slate-600">{selectedTask.description}</p>
            )}
            <Button
              size="md"
              variant={selectedTask.status === "DONE" ? "outline" : "emerald"}
              onClick={() => {
                const nextStatus = selectedTask.status === "DONE" ? "IN_PROGRESS" : "DONE";
                onUpdateTask(selectedTask.id, { status: nextStatus });
                setSelectedTask({ ...selectedTask, status: nextStatus });
              }}
              className="w-full font-bold"
            >
              {selectedTask.status === "DONE" ? "Batal Selesai" : "Tandai Selesai"}
            </Button>
          </div>
        )}
      </Modal>

      {/* Budget Schedule Detail Modal */}
      <Modal
        isOpen={!!selectedBudget}
        onClose={() => setSelectedBudget(null)}
        title="Jadwal Pembiayaan / Belanja"
        description={
          selectedBudget?.required_date
            ? `Tanggal Diperlukan: ${selectedBudget.required_date}`
            : undefined
        }
      >
        {selectedBudget && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="emerald" className="gap-1">
                <Wallet className="w-3 h-3" />
                {selectedBudget.section}
              </Badge>
              {selectedBudget.budget_status && (
                <Badge variant="purple">{selectedBudget.budget_status}</Badge>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 whitespace-pre-line font-semibold text-slate-900">
              {selectedBudget.item_name}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 p-2.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Kuantitas</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {selectedBudget.quantity ?? 1} {selectedBudget.uom || "Set"}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Total Estimasi</div>
                <div className="font-mono font-extrabold text-emerald-700 mt-0.5">
                  {formatCurrencyIDR(selectedBudget.estimated_amount)}
                </div>
              </div>
            </div>
            {selectedBudget.notes && (
              <p className="text-slate-600 leading-relaxed">{selectedBudget.notes}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Quick Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Jadwal / Task"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Judul task atau agenda..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm text-slate-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
            />
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value as SectionType)}
              disabled={allowedSections.length === 1}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {allowedSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
          <select
            value={newEventId}
            onChange={(e) => setNewEventId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
          <select
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
          >
            <option value="">-- Pilih PIC --</option>
            {sectionUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <Button size="lg" variant="primary" onClick={handleCreateQuickTask} className="w-full font-bold">
            Simpan ke Kalender
          </Button>
        </div>
      </Modal>
    </div>
  );
}
