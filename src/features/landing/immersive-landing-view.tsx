"use client";

import React, { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { formatSecondsToHHMMSS, formatSecondsToMMSS } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Layers,
  Lock,
  Presentation,
  Radio,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

interface ImmersiveLandingViewProps {
  onOpenLogin: () => void;
}

const PREVIEW_SEGMENTS = [
  {
    id: "praise",
    label: "Opening Praise",
    section: "ACARA",
    cue: "Team Tambourine standby di sayap kiri panggung · LED Warm Amber 60%",
    elapsedStart: 868,
    targetMinutes: 25,
    progressPct: 58,
  },
  {
    id: "sermon",
    label: "Firman Tuhan",
    section: "PDD",
    cue: "Spotlight mimbar aktif · Slide ayat Efesus 5:10 siap di layar utama",
    elapsedStart: 1215,
    targetMinutes: 35,
    progressPct: 64,
  },
  {
    id: "candle",
    label: "Candle Light",
    section: "PERLENGKAPAN",
    cue: "Fade-out lampu gedung 10 detik · 10 Usher bersiap membagikan lilin",
    elapsedStart: 742,
    targetMinutes: 15,
    progressPct: 82,
  },
] as const;

export function ImmersiveLandingView({ onOpenLogin }: ImmersiveLandingViewProps) {
  const [selectedSegIdx, setSelectedSegIdx] = useState(0);
  const [tickOffset, setTickOffset] = useState(0);

  const activeSegment = PREVIEW_SEGMENTS[selectedSegIdx];

  useEffect(() => {
    const timer = setInterval(() => {
      setTickOffset((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentElapsed = activeSegment.elapsedStart + tickOffset;
  const remainingSecs = Math.max(
    0,
    activeSegment.targetMinutes * 60 - currentElapsed
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 relative overflow-x-hidden flex flex-col">
      {/* Ambient Prism Mesh Orbs + Dot Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute inset-0 bg-dot-grid opacity-70" />
        <div className="animate-float-slow absolute -top-24 -left-24 w-72 h-72 sm:w-[420px] sm:h-[420px] rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="animate-float-delayed absolute top-28 -right-24 w-72 h-72 sm:w-[380px] sm:h-[380px] rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="animate-float-slow absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-amber-300/15 blur-3xl" />
      </div>

      {/* Glass Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-md">
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-cyan-500" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 truncate">
                Creative Team
              </div>
              <div className="text-[11px] font-semibold text-indigo-600 truncate">
                Church Event OS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Workspace Terkunci</span>
            </span>
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 hover:opacity-95 active:scale-[0.98] transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk PIN</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Bento Content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 space-y-14 sm:space-y-20">
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Hero Copy & CTA */}
          <div className="lg:col-span-7 space-y-5 animate-tab-enter">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-indigo-200/80 shadow-xs text-xs font-extrabold text-indigo-700 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>LIVE OPERATIONS READY · RBAC TERINTEGRASI</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.15]">
              Satu{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                Command Center
              </span>{" "}
              untuk Pelayanan Kreatif yang Presisi.
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              Rancang rundown panggung, kendalikan waktu live lintas divisi secara{" "}
              <strong className="text-slate-800">real-time</strong>, kelola pembiayaan &amp;
              notulensi terisolasi per event, hingga ekspor proposal Word siap pakai—aman dalam
              satu workspace terproteksi PIN.
            </p>

            {/* Primary CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenLogin}
                className="group relative overflow-hidden inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white text-sm font-extrabold shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <span
                  aria-hidden="true"
                  className="animate-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
                />
                <ShieldCheck className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Masuk ke Workspace</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <a
                href="#fitur"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/85 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-indigo-700 hover:border-indigo-200 text-sm font-bold shadow-xs transition"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Lihat Kemampuan Platform</span>
              </a>
            </div>

            {/* Trust / Quick Stats */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Akses Wajib PIN 4-Digit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Mobile-First &amp; Desktop Parity
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Data Terisolasi per Event
              </span>
            </div>
          </div>

          {/* Interactive Live Command Preview */}
          <div className="lg:col-span-5 relative animate-tab-enter" style={{ animationDelay: "100ms" }}>
            {/* Subtle Floating Section Badges */}
            <div className="hidden sm:flex items-center gap-2 mb-3 justify-end">
              <span className="animate-float-slow px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-[10px] font-extrabold text-purple-700 shadow-xs">
                ACARA
              </span>
              <span className="animate-float-delayed px-2.5 py-1 rounded-full bg-pink-50 border border-pink-200 text-[10px] font-extrabold text-pink-700 shadow-xs">
                DEKORASI
              </span>
              <span className="animate-float-slow px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-[10px] font-extrabold text-orange-700 shadow-xs">
                PERLENGKAPAN
              </span>
              <span className="animate-float-delayed px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-[10px] font-extrabold text-sky-700 shadow-xs">
                PDD
              </span>
            </div>

            {/* Glass Outer Frame */}
            <div className="rounded-3xl p-2 sm:p-2.5 bg-white/75 backdrop-blur-md border border-white shadow-2xl shadow-indigo-900/10">
              {/* Mini Live Stage Gradient Hero */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 text-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-[10px] font-extrabold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE PREVIEW · {activeSegment.section}
                  </span>
                  <span className="text-[11px] font-mono text-indigo-100 font-semibold">
                    Sync: 0ms Drift
                  </span>
                </div>

                <div>
                  <div className="text-[11px] text-indigo-100/80 uppercase tracking-wider font-semibold">
                    Current Segment
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold mt-0.5 leading-snug">
                    {activeSegment.label}
                  </div>
                  <p className="text-xs text-indigo-100/90 mt-1 line-clamp-2">
                    &ldquo;{activeSegment.cue}&rdquo;
                  </p>
                </div>

                {/* Live Ticking Clock Container */}
                <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3.5 backdrop-blur-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-100/85">
                    <span>Actual Runtime</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      Target: {activeSegment.targetMinutes}m
                    </span>
                  </div>
                  <div className="mt-1.5 text-center font-mono font-black tracking-tight tabular-nums text-3xl sm:text-4xl text-white">
                    {formatSecondsToHHMMSS(currentElapsed)}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold">
                      Tersisa {formatSecondsToMMSS(remainingSecs)}
                    </span>
                    <span className="text-indigo-100 font-semibold">
                      3-Min CUE Armed
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-200 transition-all duration-300"
                      style={{ width: `${activeSegment.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Interactive Preview Segment Switcher */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-100/80">
                    Coba Simulasi Perpindahan Segmen:
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PREVIEW_SEGMENTS.map((seg, idx) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => {
                          setSelectedSegIdx(idx);
                          setTickOffset(0);
                        }}
                        className={`px-2 py-1.5 rounded-xl text-[11px] font-bold transition truncate ${
                          selectedSegIdx === idx
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES */}
        <section id="fitur" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                Arsitektur Terpadu
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Semua Divisi Bergerak Serentak
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Dirancang khusus untuk alur kerja tim kreatif gereja—dari persiapan pra-acara hingga evaluasi LPJ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Bento 1 */}
            <div
              className="md:col-span-7 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200/80 p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 animate-tab-enter"
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase">
                  Master Clock Sync
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-4">
                Live Stage Control &amp; Smart Cue Alert
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Satu sumber waktu utama dari Event Leader memastikan timer panggung, peringatan
                3 menit sebelum perpindahan segmen, dan perubahan urutan dadakan (*Change Queue*)
                tersinkron seketika ke seluruh perangkat kru.
              </p>
            </div>

            {/* Bento 2 */}
            <div
              className="md:col-span-5 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200/80 p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-purple-200 transition-all duration-200 animate-tab-enter"
              style={{ animationDelay: "120ms" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-extrabold uppercase">
                  Role-Based Guard
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-4">
                Ruang Seksi &amp; Layar Cue Card MC
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Rundown Builder &amp; Deck Cue Card MC untuk Acara, status instalasi Dekorasi,
                checklist alat Perlengkapan, hingga shotlist &amp; Drive PDD—dengan mode monitoring khusus pimpinan.
              </p>
            </div>

            {/* Bento 3 */}
            <div
              className="md:col-span-5 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200/80 p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-amber-200 transition-all duration-200 animate-tab-enter"
              style={{ animationDelay: "180ms" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-4">
                Timeline, Kalender &amp; Generator Proposal Word
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Pantau progres task mingguan lengkap dengan bulan &amp; tahun, kelola jadwal kalender,
                dan tarik langsung data event menjadi dokumen Proposal Microsoft Word (`.doc`).
              </p>
            </div>

            {/* Bento 4 */}
            <div
              className="md:col-span-7 rounded-3xl bg-white/85 backdrop-blur-md border border-slate-200/80 p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-emerald-200 transition-all duration-200 animate-tab-enter"
              style={{ animationDelay: "240ms" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <Presentation className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-4">
                Pembiayaan Bendahara, Notulensi Sekretaris &amp; Evaluasi Terisolasi per Event
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Setiap event memiliki buku anggaran estimasi–aktual, catatan rapat koordinasi, dan
                laporan evaluasi insiden/LPJ yang terisolasi bersih sehingga antar-acara tidak pernah tercampur.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white p-6 sm:p-8 shadow-xl shadow-indigo-600/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Siap Memimpin Pelayanan Hari Ini?
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100">
              Masuk menggunakan akun dan 4-digit PIN Anda untuk mengakses workspace event aktif.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-sm shadow-lg transition shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>Masuk ke Workspace</span>
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 bg-white/70 backdrop-blur-sm py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} Creative Team — Church Event OS</span>
          <span className="font-medium">Terproteksi Akses Wajib Login &amp; Isolasi Data Event</span>
        </div>
      </footer>
    </div>
  );
}
