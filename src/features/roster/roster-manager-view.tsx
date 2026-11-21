"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  Shield,
  Layers,
  Lock,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { isCreativeLeader } from "@/lib/mock-db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AssignRosterSchema } from "@/lib/validators/schemas";
import {
  assignRosterAction,
  removeRosterAction,
  rollRosterSectionAction,
} from "@/features/events/actions/event-actions";
import type {
  AppNotification,
  EventRosterMember,
  EventRole,
  SectionType,
  User,
} from "@/types/domain";

interface RosterManagerViewProps {
  eventId: string;
  initialRoster: EventRosterMember[];
  users: Pick<User, "id" | "full_name" | "base_role" | "avatar_url">[];
}

const SECTIONS: SectionType[] = [
  "INTI",
  "ACARA",
  "DEKORASI",
  "PERLENGKAPAN",
  "PDD",
  "ALL",
];

const ROLES: { value: EventRole; label: string }[] = [
  { value: "EVENT_LEADER", label: "Event Leader" },
  { value: "CO_CONTROLLER", label: "Co-Controller" },
  { value: "SECTION_LEADER", label: "Section Leader" },
  { value: "MEMBER", label: "Member" },
];

export function RosterManagerView({
  eventId,
  initialRoster,
  users,
}: RosterManagerViewProps) {
  const { currentUser, isLoading } = useAuth();
  const [storedUser, setStoredUser] = useState<User | null>(null);
  const effectiveUser = currentUser ?? storedUser;

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

  const [roster, setRoster] = useState<EventRosterMember[]>(initialRoster);
  const [activeSection, setActiveSection] = useState<SectionType | "ALL_VIEW">("ALL_VIEW");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [rollingTarget, setRollingTarget] = useState<EventRosterMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add form state
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [selectedSection, setSelectedSection] = useState<SectionType>("ACARA");
  const [selectedRole, setSelectedRole] = useState<EventRole>("MEMBER");
  const [isCoController, setIsCoController] = useState(false);

  // Roll form state
  const [rollSection, setRollSection] = useState<SectionType>("ACARA");
  const [rollRole, setRollRole] = useState<EventRole>("MEMBER");
  const [rollCoController, setRollCoController] = useState(false);

  // Count assignments per user to detect dual-role / rangkap jabatan
  const userAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of roster) {
      counts.set(item.user_id, (counts.get(item.user_id) ?? 0) + 1);
    }
    return counts;
  }, [roster]);

  const filteredRoster = useMemo(() => {
    if (activeSection === "ALL_VIEW") return roster;
    return roster.filter((r) => r.section === activeSection);
  }, [roster, activeSection]);

  function pushRosterNotification(
    userId: string,
    title: string,
    body: string
  ) {
    try {
      const raw = localStorage.getItem("CT_NOTIFICATIONS");
      const existing: AppNotification[] = raw ? JSON.parse(raw) : [];
      const newNotif: AppNotification = {
        id: crypto.randomUUID(),
        user_id: userId,
        event_id: eventId,
        type: "TASK_ASSIGNED",
        title,
        body,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(
        "CT_NOTIFICATIONS",
        JSON.stringify([newNotif, ...existing])
      );
    } catch {
      // ignore localStorage errors
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedRole === "SECTION_LEADER") {
      const existingSectionLeader = roster.find(
        (r) =>
          r.section === selectedSection && r.role_in_event === "SECTION_LEADER"
      );
      if (existingSectionLeader) {
        setError(
          `Section ${selectedSection} sudah memiliki Section Leader aktif (${
            existingSectionLeader.user?.full_name ?? "Anggota"
          }). Maksimal 1 Section Leader per section.`
        );
        return;
      }
    }

    const payload = {
      event_id: eventId,
      user_id: selectedUserId,
      section: selectedSection,
      role_in_event: selectedRole,
      is_co_controller: isCoController,
    };

    const parsed = AssignRosterSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data roster tidak valid");
      return;
    }

    setBusy(true);
    const res = await assignRosterAction(parsed.data);
    setBusy(false);

    if (!res.success || !res.data) {
      setError(res.error ?? "Gagal menambahkan ke roster");
      return;
    }

    setRoster((prev) => {
      let updated = prev;
      if (selectedRole === "EVENT_LEADER") {
        updated = prev.map((r) =>
          r.role_in_event === "EVENT_LEADER"
            ? { ...r, role_in_event: "MEMBER" as EventRole }
            : r
        );
      }
      return [...updated, res.data!];
    });

    if (selectedRole === "EVENT_LEADER") {
      pushRosterNotification(
        selectedUserId,
        "Penunjukan Event Leader",
        `Anda ditunjuk sebagai Event Leader baru untuk event ini.`
      );
    }
    setIsAddOpen(false);
  }

  function openRollModal(member: EventRosterMember) {
    setRollingTarget(member);
    setRollSection(member.section);
    setRollRole(member.role_in_event);
    setRollCoController(member.is_co_controller);
    setError(null);
  }

  async function handleRoll(e: React.FormEvent) {
    e.preventDefault();
    if (!rollingTarget) return;
    setError(null);

    if (rollRole === "SECTION_LEADER") {
      const existingSectionLeader = roster.find(
        (r) =>
          r.id !== rollingTarget.id &&
          r.section === rollSection &&
          r.role_in_event === "SECTION_LEADER"
      );
      if (existingSectionLeader) {
        setError(
          `Section ${rollSection} sudah memiliki Section Leader aktif (${
            existingSectionLeader.user?.full_name ?? "Anggota"
          }). Maksimal 1 Section Leader per section.`
        );
        return;
      }
    }

    setBusy(true);

    const res = await rollRosterSectionAction({
      roster_id: rollingTarget.id,
      event_id: eventId,
      section: rollSection,
      role_in_event: rollRole,
      is_co_controller: rollCoController,
    });

    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Gagal rolling section");
      return;
    }

    setRoster((prev) =>
      prev.map((item) => {
        if (item.id === rollingTarget.id) return res.data!;
        if (rollRole === "EVENT_LEADER" && item.role_in_event === "EVENT_LEADER") {
          return { ...item, role_in_event: "MEMBER" as EventRole };
        }
        return item;
      })
    );

    if (rollRole === "EVENT_LEADER") {
      pushRosterNotification(
        rollingTarget.user_id,
        "Rolling ke Event Leader",
        `Anda di-rolling menjadi Event Leader untuk event ini.`
      );
    }
    setRollingTarget(null);
  }

  async function handleRemove(rosterId: string) {
    setBusy(true);
    const res = await removeRosterAction(rosterId, eventId);
    setBusy(false);
    if (res.success) {
      setRoster((prev) => prev.filter((r) => r.id !== rosterId));
    }
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
          Pengelolaan Roster Panitia hanya dapat diakses oleh Creative Leader.
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Roster &amp; Rolling Section
            </h2>
            <p className="text-xs text-slate-500">
              Mendukung rangkap jabatan (dual-role) dan rolling antar section.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setError(null);
            setIsAddOpen(true);
          }}
          className="gap-1.5 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Assign Anggota
        </Button>
      </div>

      {/* Section Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveSection("ALL_VIEW")}
          className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            activeSection === "ALL_VIEW"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
              : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900"
          }`}
        >
          Semua ({roster.length})
        </button>
        {SECTIONS.map((sec) => {
          const count = roster.filter((r) => r.section === sec).length;
          return (
            <button
              key={sec}
              type="button"
              onClick={() => setActiveSection(sec)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                activeSection === sec
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900"
              }`}
            >
              {sec} ({count})
            </button>
          );
        })}
      </div>

      {/* Roster List */}
      {filteredRoster.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">
            Belum ada anggota di section ini.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredRoster.map((member) => {
            const isDualRole = (userAssignmentCounts.get(member.user_id) ?? 0) > 1;
            return (
              <Card
                key={member.id}
                className="p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold text-slate-900">
                      {member.user?.full_name ?? "Anggota"}
                    </span>
                    {isDualRole && (
                      <Badge variant="amber" className="gap-1 text-[10px]">
                        <Layers className="h-3 w-3" />
                        Rangkap Jabatan
                      </Badge>
                    )}
                    {member.is_co_controller && (
                      <Badge variant="cyan" className="gap-1 text-[10px]">
                        <Shield className="h-3 w-3" />
                        Co-Controller
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge variant="neutral">{member.section}</Badge>
                    <span>·</span>
                    <span className="text-indigo-700 font-semibold">{member.role_in_event}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openRollModal(member)}
                    title="Rolling Section / Role"
                    className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => handleRemove(member.id)}
                    title="Hapus dari roster"
                    className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Assign Anggota ke Roster"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              Anggota (bisa pilih yang sudah terdaftar untuk rangkap jabatan)
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.base_role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value as SectionType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Role di Event
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as EventRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={isCoController}
              onChange={(e) => setIsCoController(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Aktifkan akses Co-Controller Live Rundown
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              className="font-semibold"
            >
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rolling Modal */}
      <Modal
        isOpen={Boolean(rollingTarget)}
        onClose={() => setRollingTarget(null)}
        title={`Rolling Section: ${rollingTarget?.user?.full_name ?? ""}`}
      >
        <form onSubmit={handleRoll} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Pindah ke Section
              </label>
              <select
                value={rollSection}
                onChange={(e) => setRollSection(e.target.value as SectionType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Role Baru
              </label>
              <select
                value={rollRole}
                onChange={(e) => setRollRole(e.target.value as EventRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={rollCoController}
              onChange={(e) => setRollCoController(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Co-Controller Live Rundown
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRollingTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="amber"
              disabled={busy}
              className="font-semibold"
            >
              {busy ? "Memproses..." : "Terapkan Rolling"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
