"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  Shield,
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
import { publishSyncMessage } from "@/lib/sync/realtime-bus";
import type {
  AppNotification,
  EventRosterMember,
  EventRole,
  SectionType,
  User,
} from "@/types/domain";

interface RosterManagerViewProps {
  eventId: string;
  eventLeaderId?: string;
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
  eventLeaderId,
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

  const isTopLeader = useMemo(() => {
    if (!effectiveUser) return false;
    if (isCreativeLeader(effectiveUser) || effectiveUser.base_role === "WAKIL_LEADER") {
      return true;
    }
    if (eventLeaderId && effectiveUser.id === eventLeaderId) {
      return true;
    }
    return roster.some(
      (r) =>
        r.user_id === effectiveUser.id &&
        (r.role_in_event === "EVENT_LEADER" || r.is_co_controller)
    );
  }, [effectiveUser, eventLeaderId, roster]);

  const mySectionLeaderEntry = useMemo(() => {
    if (!effectiveUser) return undefined;
    return roster.find(
      (r) =>
        r.user_id === effectiveUser.id &&
        r.role_in_event === "SECTION_LEADER"
    );
  }, [effectiveUser, roster]);

  const canManageAnyRoster = isTopLeader || Boolean(mySectionLeaderEntry);

  // Enforce 1 Member = Max 1 Section per Event: filter out users already assigned anywhere in this event
  const unassignedEventUsers = useMemo(() => {
    const assignedIds = new Set(roster.map((r) => r.user_id));
    return users.filter((u) => !assignedIds.has(u.id));
  }, [users, roster]);

  // Add form state
  const [selectedUserId, setSelectedUserId] = useState(unassignedEventUsers[0]?.id ?? "");
  const [selectedSection, setSelectedSection] = useState<SectionType>(
    mySectionLeaderEntry?.section ?? "ACARA"
  );
  const [selectedRole, setSelectedRole] = useState<EventRole>("MEMBER");
  const [isCoController, setIsCoController] = useState(false);

  // Roll form state
  const [rollSection, setRollSection] = useState<SectionType>("ACARA");
  const [rollRole, setRollRole] = useState<EventRole>("MEMBER");
  const [rollCoController, setRollCoController] = useState(false);

  const syncLocalRoster = (updatedEventRoster: EventRosterMember[]) => {
    try {
      const saved = localStorage.getItem("CT_ROSTER");
      const all: EventRosterMember[] = saved ? JSON.parse(saved) : [];
      const others = all.filter((r) => r.event_id !== eventId);
      const merged = [...updatedEventRoster, ...others];
      localStorage.setItem("CT_ROSTER", JSON.stringify(merged));
      publishSyncMessage("CT_ROSTER", merged);
    } catch {
      // ignore localStorage errors
    }
  };

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

  function handleOpenAddModal() {
    setError(null);
    setSelectedUserId(unassignedEventUsers[0]?.id ?? "");
    if (!isTopLeader && mySectionLeaderEntry) {
      setSelectedSection(mySectionLeaderEntry.section);
      setSelectedRole("MEMBER");
      setIsCoController(false);
    } else {
      setSelectedSection(
        activeSection !== "ALL_VIEW" ? activeSection : "ACARA"
      );
      setSelectedRole("MEMBER");
      setIsCoController(false);
    }
    setIsAddOpen(true);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedUserId) {
      setError("Pilih anggota terlebih dahulu.");
      return;
    }

    if (roster.some((r) => r.user_id === selectedUserId)) {
      setError("Anggota ini sudah tergabung di salah satu section pada event ini (maks. 1 section per event).");
      return;
    }

    const effectiveSection =
      !isTopLeader && mySectionLeaderEntry
        ? mySectionLeaderEntry.section
        : selectedSection;
    const effectiveRole =
      !isTopLeader && mySectionLeaderEntry ? "MEMBER" : selectedRole;

    if (effectiveRole === "SECTION_LEADER") {
      const existingSectionLeader = roster.find(
        (r) =>
          r.section === effectiveSection && r.role_in_event === "SECTION_LEADER"
      );
      if (existingSectionLeader) {
        setError(
          `Section ${effectiveSection} sudah memiliki Section Leader aktif (${
            existingSectionLeader.user?.full_name ?? "Anggota"
          }). Maksimal 1 Section Leader per section.`
        );
        return;
      }
    }

