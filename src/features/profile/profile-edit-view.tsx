"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { User } from "@/types/domain";
import { isUnassignedMember } from "@/lib/mock-db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  Save,
  User as UserIcon,
} from "lucide-react";

interface ProfileEditViewProps {
  currentUser: User | null;
}

export function ProfileEditView({ currentUser }: ProfileEditViewProps) {
  const { refreshUsers, setCurrentUserDirect } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.full_name || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || "");
      setPhone(currentUser.phone || "");
      setEmail(currentUser.email || "");
      setAvatarUrl(currentUser.avatar_url || "");
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <Card className="p-8 text-center text-xs text-slate-500">
        Silakan login terlebih dahulu untuk mengedit profil akun Anda.
      </Card>
    );
  }

  const initials = currentUser.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const unassigned = isUnassignedMember(currentUser);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (fullName.trim().length < 2) {
      setFeedback({ type: "error", text: "Nama lengkap minimal 2 karakter." });
      return;
    }
    if (phone.trim().length < 8) {
      setFeedback({ type: "error", text: "Nomor WhatsApp minimal 8 digit." });
      return;
    }
    if (newPin || currentPin || confirmNewPin) {
      if (!/^\d{4}$/.test(currentPin)) {
        setFeedback({ type: "error", text: "Masukkan PIN lama Anda (4 digit) untuk mengganti PIN." });
        return;
      }
      if (!/^\d{4}$/.test(newPin)) {
        setFeedback({ type: "error", text: "PIN baru harus tepat 4 digit angka." });
        return;
      }
      if (newPin !== confirmNewPin) {
        setFeedback({ type: "error", text: "Konfirmasi PIN baru tidak cocok." });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          avatar_url: avatarUrl.trim() || null,
          ...(newPin ? { current_pin: currentPin, new_pin: newPin } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.user) {
        setFeedback({ type: "error", text: data.error || "Gagal memperbarui profil." });
        setSaving(false);
        return;
      }

      setCurrentUserDirect(data.user as User);
      await refreshUsers();
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setFeedback({ type: "success", text: "Profil dan pengaturan keamanan berhasil diperbarui." });
    } catch {
      setFeedback({ type: "error", text: "Gagal terhubung ke server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28 lg:pb-12 animate-fade-in">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-indigo-600" />
          <span>Edit Profil Akun</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Perbarui informasi kontak dan PIN akses pribadi Anda.
        </p>
      </div>

      {/* Account Summary Banner */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-200 bg-white">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={currentUser.full_name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{currentUser.full_name}</h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Badge variant="purple" className="text-[10px]">
                {currentUser.base_role.replace("_", " ")}
              </Badge>
              {currentUser.default_section && (
                <Badge variant="cyan" className="text-[10px]">
                  Divisi: {currentUser.default_section}
                </Badge>
              )}
              {unassigned && (
                <Badge variant="amber" className="text-[10px]">
                  Menunggu Penugasan Role
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

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

      <form onSubmit={handleSave} className="space-y-5">
        <Card className="p-5 sm:p-6 space-y-4 border-slate-200">
          <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5">
            Informasi Profil Dasar
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Nomor WhatsApp *</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@gereja.org"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                URL Foto Avatar (Opsional)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 space-y-4 border-slate-200">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>Ubah PIN Login (Opsional)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Biarkan kosong jika tidak ingin mengganti PIN Anda saat ini.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN Saat Ini
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center font-mono text-base font-bold tracking-[0.4em]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN Baru (4 Digit)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center font-mono text-base font-bold tracking-[0.4em]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ulangi PIN Baru
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center font-mono text-base font-bold tracking-[0.4em]"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="w-full sm:w-auto px-6 h-11 text-xs font-bold gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan Profil"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
