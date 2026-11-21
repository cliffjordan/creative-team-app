"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Search,
  UserCheck,
  Radio,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { INITIAL_ROSTER, INITIAL_USERS, canUserAccessEvent, isCreativeLeader } from "@/lib/mock-db";
import { subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import type {
  Event,
  EventRosterMember,
  EventStatus,
  TimelineTask,
  User,
} from "@/types/domain";
import type { EventWithLeader } from "@/features/events/actions/event-actions";

interface EventListViewProps {
  initialEvents: EventWithLeader[];
}

const STATUS_TABS: { label: string; value: EventStatus | "ALL" }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Pre-Event", value: "PRE_EVENT" },
  { label: "Event Day", value: "EVENT_DAY" },
  { label: "Post-Event", value: "POST_EVENT" },
  { label: "Selesai", value: "COMPLETED" },
];

const STATUS_BADGE_MAP: Record<
  EventStatus,
  { label: string; variant: "neutral" | "emerald" | "amber" | "crimson" | "cyan" }
> = {
  DRAFT: { label: "DRAFT", variant: "neutral" },
  PRE_EVENT: { label: "PRE-EVENT", variant: "cyan" },
  EVENT_DAY: { label: "LIVE / EVENT DAY", variant: "crimson" },
  POST_EVENT: { label: "POST-EVENT", variant: "amber" },
  COMPLETED: { label: "COMPLETED", variant: "emerald" },
};

function mergeEventsWithLeader(
  serverEvents: EventWithLeader[],
  storedEvents: Event[]
): EventWithLeader[] {
  const byId = new Map<string, EventWithLeader>();
  for (const ev of serverEvents) {
    byId.set(ev.id, ev);
  }
  for (const st of storedEvents) {
    const existing = byId.get(st.id);
    const leaderUser = INITIAL_USERS.find((u) => u.id === st.event_leader_id);
    byId.set(st.id, {
      ...(existing ?? {}),
      ...st,
      event_leader: existing?.event_leader ?? (leaderUser
        ? {
            id: leaderUser.id,
            full_name: leaderUser.full_name,
            base_role: leaderUser.base_role,
            avatar_url: leaderUser.avatar_url,
          }
        : null),
    });
  }
  return Array.from(byId.values());
}

