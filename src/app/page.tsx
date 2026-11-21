"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CalendarDays, Plus } from "lucide-react";
import {
  User,
  Event,
  RundownItem,
  LiveLog,
  TimelineTask,
  EventRosterMember,
} from "@/types/domain";
import {
  INITIAL_EVENT,
  INITIAL_EVENTS,
  INITIAL_ROSTER,
  INITIAL_RUNDOWN_ITEMS,
  INITIAL_LIVE_LOGS,
  canUserAccessEvent,
  isCreativeLeader,
} from "@/lib/mock-db";
import { getEventsAction } from "@/features/events/actions/event-actions";
import { Header } from "@/components/layout/header";
import { InactivityTimeout } from "@/components/layout/inactivity-timeout";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav, TabType } from "@/components/layout/bottom-nav";
import { BrandLogo } from "@/components/ui/brand-logo";
import { HomeDashboardView } from "@/features/dashboard/home-dashboard-view";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { useAuth } from "@/providers/auth-provider";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";

function TabSkeleton() {
  return (
    <div className="min-h-[460px] space-y-4 animate-pulse">
      <div className="h-36 rounded-3xl bg-slate-200/70" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl bg-slate-200/60" />
        <div className="h-48 rounded-2xl bg-slate-200/60" />
      </div>
      <div className="h-28 rounded-2xl bg-slate-200/50" />
    </div>
  );
}

