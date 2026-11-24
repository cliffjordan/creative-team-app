"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Lock,
  Mail,
  Shield,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

export default function SuperadminLoginPage() {
  const router = useRouter();
  const { currentUser, isLoading, setCurrentUserDirect } = useAuth();

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!isLoading && currentUser?.is_superadmin) {
      router.replace("/superadmin");
    }
  }, [currentUser, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^\d{4}$/.test(pin)) {
      setErrorMsg("Masukkan email Superadmin dan 4-digit PIN yang valid.");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/superadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, pin }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success || !data.user) {
        if (data?.is_locked) {
          setIsLocked(true);
        }
        setErrorMsg(data?.error || "Email atau PIN Superadmin tidak valid.");
        setPin("");
        setSubmitting(false);
        return;
      }

      setCurrentUserDirect(data.user);
      router.replace("/superadmin");
      router.refresh();
    } catch {
      setErrorMsg("Gagal terhubung ke server. Silakan coba lagi.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2.5">
          <BrandLogo size="lg" />
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            <Shield className="h-3.5 w-3.5" />
            <span>Isolated Technical Portal</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Superadmin Login
          </h1>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Gerbang masuk khusus maintenance server, diagnostik database, dan pemulihan akun darurat.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-7 shadow-2xl space-y-4 backdrop-blur"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="superadmin-email"
              className="block text-xs font-semibold text-slate-300"
            >
              Email Akun Teknis
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="superadmin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@creativehub.local"
                disabled={isLocked || submitting}
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="superadmin-pin"
              className="block text-xs font-semibold text-slate-300"
            >
              4-Digit PIN
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="superadmin-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
                disabled={isLocked || submitting}
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm tracking-[0.4em] font-mono text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-50"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
              {isLocked ? (
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{errorMsg}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLocked || submitting || !email.trim() || pin.length !== 4}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 disabled:opacity-50"
          >
            {submitting ? "Memverifikasi..." : "Masuk ke Konsol Maintenance"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Login Tim</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
