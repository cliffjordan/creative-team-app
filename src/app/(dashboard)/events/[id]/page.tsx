import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Radio,
  UserCheck,
  ListChecks,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEventDetailAction } from "@/features/events/actions/event-actions";
import { RosterManagerView } from "@/features/roster/roster-manager-view";
import type { EventStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getEventDetailAction(id);

  if (!res.success || !res.data) {
    notFound();
  }

  const { event, roster, users } = res.data;
  const badge = STATUS_BADGE_MAP[event.status];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 animate-tab-enter">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/events">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Semua Event
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/events/${event.id}/rundown`}>
              <Button variant="primary" className="gap-1.5 font-semibold">
                <ListChecks className="h-4 w-4" />
                Build Rundown
              </Button>
            </Link>
            <Link href={`/events/${event.id}/live`}>
              <Button variant="crimson" className="gap-1.5 font-semibold">
                <Radio className="h-4 w-4" />
                Live Rundown
              </Button>
            </Link>
            <Link href={`/events/${event.id}/evaluation`}>
              <Button variant="outline" className="gap-1.5">
                <ListChecks className="h-4 w-4 text-indigo-600" />
                Evaluasi
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="gap-1.5">
                <Layers className="h-4 w-4 text-emerald-600" />
                Workspace Utama
              </Button>
            </Link>
          </div>
        </div>

        {/* Event Summary Card */}
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-slate-400 font-mono">
                  ID: {event.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                {event.title}
              </h1>
              <p className="text-sm text-slate-500">Tema: {event.theme}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:text-right">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>
                  {new Date(event.event_date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  Leader: {event.event_leader?.full_name ?? "Belum ditentukan"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Toleransi Rundown: {event.time_tolerance_seconds}s</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Roster Manager */}
        <RosterManagerView
          eventId={event.id}
          initialRoster={roster}
          users={users}
        />
      </div>
    </div>
  );
}
