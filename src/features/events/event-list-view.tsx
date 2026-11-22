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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { INITIAL_ROSTER, canUserAccessEvent, isUnassignedMember } from "@/lib/mock-db";
import type {
  EventRosterMember,
  EventStatus,
  TimelineTask,
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

export function EventListView({ initialEvents }: EventListViewProps) {
  const { currentUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [roster, setRoster] = useState<EventRosterMember[]>(INITIAL_ROSTER);
  const [myTasks, setMyTasks] = useState<TimelineTask[]>([]);

  useEffect(() => {
    try {
      const savedRoster = localStorage.getItem("CT_ROSTER");
      if (savedRoster) {
        setRoster(JSON.parse(savedRoster) as EventRosterMember[]);
      }
      const savedTasks = localStorage.getItem("CT_TASKS");
      if (savedTasks && currentUser) {
        const allTasks = JSON.parse(savedTasks) as TimelineTask[];
        setMyTasks(
          allTasks.filter(
            (t) => t.assigned_to === currentUser.id && t.status !== "DONE"
          )
        );
      } else {
        setMyTasks([]);
      }
    } catch {
      // ignore localStorage parse errors
    }
  }, [currentUser]);

  const accessibleEvents = useMemo(() => {
    if (!currentUser) return initialEvents;
    return initialEvents.filter((ev) =>
      canUserAccessEvent(currentUser, ev.id, roster)
    );
  }, [initialEvents, currentUser, roster]);

  const myAssignments = useMemo(() => {
    if (!currentUser) return [];
    return accessibleEvents
      .map((ev) => {
        const roles = roster.filter(
          (r) => r.event_id === ev.id && r.user_id === currentUser.id
        );
        return { event: ev, roles };
      })
      .filter((item) => item.roles.length > 0);
  }, [accessibleEvents, roster, currentUser]);

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

  return (
    <div className="space-y-6">
      {isUnassignedMember(currentUser) ? (
        <Card className="max-w-md mx-auto p-8 text-center space-y-3 border-slate-200">
          <h2 className="text-base font-extrabold text-slate-900">Akses Events &amp; Roster Terkunci</h2>
          <p className="text-xs text-slate-500">
            Akun Anda berstatus Member Umum yang menunggu penugasan role/divisi oleh Creative Leader.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
          >
            Kembali ke Workspace
          </Link>
        </Card>
      ) : (
        <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Command Center Events
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Kelola seluruh event kreatif, roster panitia, dan kontrol live rundown.
          </p>
        </div>
        <Link href="/events/new">
          <Button className="w-full sm:w-auto gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold shadow-[0_0_20px_rgba(34,211,238,0.25)]">
            <Plus className="h-4 w-4" />
            Buat Event Baru
          </Button>
        </Link>
      </div>

      {/* Operasional & Tugas Saya */}
      {currentUser && (
        <Card className="border-cyan-500/30 bg-[#131B2E]/95 p-5 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                <Briefcase className="h-4 w-4" />
                Operasional &amp; Tugas Saya
              </div>
              <p className="text-xs text-slate-400">
                Ringkasan penugasan aktif untuk{" "}
                <span className="text-slate-200 font-medium">
                  {currentUser.full_name}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="cyan">
                {myAssignments.length} Event Ditugaskan
              </Badge>
              <Badge variant="amber">
                {myTasks.length} Task Aktif
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Assigned Events */}
            <div className="rounded-lg border border-slate-800 bg-[#0B0F19]/80 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Jadwal &amp; Peran Event Saya
              </div>
              {myAssignments.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada penugasan event di roster.
                </p>
              ) : (
                <div className="space-y-2">
                  {myAssignments.map(({ event, roles }) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-[#131B2E]/70 px-3 py-2 hover:border-cyan-500/40 transition"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-100">
                          {event.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3 text-cyan-400" />
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
                            {r.section} • {r.role_in_event}
                          </Badge>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Tasks */}
            <div className="rounded-lg border border-slate-800 bg-[#0B0F19]/80 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Task Aktif Saya
              </div>
              {myTasks.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Tidak ada task aktif yang tertunda.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {myTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-[#131B2E]/70 px-3 py-2 text-xs"
                    >
                      <span className="truncate text-slate-200">
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
      <Card className="border-slate-800/80 bg-[#131B2E]/90 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                      : "bg-[#0B0F19] text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, tema, atau leader..."
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F19] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>
        </div>
      </Card>

      {/* Event Grid */}
      {filteredEvents.length === 0 ? (
        <Card className="border-slate-800/80 bg-[#131B2E]/70 p-10 text-center">
          <p className="text-sm font-medium text-slate-300">
            Belum ada event yang sesuai filter atau akses Anda.
          </p>
          <p className="mt-1 text-xs text-slate-500">
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
                  className={`h-full border bg-[#131B2E] p-5 transition-all duration-200 hover:-translate-y-0.5 ${
                    isLive
                      ? "border-rose-500/50 shadow-[0_0_24px_rgba(244,63,94,0.15)] hover:border-rose-400"
                      : "border-slate-800/90 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={badge.variant} className="shrink-0">
                      {isLive && (
                        <Radio className="mr-1 inline h-3 w-3 animate-pulse" />
                      )}
                      {badge.label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                      {new Date(ev.event_date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {ev.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    Tema: {ev.theme}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="truncate max-w-[160px]">
                        {ev.event_leader?.full_name ?? "Belum ada leader"}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-medium text-cyan-400 group-hover:translate-x-0.5 transition-transform">
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
        </>
      )}
    </div>
  );
}
