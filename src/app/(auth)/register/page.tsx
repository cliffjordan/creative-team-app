"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { users, refreshUsers, setCurrentUserDirect } = useAuth();

  const isFirstAccount = users.length === 0;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (fullName.trim().length < 2) {
      setErrorMsg("Nama lengkap minimal 2 karakter.");
      return;
    }
    if (phone.trim().length < 8) {
      setErrorMsg("Nomor WhatsApp aktif wajib diisi (minimal 8 digit).");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg("PIN harus terdiri dari tepat 4 digit angka.");
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg("Konfirmasi PIN tidak cocok dengan PIN yang Anda masukkan.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.user) {
        setErrorMsg(data.error || "Gagal mendaftarkan akun.");
        setSubmitting(false);
        return;
      }

      await refreshUsers();
      setCurrentUserDirect(data.user);
      router.replace("/");
    } catch {
      setErrorMsg("Gagal terhubung ke server. Periksa koneksi Anda.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAF9F5] text-slate-950 flex flex-col">
      {/* Creative Team Prism Hairline */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 via-50% to-cyan-500" />

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Utama</span>
          </Link>

          <Link
            href="/login"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Sudah punya akun? Masuk PIN
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-900/15 bg-white shadow-xl shadow-slate-900/5 rounded-3xl overflow-hidden">
          {/* Left Editorial Summary */}
          <div className="lg:col-span-5 bg-slate-950 text-white p-6 sm:p-8 flex flex-col justify-between gap-8 relative overflow-hidden">
            <div className="absolute -bottom-20 -right-20 w-56 h-56 rounded-full bg-indigo-600/30 blur-3xl pointer-events-none" />
            <div className="space-y-5 relative">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" />
                <div>
                  <div className="text-sm font-extrabold tracking-tight">Creative Team</div>
                  <div className="text-[11px] font-mono text-amber-400">
                    CHURCH EVENT OS · REGISTRY
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                  01 / ONBOARDING ANGGOTA
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Daftarkan Akun Tim Pelayanan Anda.
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Buat profil anggota dan tetapkan 4-digit PIN pribadi Anda untuk masuk ke workspace
                  dan terhubung dengan jadwal tim secara real-time.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 relative border-t border-white/10 pt-5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {isFirstAccount
                    ? "Akun pertama yang terdaftar otomatis ditetapkan sebagai Creative Leader (Superadmin)."
                    : "Jabatan & divisi pelayanan ditetapkan langsung oleh Creative Leader setelah akun terdaftar."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>PIN disimpan dengan enkripsi salted hash di database Supabase.</span>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="lg:col-span-7 p-6 sm:p-8">
            <div className="mb-5">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Formulir Pendaftaran Akun</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Cukup lengkapi identitas dasar dan buat 4-digit PIN Anda.
              </p>
            </div>

            {/* Auto-Role Information Pill */}
            <div
              className={`mb-4 flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs ${
                isFirstAccount
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-indigo-200 bg-indigo-50/70 text-indigo-900"
              }`}
            >
              <ShieldCheck
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isFirstAccount ? "text-amber-600" : "text-indigo-600"
                }`}
              />
              <span>
                {isFirstAccount ? (
                  <>
                    <strong>Status Pendaftar Pertama:</strong> Anda akan otomatis menjadi{" "}
                    <strong>Creative Leader (Superadmin)</strong> untuk mengelola member dan event.
                  </>
                ) : (
                  <>
                    <strong>Penugasan Otomatis:</strong> Akun baru berstatus{" "}
                    <strong>Member Umum</strong> (akses menu general) hingga Creative Leader
                    menetapkan role &amp; divisi Anda.
                  </>
                )}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Cliff Jordan"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: +628123456789"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gereja.org"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Buat PIN (4 Digit) *</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-[0.4em] text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ulangi PIN *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-[0.4em] text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  className="w-full h-12 text-sm font-bold rounded-xl shadow-md"
                >
                  {submitting ? "Mendaftarkan Akun..." : "Daftar & Masuk ke Workspace"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