export function EventListView({ initialEvents }: EventListViewProps) {
  const { currentUser, isLoading } = useAuth();
  const [storedUser, setStoredUser] = useState<User | null>(null);
  const effectiveUser = currentUser ?? storedUser;

  const [clientEvents, setClientEvents] = useState<EventWithLeader[]>(initialEvents);
  const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [roster, setRoster] = useState<EventRosterMember[]>(INITIAL_ROSTER);
  const [myTasks, setMyTasks] = useState<TimelineTask[]>([]);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("CT_CURRENT_USER");
      if (savedUser) {
        setStoredUser(JSON.parse(savedUser) as User);
      }
      const savedEvents = localStorage.getItem("CT_EVENTS");
      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents) as Event[];
        if (Array.isArray(parsedEvents)) {
          setClientEvents(mergeEventsWithLeader(initialEvents, parsedEvents));
        }
      }
    } catch {
      // ignore
    }

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_EVENTS" && Array.isArray(msg.payload)) {
        setClientEvents(mergeEventsWithLeader(initialEvents, msg.payload as Event[]));
      }
    });
    return () => unsubscribe();
  }, [initialEvents]);

  useEffect(() => {
    try {
      const savedRoster = localStorage.getItem("CT_ROSTER");
      if (savedRoster) {
        setRoster(JSON.parse(savedRoster) as EventRosterMember[]);
      }
      const savedTasks = localStorage.getItem("CT_TASKS");
      if (savedTasks && effectiveUser) {
        const allTasks = JSON.parse(savedTasks) as TimelineTask[];
        setMyTasks(
          allTasks.filter(
            (t) => t.assigned_to === effectiveUser.id && t.status !== "DONE"
          )
        );
      } else {
        setMyTasks([]);
      }
    } catch {
      // ignore localStorage parse errors
    }
  }, [effectiveUser]);

  const accessibleEvents = useMemo(() => {
    if (!effectiveUser) return clientEvents;
    return clientEvents.filter((ev) =>
      canUserAccessEvent(effectiveUser, ev.id, roster)
    );
  }, [clientEvents, effectiveUser, roster]);

  const myAssignments = useMemo(() => {
    if (!effectiveUser) return [];
    return accessibleEvents
      .map((ev) => {
        const roles = roster.filter(
          (r) => r.event_id === ev.id && r.user_id === effectiveUser.id
        );
        return { event: ev, roles };
      })
      .filter((item) => item.roles.length > 0);
  }, [accessibleEvents, roster, effectiveUser]);

  const filteredEvents = useMemo(() => {
    return accessibleEvents.filter((ev) => {
      const matchesStatus =
        statusFilter === "ALL" || ev.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        ev.title.toLowerCase().includes(q) ||
        ev.theme.toLowerCase().includes(q) ||
        (ev.event_leader?.full_name ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [accessibleEvents, statusFilter, searchQuery]);

  if (isLoading && !effectiveUser) {
    return (
      <Card className="mx-auto max-w-lg bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Memverifikasi sesi...
      </Card>
    );
  }

  if (!isCreativeLeader(effectiveUser)) {
    return (
      <Card className="mx-auto max-w-lg border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          Akses Khusus Creative Leader
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Menu Events &amp; Roster serta pembuatan event baru hanya dapat diakses oleh Creative Leader.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="primary" className="font-semibold">
              Kembali ke Workspace Utama
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Command Center Events
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola seluruh event kreatif, roster panitia, dan kontrol live rundown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" className="font-semibold">
              Workspace Utama
            </Button>
          </Link>
          <Link href="/events/new">
            <Button variant="primary" className="w-full sm:w-auto gap-2 font-semibold">
              <Plus className="h-4 w-4" />
              Buat Event Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* Operasional & Tugas Saya */}
      {effectiveUser && (
        <Card className="border-indigo-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Briefcase className="h-4 w-4" />
                Operasional &amp; Tugas Saya
              </div>
              <p className="text-xs text-slate-500">
                Ringkasan penugasan aktif untuk{" "}
                <span className="text-slate-900 font-semibold">
                  {effectiveUser.full_name}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="purple">
                {myAssignments.length} Event Ditugaskan
              </Badge>
              <Badge variant="amber">
                {myTasks.length} Task Aktif
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Assigned Events */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Jadwal &amp; Peran Event Saya
              </div>
              {myAssignments.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada penugasan event di roster.
                </p>
              ) : (
                <div className="space-y-2">
                  {myAssignments.map(({ event, roles }) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-300 transition"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-900">
                          {event.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3 text-indigo-500" />
                          {new Date(event.event_date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {roles.map((r) => (
                          <Badge key={r.id} variant="neutral" className="text-[10px]">
                            {r.section} · {r.role_in_event}
                          </Badge>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Tasks */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Task Aktif Saya
              </div>
              {myTasks.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Tidak ada task aktif yang tertunda.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {myTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <span className="truncate text-slate-800 font-medium">
                        {task.title}
                      </span>
                      <Badge
                        variant={
                          task.status === "ESCALATED"
                            ? "crimson"
                            : task.status === "IN_PROGRESS"
                            ? "cyan"
                            : "neutral"
                        }
                        className="shrink-0 text-[10px]"
                      >
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, tema, atau leader..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
        </div>
      </Card>

      {/* Event Grid */}
      {filteredEvents.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Belum ada event yang sesuai filter atau akses Anda.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Ubah filter status atau hubungi Event Leader untuk penugasan roster.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((ev) => {
            const badge = STATUS_BADGE_MAP[ev.status];
            const isLive = ev.status === "EVENT_DAY";
            return (
              <Link key={ev.id} href={`/events/${ev.id}`} className="group block">
                <Card
                  glow={isLive ? "crimson" : "none"}
                  className="h-full p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={badge.variant} className="shrink-0">
                      {isLive && (
                        <Radio className="mr-1 inline h-3 w-3 animate-pulse" />
                      )}
                      {badge.label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      {new Date(ev.event_date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {ev.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    Tema: {ev.theme}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="truncate max-w-[160px] font-medium">
                        {ev.event_leader?.full_name ?? "Belum ada leader"}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      Buka
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
