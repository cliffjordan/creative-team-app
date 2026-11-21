"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { RundownBuilderView } from "@/features/rundown-builder/rundown-builder-view";
import {
  INITIAL_EVENT,
  INITIAL_EVENTS,
  INITIAL_ROSTER,
  INITIAL_RUNDOWN_ITEMS,
  INITIAL_USERS,
  canUserAccessEvent,
  getSectionAccessMode,
} from "@/lib/mock-db";
import type { EventRosterMember, RundownItem } from "@/types/domain";

export default function EventRundownPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? INITIAL_EVENT.id;
  const { currentUser, users } = useAuth();

  const [items, setItems] = useState<RundownItem[]>(INITIAL_RUNDOWN_ITEMS);
  const [roster, setRoster] = useState<EventRosterMember[]>(INITIAL_ROSTER);
  const [hydrated, setHydrated] = useState(false);

  const event =
    INITIAL_EVENTS.find((ev) => ev.id === eventId) ?? {
      ...INITIAL_EVENT,
      id: eventId,
    };

  useEffect(() => {
    try {
      const savedItems = localStorage.getItem("CT_ITEMS");
      if (savedItems) {
        setItems(JSON.parse(savedItems) as RundownItem[]);
      }
      const savedRoster = localStorage.getItem("CT_ROSTER");
      if (savedRoster) {
        setRoster(JSON.parse(savedRoster) as EventRosterMember[]);
      }
    } catch {
      // ignore localStorage parse errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("CT_ITEMS", JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const acaraAccess = getSectionAccessMode(currentUser, event, roster, "ACARA");
  const hasAccess = canUserAccessEvent(currentUser, eventId, roster) && acaraAccess !== "LOCKED";

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 flex items-center justify-center">
        <Card className="max-w-md w-full border-rose-200 bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">Akses Ditolak</h1>
          <p className="text-xs text-slate-500">
            Anda tidak terdaftar di roster event ini. Hubungi Event Leader atau
            Creative Leader untuk mendapatkan akses.
          </p>
          <Link href="/events" className="inline-block">
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Event
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

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

        <RundownBuilderView
          items={items}
          users={users.length > 0 ? users : INITIAL_USERS}
          onUpdateItems={setItems}
          eventTitle={event.title}
          eventId={eventId}
          isLocked={acaraAccess === "MONITOR" || event.status === "EVENT_DAY"}
        />
      </div>
    </div>
  );
}
