"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FADE_FAST } from "@/providers/motion-provider";
import { useAuth } from "@/providers/auth-provider";
import { PinLoginForm } from "@/features/auth/pin-login-form";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Radio, Users, ClipboardCheck, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { users, setCurrentUserDirect } = useAuth();

  const handleSuccessLogin = (user: (typeof users)[number]) => {
    setCurrentUserDirect(user);
    let validTarget = "/";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const target = params.get("redirect") || params.get("next");
      if (target && target.startsWith("/") && !target.startsWith("//")) {
        validTarget = target;
      }
    }
    router.replace(validTarget);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 lg:grid lg:grid-cols-2">
      {/* Left Brand Panel (Desktop Only) */}
      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <div className="text-sm font-bold tracking-wide">Creative Team</div>
            <div className="text-xs text-indigo-100/80">Church Event OS</div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Akses PIN Aman &amp; Terenkripsi</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Koordinasi Pelayanan Lebih Tenang &amp; Presisi.
          </h1>
          <p className="text-sm text-indigo-100/90 leading-relaxed">
            Satu platform terpadu untuk merancang rundown, mengontrol waktu panggung secara real-time,
            dan menindaklanjuti evaluasi pasca-acara tanpa panik.
          </p>

          <div className="grid gap-3 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <Radio className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold">Live Stage Sync</div>
                <div className="text-xs text-indigo-100/80">
                  Timer terisolasi, CUE 3-menit, dan Change Queue instan untuk seluruh divisi.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <Users className="w-5 h-5 text-sky-200 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold">Multi-Event Roster Control</div>
                <div className="text-xs text-indigo-100/80">
                  Setiap kru hanya melihat acara tempat mereka ditugaskan dengan Leader dinamis per event.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm">
              <ClipboardCheck className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold">Evaluasi &amp; LPJ Otomatis</div>
                <div className="text-xs text-indigo-100/80">
                  Catat insiden lapangan dan selesaikan evaluasi hingga status event COMPLETED.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-indigo-100/75">
          &copy; {new Date().getFullYear()} Creative Team Church Event OS
        </div>
      </section>

      {/* Right Sign In Column (Desktop + Mobile) */}
      <section className="flex flex-col items-center justify-center p-5 sm:p-10 min-h-screen">
        <div className="w-full max-w-md space-y-5">
          {/* Mobile Brand Header */}
          <div className="lg:hidden text-center space-y-2">
            <BrandLogo size="lg" className="mx-auto" />
            <h1 className="text-xl font-extrabold text-slate-900">
              Creative Team Event OS
            </h1>
            <p className="text-xs text-slate-500">
              Pilih nama Anda dan masukkan 4-digit PIN untuk melanjutkan.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={FADE_FAST}
            className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60 p-6 sm:p-8"
          >
            <div className="mb-5 hidden lg:block">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Sign In Anggota
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pilih nama Anda dari daftar tim gereja dan masukkan 4-digit PIN.
              </p>
            </div>

            <PinLoginForm users={users} onSuccessLogin={handleSuccessLogin} />
          </motion.div>
        </div>
      </section>
    </main>
  );
}