    const payload = {
      event_id: eventId,
      user_id: selectedUserId,
      section: effectiveSection,
      role_in_event: effectiveRole,
      is_co_controller: isTopLeader ? isCoController : false,
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
      if (effectiveRole === "EVENT_LEADER") {
        updated = prev.map((r) =>
          r.role_in_event === "EVENT_LEADER"
            ? { ...r, role_in_event: "MEMBER" as EventRole }
            : r
        );
      }
      const next = [...updated, res.data!];
      syncLocalRoster(next);
      return next;
    });

    if (effectiveRole === "EVENT_LEADER") {
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
    if (!rollingTarget || !isTopLeader) return;
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

    setRoster((prev) => {
      const next = prev.map((item) => {
        if (item.id === rollingTarget.id) return res.data!;
        if (rollRole === "EVENT_LEADER" && item.role_in_event === "EVENT_LEADER") {
          return { ...item, role_in_event: "MEMBER" as EventRole };
        }
        return item;
      });
      syncLocalRoster(next);
      return next;
    });

    if (rollRole === "EVENT_LEADER") {
      pushRosterNotification(
        rollingTarget.user_id,
        "Rolling ke Event Leader",
        `Anda di-rolling menjadi Event Leader untuk event ini.`
      );
    }
    setRollingTarget(null);
  }

  async function handleRemove(member: EventRosterMember) {
    setBusy(true);
    const res = await removeRosterAction(member.id, eventId);
    setBusy(false);
    if (res.success) {
      setRoster((prev) => {
        const next = prev.filter((r) => r.id !== member.id);
        syncLocalRoster(next);
        return next;
      });
    } else if (res.error) {
      setError(res.error);
    }
  }

  if (isLoading && !effectiveUser) {
    return (
      <Card className="mx-auto max-w-lg bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Memverifikasi sesi...
      </Card>
    );
  }

  if (!canManageAnyRoster) {
    return (
      <Card className="mx-auto max-w-lg border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          Akses Khusus Pimpinan &amp; Section Leader
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Penambahan member divisi dikelola oleh Section Leader masing-masing atau Creative Leader / Event Leader.
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
              Roster Panitia Event
            </h2>
            <p className="text-xs text-slate-500">
              {isTopLeader
                ? "1 Member maksimal tergabung pada 1 Section per event. Section Leader dapat menambahkan Member ke divisinya sendiri."
                : `Anda bertindak sebagai Section Leader ${mySectionLeaderEntry?.section ?? ""}. Tambahkan Member khusus untuk divisi Anda.`}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleOpenAddModal}
          className="gap-1.5 font-semibold"
        >
          <Plus className="h-4 w-4" />
          {!isTopLeader && mySectionLeaderEntry
            ? `Tambah Member (${mySectionLeaderEntry.section})`
            : "Assign Anggota"}
        </Button>
      </div>

      {/* Section Filter */}
      <div data-lenis-prevent className="flex gap-1.5 overflow-x-auto pb-1">
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
            const canDeleteThisRow =
              isTopLeader ||
              (Boolean(mySectionLeaderEntry) &&
                member.section === mySectionLeaderEntry?.section &&
                member.role_in_event === "MEMBER");

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

                {(isTopLeader || canDeleteThisRow) && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isTopLeader && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openRollModal(member)}
                        title="Pindah Section / Ubah Role"
                        className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteThisRow && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => handleRemove(member)}
                        title="Hapus dari roster"
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={
          !isTopLeader && mySectionLeaderEntry
            ? `Tambah Member ke Divisi ${mySectionLeaderEntry.section}`
            : "Assign Anggota ke Roster"
        }
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              Pilih Anggota (1 orang maksimal 1 section per event)
            </label>
            {unassignedEventUsers.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                Semua anggota terdaftar sudah masuk ke salah satu section pada event ini.
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {unassignedEventUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.base_role})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Section
              </label>
              <select
                disabled={!isTopLeader && Boolean(mySectionLeaderEntry)}
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value as SectionType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
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
                disabled={!isTopLeader && Boolean(mySectionLeaderEntry)}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as EventRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isTopLeader && (
            <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={isCoController}
                onChange={(e) => setIsCoController(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Aktifkan akses Co-Controller Live Rundown
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || unassignedEventUsers.length === 0}
              className="font-semibold"
            >
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rolling Modal (Top Leaders Only) */}
      <Modal
        isOpen={Boolean(rollingTarget)}
        onClose={() => setRollingTarget(null)}
        title={`Pindah Section / Role: ${rollingTarget?.user?.full_name ?? ""}`}
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
              {busy ? "Memproses..." : "Terapkan Perubahan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
