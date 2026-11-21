"use client";

import React, { useMemo, useState } from "react";
import { SectionType, User, UserBaseRole } from "@/types/domain";
import { isCreativeLeader, isUnassignedMember } from "@/lib/mock-db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

interface MemberManagementViewProps {
  users: User[];
  currentUser: User | null;
  onRefreshUsers: () => Promise<unknown>;
}

const ROLE_OPTIONS: { value: UserBaseRole; label: string }[] = [
  { value: "CREATIVE_LEADER", label: "Creative Leader" },
  { value: "WAKIL_LEADER", label: "Wakil Leader" },
  { value: "SEKRETARIS", label: "Sekretaris" },
  { value: "BENDAHARA", label: "Bendahara" },
  { value: "SECTION_LEADER", label: "Section Leader" },
  { value: "MEMBER", label: "Member / Anggota" },
];

const SECTION_OPTIONS: { value: SectionType | ""; label: string }[] = [
  { value: "", label: "Belum Ditentukan" },
  { value: "INTI", label: "Inti (Leader / Sek / Bend)" },
  { value: "ACARA", label: "Seksi Acara" },
  { value: "DEKORASI", label: "Seksi Dekorasi" },
  { value: "PERLENGKAPAN", label: "Seksi Perlengkapan" },
  { value: "PDD", label: "Seksi PDD" },
  { value: "ALL", label: "Semua Seksi" },
];

