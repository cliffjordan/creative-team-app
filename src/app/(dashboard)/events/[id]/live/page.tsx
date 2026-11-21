"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { useAuth } from "@/providers/auth-provider";
import { LiveStageView } from "@/features/live-rundown/live-stage-view";
import {
  INITIAL_EVENT,
  INITIAL_RUNDOWN_ITEMS,
  INITIAL_LIVE_LOGS,
  INITIAL_USERS,
} from "@/lib/mock-db";
import type { Event, LiveLog, RundownItem } from "@/types/domain";

export default function EventLivePage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? INITIAL_EVENT.id;
  const { currentUser } = useAuth();

  const [event, setEvent] = useState<Event>({
    ...INITIAL_EVENT,
    id: eventId,
  });
  const [items, setItems] = useState<RundownItem[]>(INITIAL_RUNDOWN_ITEMS);
  const [logs, setLogs] = useState<LiveLog[]>(INITIAL_LIVE_LOGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedEvent = localStorage.getItem("CT_EVENT");
      if (savedEvent) {
        const parsed = JSON.parse(savedEvent) as Event;
        setEvent({ ...parsed, id: eventId });
      }
      const savedItems = localStorage.getItem("CT_ITEMS");
      if (savedItems) {
        setItems(JSON.parse(savedItems) as RundownItem[]);
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

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_EVENT" && msg.payload) {
        setEvent(msg.payload as Event);
      } else if (msg.key === "CT_ITEMS" && Array.isArray(msg.payload)) {
        setItems(msg.payload as RundownItem[]);
      } else if (msg.key === "CT_LOGS" && Array.isArray(msg.payload)) {
        setLogs(msg.payload as LiveLog[]);
      }
    });
    return () => unsubscribe();
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
      localStorage.setItem("CT_ITEMS", JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("CT_LOGS", JSON.stringify(logs));
    } catch {}
  }, [logs, hydrated]);

  const handleUpdateEvent = (updated: Partial<Event>) => {
    setEvent((prev) => {
      const next = { ...prev, ...updated };
      publishSyncMessage("CT_EVENT", next);
      return next;
    });
  };

  const handleUpdateItems = (nextItems: RundownItem[]) => {
    setItems(nextItems);
    publishSyncMessage("CT_ITEMS", nextItems);
  };

  const handleAddLog = (log: Omit<LiveLog, "id" | "created_at">): LiveLog => {
    const newLog: LiveLog = {
      ...log,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setLogs((prev) => {
      const next = [newLog, ...prev];
      publishSyncMessage("CT_LOGS", next);
      return next;
    });
    return newLog;
  };

  const handleDeleteLog = (logId: string) => {
    setLogs((prev) => {
      const next = prev.filter((l) => l.id !== logId);
      publishSyncMessage("CT_LOGS", next);
      return next;
    });
  };

  return (
    <RealtimeProvider eventId={eventId}>
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

          <LiveStageView
            event={event}
            items={items}
            logs={logs}
            currentUser={currentUser ?? INITIAL_USERS[0] ?? null}
            onUpdateEvent={handleUpdateEvent}
            onUpdateItems={handleUpdateItems}
            onAddLog={handleAddLog}
            onDeleteLog={handleDeleteLog}
          />
        </div>
      </div>
    </RealtimeProvider>
  );
}