const LiveStageView = dynamic(
  () => import("@/features/live-rundown/live-stage-view").then((m) => m.LiveStageView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const RundownBuilderView = dynamic(
  () => import("@/features/rundown-builder/rundown-builder-view").then((m) => m.RundownBuilderView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const SectionsView = dynamic(
  () => import("@/features/sections/sections-view").then((m) => m.SectionsView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const TimelineView = dynamic(
  () => import("@/features/timeline/timeline-view").then((m) => m.TimelineView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const CalendarView = dynamic(
  () => import("@/features/calendar/calendar-view").then((m) => m.CalendarView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const FinanceView = dynamic(
  () => import("@/features/finance/finance-view").then((m) => m.FinanceView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const MeetingNotesView = dynamic(
  () => import("@/features/meeting-notes/meeting-notes-view").then((m) => m.MeetingNotesView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const ProposalBuilderView = dynamic(
  () => import("@/features/proposal/proposal-builder-view").then((m) => m.ProposalBuilderView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const EvaluationView = dynamic(
  () => import("@/features/evaluation/evaluation-view").then((m) => m.EvaluationView),
  { ssr: false, loading: () => <TabSkeleton /> }
);

const ImmersiveLandingView = dynamic(
  () => import("@/features/landing/immersive-landing-view").then((m) => m.ImmersiveLandingView),
  { ssr: false }
);

const PinLoginModal = dynamic(
  () => import("@/features/auth/pin-login-modal").then((m) => m.PinLoginModal),
  { ssr: false, loading: () => null }
);

export default function Home() {
  const {
    currentUser: authUser,
    users: authUsers,
    isLoading: isAuthLoading,
    setCurrentUserDirect,
    logout: authLogout,
  } = useAuth();
  // Active Tab defaults to Home Dashboard
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Core App State (No auto-login default user; synchronized with AuthProvider)
  const users = authUsers;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [roster, setRoster] = useState<EventRosterMember[]>(INITIAL_ROSTER);
  const [event, setEvent] = useState<Event>(INITIAL_EVENT);
  const [items, setItems] = useState<RundownItem[]>(INITIAL_RUNDOWN_ITEMS);
  const [logs, setLogs] = useState<LiveLog[]>(INITIAL_LIVE_LOGS);

  const [tasks, setTasks] = useState<TimelineTask[]>([]);

  // Login Modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sync Home currentUser directly with AuthProvider
  useEffect(() => {
    setCurrentUser(authUser);
  }, [authUser]);

  // Load / Persist state to localStorage for offline resilience
  useEffect(() => {
    try {
      const savedEvent = localStorage.getItem("CT_EVENT");
      if (savedEvent) setEvent(JSON.parse(savedEvent));

      const savedEvents = localStorage.getItem("CT_EVENTS");
      if (savedEvents) setEvents(JSON.parse(savedEvents));

      const savedRoster = localStorage.getItem("CT_ROSTER");
      if (savedRoster) setRoster(JSON.parse(savedRoster));

      const savedItems = localStorage.getItem("CT_ITEMS");
      if (savedItems) setItems(JSON.parse(savedItems));

      const savedLogs = localStorage.getItem("CT_LOGS");
      if (savedLogs) setLogs(JSON.parse(savedLogs));

      const savedTasks = localStorage.getItem("CT_TASKS");
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks) as TimelineTask[];
        const normalizedTasks = parsedTasks.map((t) =>
          t.assigned_to && t.assigned_to.startsWith("00000000-0000-0000-0000-")
            ? { ...t, assigned_to: t.assigned_to.replace("00000000-0000-0000-0000-", "00000000-0000-4000-8000-") }
            : t
        );
        setTasks(normalizedTasks);
      }
    } catch {
      // Ignore if localStorage unavailable
    }

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_EVENT" && msg.payload) {
        setEvent(msg.payload as Event);
      } else if (msg.key === "CT_EVENTS" && Array.isArray(msg.payload)) {
        setEvents(msg.payload as Event[]);
      } else if (msg.key === "CT_ROSTER" && Array.isArray(msg.payload)) {
        setRoster(msg.payload as EventRosterMember[]);
      } else if (msg.key === "CT_ITEMS" && Array.isArray(msg.payload)) {
        setItems(msg.payload as RundownItem[]);
      } else if (msg.key === "CT_LOGS" && Array.isArray(msg.payload)) {
        setLogs(msg.payload as LiveLog[]);
      } else if (msg.key === "CT_TASKS" && Array.isArray(msg.payload)) {
        setTasks(msg.payload as TimelineTask[]);
      }
    });

    return () => {
      unsubscribe();
    };
    // Sync real events from Supabase/server action
    getEventsAction()
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setEvents(res.data);
          setEvent((prev) => (prev.id ? prev : res.data![0]));
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateEvent = (updated: Partial<Event>) => {
    setEvent((prev) => {
      const next = { ...prev, ...updated, updated_at: new Date().toISOString() };
      try {
        localStorage.setItem("CT_EVENT", JSON.stringify(next));
      } catch {}
      publishSyncMessage("CT_EVENT", next);
      setEvents((prevEvents) => {
        const nextEvents = prevEvents.map((ev) => (ev.id === next.id ? next : ev));
        try {
          localStorage.setItem("CT_EVENTS", JSON.stringify(nextEvents));
        } catch {}
        publishSyncMessage("CT_EVENTS", nextEvents);
        return nextEvents;
      });
      return next;
    });
  };

  const handleUpdateItems = (newItems: RundownItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem("CT_ITEMS", JSON.stringify(newItems));
    } catch {}
    publishSyncMessage("CT_ITEMS", newItems);
  };

  const handleAddLog = (logData: Omit<LiveLog, "id" | "created_at">): LiveLog => {
    const newLog: LiveLog = {
      ...logData,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setLogs((prev) => {
      const nextLogs = [newLog, ...prev];
      try {
        localStorage.setItem("CT_LOGS", JSON.stringify(nextLogs));
      } catch {}
      publishSyncMessage("CT_LOGS", nextLogs);
      return nextLogs;
    });
    return newLog;
  };

  const handleDeleteLog = (logId: string) => {
    setLogs((prev) => {
      const nextLogs = prev.filter((l) => l.id !== logId);
      try {
        localStorage.setItem("CT_LOGS", JSON.stringify(nextLogs));
      } catch {}
      publishSyncMessage("CT_LOGS", nextLogs);
      return nextLogs;
    });
  };

  const handleUpdateLog = (logId: string, updated: Partial<LiveLog>) => {
    setLogs((prev) => {
      const nextLogs = prev.map((l) => (l.id === logId ? { ...l, ...updated } : l));
      try {
        localStorage.setItem("CT_LOGS", JSON.stringify(nextLogs));
      } catch {}
      publishSyncMessage("CT_LOGS", nextLogs);
      return nextLogs;
    });
  };

  const handleUpdateTask = (taskId: string, updated: Partial<TimelineTask>) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, ...updated, updated_at: new Date().toISOString() } : t
      );
      try {
        localStorage.setItem("CT_TASKS", JSON.stringify(next));
      } catch {}
      publishSyncMessage("CT_TASKS", next);
      return next;
    });
  };

  const handleAddTask = (taskData: Omit<TimelineTask, "id" | "created_at" | "updated_at">) => {
    const newTask: TimelineTask = {
      ...taskData,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => {
      const next = [newTask, ...prev];
      try {
        localStorage.setItem("CT_TASKS", JSON.stringify(next));
      } catch {}
      publishSyncMessage("CT_TASKS", next);
      return next;
    });
  };

  const handleSuccessLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentUserDirect(user);
    try {
      localStorage.setItem("CT_CURRENT_USER", JSON.stringify(user));
    } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("home");
    setIsLoginModalOpen(false);
    void authLogout();
    try {
      localStorage.removeItem("CT_CURRENT_USER");
    } catch {}
  };

  const eventLogs = useMemo(
    () => logs.filter((l) => (l.event_id || INITIAL_EVENT.id) === event.id),
    [logs, event.id]
  );

  const openIncidentsCount = eventLogs.filter((l) => l.status === "OPEN").length;

  const accessibleEvents = events.filter((ev) => canUserAccessEvent(currentUser, ev.id, roster));

  useEffect(() => {
    if (accessibleEvents.length > 0 && !accessibleEvents.some((ev) => ev.id === event.id)) {
      setEvent(accessibleEvents[0]);
      try {
        localStorage.setItem("CT_EVENT", JSON.stringify(accessibleEvents[0]));
      } catch {}
    }
  }, [accessibleEvents, event.id]);

  const handleSelectEvent = (eventId: string) => {
    const found = accessibleEvents.find((ev) => ev.id === eventId);
    if (found) {
      setEvent(found);
      try {
        localStorage.setItem("CT_EVENT", JSON.stringify(found));
      } catch {}
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 gap-4">
        <BrandLogo size="lg" />
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
          <span>Memuat Creative Team OS...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ImmersiveLandingView onOpenLogin={() => setIsLoginModalOpen(true)} />
        <PinLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          users={users}
          onSuccessLogin={handleSuccessLogin}
        />
      </>
    );
  }

  return (
    <RealtimeProvider eventId={event.id}>
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      <InactivityTimeout disabled={activeTab === "live" && !!event.live_started_at && !event.live_ended_at} />

      {/* Desktop Left Sidebar */}
      <SidebarNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        openIncidentsCount={openIncidentsCount}
        currentUser={currentUser}
        activeEvent={event}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          currentUser={currentUser}
          activeEvent={event}
          events={accessibleEvents}
          roster={roster}
          onSelectEvent={handleSelectEvent}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full pb-24 lg:pb-10">
          {accessibleEvents.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4 mt-8 max-w-md mx-auto animate-tab-enter">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <CalendarDays className="w-6 h-6" />
              </div>
              {isCreativeLeader(currentUser) ? (
                <>
                  <div className="space-y-1.5">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Belum Ada Event Terdaftar
                    </h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Database event masih kosong. Buat event pertama Anda untuk mulai menyusun rundown,
                      roster panitia, anggaran, dan jadwal pelayanan.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                    <Link
                      href="/events/new"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-sm hover:opacity-95 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Buat Event Pertama</span>
                    </Link>
                    <Link
                      href="/events"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                    >
                      <span>Buka Command Center</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Belum Ada Event Aktif
                  </h2>
                  <p className="text-xs text-slate-500">
                    Saat ini belum ada event yang dijadwalkan atau ditugaskan kepada Anda. Silakan hubungi Creative Leader.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div key={`${activeTab}-${event.id}`} className="animate-tab-enter">
              {activeTab === "home" && (
                <HomeDashboardView
                  currentUser={currentUser}
                  activeEvent={event}
                  accessibleEvents={accessibleEvents}
                  roster={roster}
                  items={items}
                  logs={eventLogs}
                  tasks={tasks}
                  users={users}
                  onSelectEvent={handleSelectEvent}
                  onChangeTab={setActiveTab}
                  onUpdateTask={handleUpdateTask}
                />
              )}

              {activeTab === "live" && (
                <LiveStageView
                  event={event}
                  items={items}
                  logs={eventLogs}
                  currentUser={currentUser}
                  roster={roster}
                  onUpdateEvent={handleUpdateEvent}
                  onUpdateItems={handleUpdateItems}
                  onAddLog={handleAddLog}
                  onDeleteLog={handleDeleteLog}
                />
              )}

              {activeTab === "sections" && (
                <SectionsView
                  users={users}
                  currentUser={currentUser}
                  activeEvent={event}
                  roster={roster}
                  items={items}
                  onUpdateItems={handleUpdateItems}
                  isRundownLocked={event.status === "EVENT_DAY" && !!event.live_started_at && !event.live_ended_at}
                />
              )}

              {activeTab === "timeline" && (
                <TimelineView
                  tasks={tasks}
                  users={users}
                  currentUser={currentUser}
                  events={accessibleEvents}
                  activeEvent={event}
                  roster={roster}
                  onSelectEvent={handleSelectEvent}
                  onUpdateTask={handleUpdateTask}
                  onAddTask={handleAddTask}
                />
              )}

              {activeTab === "calendar" && (
                <CalendarView
                  events={accessibleEvents}
                  activeEvent={event}
                  tasks={tasks}
                  items={items}
                  users={users}
                  currentUser={currentUser}
                  roster={roster}
                  onSelectEvent={handleSelectEvent}
                  onUpdateTask={handleUpdateTask}
                  onAddTask={handleAddTask}
                />
              )}

              {activeTab === "finance" && (
                <FinanceView currentUser={currentUser} activeEvent={event} />
              )}

              {activeTab === "notes" && (
                <MeetingNotesView users={users} currentUser={currentUser} activeEvent={event} />
              )}

              {activeTab === "proposal" && (
                <ProposalBuilderView activeEvent={event} items={items} />
              )}

              {activeTab === "evaluation" && (
                <EvaluationView
                  event={event}
                  events={accessibleEvents}
                  logs={eventLogs}
                  users={users}
                  currentUser={currentUser}
                  onUpdateLog={handleUpdateLog}
                  onUpdateEvent={handleUpdateEvent}
                  onSelectEvent={handleSelectEvent}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        openIncidentsCount={openIncidentsCount}
        currentUser={currentUser}
        activeEvent={event}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* PIN Login Dialog */}
      <PinLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        onSuccessLogin={handleSuccessLogin}
      />
    </div>
    </RealtimeProvider>
  );
}
