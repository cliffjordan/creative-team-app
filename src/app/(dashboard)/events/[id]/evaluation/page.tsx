"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { EvaluationView } from "@/features/evaluation/evaluation-view";
import {
  INITIAL_EVENT,
  INITIAL_LIVE_LOGS,
  INITIAL_USERS,
} from "@/lib/mock-db";
import type { Event, LiveLog } from "@/types/domain";

export default function EventEvaluationPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? INITIAL_EVENT.id;
  const { currentUser, users } = useAuth();

  const [event, setEvent] = useState<Event>({ ...INITIAL_EVENT, id: eventId });
  const [logs, setLogs] = useState<LiveLog[]>(INITIAL_LIVE_LOGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedEvent = localStorage.getItem("CT_EVENT");
      if (savedEvent) {
        const parsed = JSON.parse(savedEvent) as Event;
        setEvent({ ...parsed, id: eventId });
      }
      const savedLogs = localStorage.getItem("CT_LOGS");
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs) as LiveLog[]);
      }
    } catch {
      // ignore localStorage parse errors
    } finally {
      setHydrated(true);
    }
  }, [eventId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("CT_EVENT", JSON.stringify(event));
    } catch {}
  }, [event, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("CT_LOGS", JSON.stringify(logs));
    } catch {}
  }, [logs, hydrated]);

  const handleUpdateLog = (logId: string, updated: Partial<LiveLog>) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, ...updated } : l))
    );
  };

  const handleUpdateEvent = (updated: Partial<Event>) => {
    setEvent((prev) => ({ ...prev, ...updated }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/events/${eventId}`}>
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Detail Event
            </Button>
          </Link>
        </div>

        <EvaluationView
          event={event}
          logs={logs}
          users={users.length > 0 ? users : INITIAL_USERS}
          currentUser={currentUser ?? INITIAL_USERS[0] ?? null}
          onUpdateLog={handleUpdateLog}
          onUpdateEvent={handleUpdateEvent}
        />
      </div>
    </div>
  );
}