export function MemberManagementView({
  users,
  currentUser,
  onRefreshUsers,
}: MemberManagementViewProps) {
  const canManage = isCreativeLeader(currentUser);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "PENDING" | "ASSIGNED">("ALL");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Member Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserBaseRole>("MEMBER");
  const [newSection, setNewSection] = useState<SectionType | "">("ACARA");
  const [newPin, setNewPin] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset PIN Modal State
  const [pinTargetUser, setPinTargetUser] = useState<User | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");

  const pendingCount = useMemo(
    () => users.filter((u) => isUnassignedMember(u)).length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (filterMode === "PENDING" && !isUnassignedMember(u)) return false;
      if (filterMode === "ASSIGNED" && isUnassignedMember(u)) return false;
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        u.base_role.toLowerCase().includes(q) ||
        (u.default_section || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, filterMode]);

  const showNotice = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUpdateRoleSection = async (
    targetUser: User,
    nextRole: UserBaseRole,
    nextSection: SectionType | null
  ) => {
    setBusyUserId(targetUser.id);
    try {
      const resolvedSection =
        nextSection ||
        (nextRole === "CREATIVE_LEADER" ||
        nextRole === "WAKIL_LEADER" ||
        nextRole === "SEKRETARIS" ||
        nextRole === "BENDAHARA"
          ? "INTI"
          : null);

      const res = await fetch(`/api/auth/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_role: nextRole,
          default_section: resolvedSection,
          is_role_assigned: nextRole !== "MEMBER" || Boolean(resolvedSection),
          is_superadmin: nextRole === "CREATIVE_LEADER",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Gagal memperbarui role member.");
      } else {
        await onRefreshUsers();
        showNotice("success", `Role & divisi untuk ${targetUser.full_name} berhasil diperbarui.`);
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(newPin)) {
      showNotice("error", "PIN awal harus tepat 4 digit angka.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          base_role: newRole,
          default_section: newSection || null,
          is_role_assigned: newRole !== "MEMBER" || Boolean(newSection),
          pin: newPin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Gagal menambah member baru.");
      } else {
        await onRefreshUsers();
        setIsAddOpen(false);
        setNewFullName("");
        setNewPhone("");
        setNewEmail("");
        setNewPin("");
        showNotice("success", "Akun member baru berhasil ditambahkan.");
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPin = async () => {
    if (!pinTargetUser || !/^\d{4}$/.test(resetPinValue)) {
      showNotice("error", "Masukkan 4 digit PIN baru.");
      return;
    }
    setBusyUserId(pinTargetUser.id);
    try {
      const res = await fetch(`/api/auth/users/${pinTargetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_pin: resetPinValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Gagal mereset PIN.");
      } else {
        await onRefreshUsers();
        showNotice("success", `PIN untuk ${pinTargetUser.full_name} berhasil direset.`);
        setPinTargetUser(null);
        setResetPinValue("");
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Hapus akun "${targetUser.full_name}" dari sistem?`)
    ) {
      return;
    }
    setBusyUserId(targetUser.id);
    try {
      const res = await fetch(`/api/auth/users/${targetUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Gagal menghapus member.");
      } else {
        await onRefreshUsers();
        showNotice("success", `Akun ${targetUser.full_name} berhasil dihapus.`);
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setBusyUserId(null);
    }
  };

  if (!canManage) {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Khusus Creative Leader</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Manajemen Member &amp; Penugasan Role hanya dapat diakses oleh Creative Leader.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Manajemen Member &amp; Role Tim</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tetapkan jabatan, divisi section, reset PIN, dan kelola seluruh anggota terdaftar.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          className="text-xs font-bold gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Member</span>
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Anggota Terdaftar
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">{users.length}</div>
        </Card>
        <Card
          className={`p-4 ${
            pendingCount > 0
              ? "border-amber-300 bg-amber-50/60"
              : "border-slate-200"
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Menunggu Penugasan Role
          </div>
          <div className="text-xl font-black text-amber-700 mt-1">{pendingCount}</div>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Sudah Ditetapkan Role
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {users.length - pendingCount}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "ALL", label: `Semua (${users.length})` },
            { id: "PENDING", label: `Menunggu Role (${pendingCount})` },
            { id: "ASSIGNED", label: `Aktif (${users.length - pendingCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as "ALL" | "PENDING" | "ASSIGNED")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                filterMode === tab.id
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, WA, role..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Member Cards Grid (Mobile-First & Clean on Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredUsers.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-400 md:col-span-2">
            Tidak ada anggota yang sesuai filter pencarian.
          </Card>
        ) : (
          filteredUsers.map((member) => {
            const isPending = isUnassignedMember(member);
            const isSelf = member.id === currentUser?.id;
            const busy = busyUserId === member.id;

            return (
              <Card
                key={member.id}
                className={`p-4 space-y-3.5 border transition ${
                  isPending
                    ? "border-amber-300 bg-amber-50/25"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">
                        {member.full_name}
                      </h3>
                      {isSelf && (
                        <Badge variant="purple" className="text-[10px]">
                          Anda
                        </Badge>
                      )}
                      {isPending ? (
                        <Badge variant="amber" className="text-[10px]">
                          Belum Ditetapkan
                        </Badge>
                      ) : (
                        <Badge variant="emerald" className="text-[10px] gap-1">
                          <UserCheck className="w-3 h-3" />
                          Aktif
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {member.phone || "Tanpa WA"} {member.email ? `• ${member.email}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPinTargetUser(member);
                        setResetPinValue("");
                      }}
                      title="Reset PIN 4 Digit"
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteUser(member)}
                        title="Hapus Anggota"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Role & Section Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Jabatan / Base Role
                    </label>
                    <select
                      disabled={busy}
                      value={member.base_role}
                      onChange={(e) =>
                        handleUpdateRoleSection(
                          member,
                          e.target.value as UserBaseRole,
                          (member.default_section || null) as SectionType | null
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Divisi / Section Default
                    </label>
                    <select
                      disabled={busy}
                      value={member.default_section || ""}
                      onChange={(e) =>
                        handleUpdateRoleSection(
                          member,
                          member.base_role,
                          (e.target.value || null) as SectionType | null
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                    >
                      {SECTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Member Baru"
        description="Buat akun anggota langsung dengan role, divisi, dan PIN awal."
      >
        <form onSubmit={handleCreateMember} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Contoh: Amanda Putri"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+628123456789"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email (Opsional)
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@gereja.org"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jabatan / Role *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserBaseRole)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Divisi / Section
              </label>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value as SectionType | "")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                {SECTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              PIN Login Awal (4 Digit Angka) *
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center font-mono text-base font-bold tracking-[0.4em]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={creating}>
              <ShieldCheck className="w-4 h-4 mr-1" />
              {creating ? "Menyimpan..." : "Simpan Member"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal
        isOpen={Boolean(pinTargetUser)}
        onClose={() => setPinTargetUser(null)}
        title="Reset PIN Anggota"
        description={
          pinTargetUser
            ? `Tetapkan 4 digit PIN baru untuk ${pinTargetUser.full_name}`
            : ""
        }
      >
        <div className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={resetPinValue}
            onChange={(e) => setResetPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.5em]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPinTargetUser(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={resetPinValue.length !== 4 || busyUserId === pinTargetUser?.id}
              onClick={handleResetPin}
            >
              Simpan PIN Baru
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
