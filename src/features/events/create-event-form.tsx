"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Sparkles, Clock, UserCheck, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import {
  INITIAL_EVENTS,
  INITIAL_ROSTER,
  INITIAL_USERS,
  isCreativeLeader,
} from "@/lib/mock-db";
import { publishSyncMessage } from "@/lib/sync/realtime-bus";
import { CreateEventSchema } from "@/lib/validators/schemas";
import { createEventAction } from "@/features/events/actions/event-actions";
import type { Event, EventRosterMember, User } from "@/types/domain";

interface CreateEventFormProps {
  users: Pick<User, "id" | "full_name" | "base_role">[];
}

export function CreateEventForm({ users }: CreateEventFormProps) {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();
  const [storedUser, setStoredUser] = useState<User | null>(null);
  const effectiveUser = currentUser ?? storedUser;

  const availableUsers = users.length > 0 ? users : INITIAL_USERS;

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLeaderId, setEventLeaderId] = useState(availableUsers[0]?.id ?? "");
  const [timeTolerance, setTimeTolerance] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("CT_CURRENT_USER");
      if (savedUser) {
        setStoredUser(JSON.parse(savedUser) as User);
      }
    } catch {
      // ignore
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      title: title.trim(),
      theme: theme.trim(),
      event_date: eventDate,
      event_leader_id: eventLeaderId,
      time_tolerance_seconds: Number(timeTolerance),
    };

    const parsed = CreateEventSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa kembali input form");
      return;
    }

    setSubmitting(true);
    const res = await createEventAction(parsed.data);
    setSubmitting(false);

    if (!res.success || !res.data) {
      setError(res.error ?? "Gagal membuat event");
      return;
    }

    const createdEvent = res.data;
    try {
      const savedEvents = localStorage.getItem("CT_EVENTS");
      const currentEvents = savedEvents
        ? (JSON.parse(savedEvents) as Event[])
        : INITIAL_EVENTS;
      const nextEvents = [
        createdEvent,
        ...currentEvents.filter((ev) => ev.id !== createdEvent.id),
      ];
      localStorage.setItem("CT_EVENTS", JSON.stringify(nextEvents));
      publishSyncMessage("CT_EVENTS", nextEvents);

      const savedRoster = localStorage.getItem("CT_ROSTER");
      const currentRoster = savedRoster
        ? (JSON.parse(savedRoster) as EventRosterMember[])
        : INITIAL_ROSTER;
      const newRosterEntry: EventRosterMember = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `ros-${Date.now()}`,
        event_id: createdEvent.id,
        user_id: parsed.data.event_leader_id,
        section: "INTI",
        role_in_event: "EVENT_LEADER",
        is_co_controller: false,
      };
      const nextRoster = [newRosterEntry, ...currentRoster];
      localStorage.setItem("CT_ROSTER", JSON.stringify(nextRoster));
      publishSyncMessage("CT_ROSTER", nextRoster);
    } catch {
      // ignore localStorage sync errors
    }

    router.push(`/events/${res.data.id}`);
    router.refresh();
  }

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
          Pembuatan event baru hanya dapat diakses oleh Creative Leader.
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/events">
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Buat Event Baru</h1>
          <p className="text-xs text-slate-500">
            Inisialisasi event, tentukan Event Leader, dan atur toleransi rundown.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Judul Event
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Youth Revival Night 2026"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Tema Event
            </label>
            <input
              type="text"
              required
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Contoh: Light in the Dark"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                Tanggal Event
              </label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Toleransi Waktu (detik)
              </label>
              <input
                type="number"
                min={0}
                max={600}
                value={timeTolerance}
                onChange={(e) => setTimeTolerance(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
              Event Leader
            </label>
            <select
              required
              value={eventLeaderId}
              onChange={(e) => setEventLeaderId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            >
              <option value="" disabled>
                -- Pilih Event Leader --
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.base_role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Link href="/events">
              <Button type="button" variant="ghost">
                Batal
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="font-semibold"
            >
              {submitting ? "Menyimpan..." : "Buat Event"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
