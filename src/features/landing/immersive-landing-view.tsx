"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Layers,
  Lock,
  LogIn,
  Menu,
  Mic2,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  SkipForward,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { formatSecondsToHHMMSS, formatSecondsToMMSS } from "@/lib/utils";

interface ImmersiveLandingViewProps {
  onOpenLogin: () => void;
}

interface DemoSegment {
  id: string;
  code: string;
  title: string;
  pic: string;
  section: string;
  durationSec: number;
  cueScript: string;
  techNote: string;
  accentHex: string;
  badgeClass: string;
}

const DEMO_SEGMENTS: DemoSegment[] = [
  {
    id: "seg-01",
    code: "CUE 01",
    title: "Countdown & Opening Bumper",
    pic: "Tim Multimedia & Usher",
    section: "PDD • Audio Visual",
    durationSec: 180,
    cueScript: "Lampu auditorium dipadamkan ke 20%. Bumper intro berjalan tepat saat timer menyentuh 00:10.",
    techNote: "FOH Audio Ch 1-2 Active • LED Wall Preset A",
    accentHex: "#F59E0B",
    badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
  {
    id: "seg-02",
    code: "CUE 02",
    title: "MC Welcome & Ice Breaking",
    pic: "Host Utama & Floor Director",
    section: "Acara • Stage Command",
    durationSec: 420,
    cueScript: "MC masuk dari sisi kiri panggung. Spotlight hangat menyala dan musik transisi fade-out perlahan.",
    techNote: "Handheld Mic 1 & 2 Live • Floor Monitor +2dB",
    accentHex: "#D946EF",
    badgeClass: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/30",
  },
  {
    id: "seg-03",
    code: "CUE 03",
    title: "Sesi Inti & Penayangan Materi",
    pic: "Pembicara & Operator Slide",
    section: "Produksi • Dokumentasi",
    durationSec: 1500,
    cueScript: "Lower-third pembicara tampil selama 8 detik pertama. Tim PDD mengunci frame close-up kamera B.",
    techNote: "Timer Panggung Sinkron • Cam A Wide / Cam B Tight",
    accentHex: "#06B6D4",
    badgeClass: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  },
];

const FEATURE_QUADRANTS = [
  {
    index: "01.A",
    spectrumLabel: "SOLAR AMBER • LIVE ENGINE",
    dotColor: "#F59E0B",
    borderHover: "hover:bg-amber-50/40",
    title: "Live Stage Sync & Stopwatch Presisi",
    description:
      "Satu timer komando yang tersinkronisasi untuk seluruh kru. Stage Manager mengendalikan play, pause, lompat segmen, serta alert overtime secara real-time tanpa miss komunikasi.",
    highlights: ["Zero-drift countdown & overtime indicator", "Audit trail log perpindahan segmen"],
    icon: Radio,
    iconTint: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  {
    index: "01.B",
    spectrumLabel: "CRIMSON MAGENTA • SCRIPT & CUE",
    dotColor: "#D946EF",
    borderHover: "hover:bg-fuchsia-50/40",
    title: "MC Cue Card Deck & Prompting Otomatis",
    description:
      "Kartu cue digital otomatis bergeser mengikuti segmen aktif di panggung. MC dan talent melihat naskah, durasi tersisa, dan catatan teknis pencahayaan dalam layar yang bersih.",
    highlights: ["Auto-follow active rundown segment", "Catatan audio, visual & posisi talent"],
    icon: Mic2,
    iconTint: "text-fuchsia-600 bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  {
    index: "01.C",
    spectrumLabel: "ROYAL INDIGO • STRICT RBAC",
    dotColor: "#4F46E5",
    borderHover: "hover:bg-indigo-50/40",
    title: "Isolasi Anggaran, Notulensi & Inventaris",
    description:
      "Kontrol akses ketat memisahkan data sensitif. RAB & buku kas hanya terbuka untuk Leader serta Bendahara, sementara setiap seksi mengelola checklist peralatan dan shotlist masing-masing.",
    highlights: ["Privasi tab Keuangan & Sekretariat", "Inventaris Perlengkapan, Dekorasi & PDD"],
    icon: ShieldCheck,
    iconTint: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    index: "01.D",
    spectrumLabel: "ELECTRIC CYAN • DOCUMENTATION",
    dotColor: "#06B6D4",
    borderHover: "hover:bg-cyan-50/40",
    title: "Event Roster, Timeline & Ekspor Word",
    description:
      "Rencanakan jadwal persiapan tim lintas minggu dan tugaskan peran per event. Saat proposal atau laporan dibutuhkan, hasilkan dokumen Microsoft Word (.docx) langsung dari data proyek.",
    highlights: ["Penugasan role fleksibel per event", "Generate Proposal & Laporan .docx instan"],
    icon: FileText,
    iconTint: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20",
  },
];

interface RoleSpec {
  id: string;
  label: string;
  accent: string;
  title: string;
  summary: string;
  permissions: string[];
}

const ROLE_SPECS: RoleSpec[] = [
  {
    id: "leader",
    label: "Creative Leader",
    accent: "#4F46E5",
    title: "Komando Menyeluruh & Superadmin Sistem",
    summary:
      "Anggota pertama yang mendaftar lewat /register otomatis dipromosikan menjadi Creative Leader dengan kendali penuh atas pembuatan event, manajemen roster, keuangan, dan live stage.",
    permissions: [
      "Membuat & mengarsipkan Event baru beserta Event Roster",
      "Akses penuh tab Anggaran (RAB), Notulensi, dan Ekspor Proposal",
      "Kontrol penuh Stage Console & evaluasi pasca-acara",
    ],
  },
  {
    id: "finance",
    label: "Bendahara & Sekretaris",
    accent: "#F59E0B",
    title: "Tata Kelola Kas, Proposal & Notulensi Rapat",
    summary:
      "Ruang kerja terisolasi agar data pencairan dana, struk pengeluaran, dan risalah keputusan inti tetap aman serta tidak bercampur dengan ruang operasional kru lapangan.",
    permissions: [
      "Mengelola buku kas pemasukan, pengeluaran & lampiran anggaran",
      "Menyusun notulensi rapat koordinasi & action items tim",
      "Menyusun dan mengekspor berkas proposal event resmi (.docx)",
    ],
  },
  {
    id: "section",
    label: "Koordinator Seksi",
    accent: "#06B6D4",
    title: "Acara, PDD, Dekorasi & Perlengkapan",
    summary:
      "Setiap koordinator seksi berfokus pada kesiapan sub-divisinya: mulai dari daftar shotlist kamera, tata letak dekorasi panggung, hingga audit ketersediaan alat.",
    permissions: [
      "Menyusun rundown detail, kebutuhan teknis & cue transisi",
      "Mengelola inventaris alat, backdrop dekorasi & referensi PDD",
      "Memantau status kesiapan tugas tim di Timeline H-30 s/d Hari-H",
    ],
  },
  {
    id: "stage",
    label: "MC & Stage Crew",
    accent: "#D946EF",
    title: "Eksekusi Hari-H Tanpa Gangguan",
    summary:
      "Tampilan kontras tinggi bebas distraksi untuk penggunaan di backstage maupun podium. Fokus pada sisa waktu segmen berjalan dan naskah cue berikutnya.",
    permissions: [
      "Melihat timer Live Stage secara sinkron di perangkat HP/Tablet",
      "Membaca MC Cue Card Deck dengan penanda segmen berikutnya",
      "Melaporkan kendala lapangan dengan cepat selama acara berjalan",
    ],
  },
];

const WORKFLOW_STEPS = [
  {
    step: "STEP 01",
    title: "Daftar Akun & PIN",
    detail:
      "Anggota baru mendaftar melalui halaman /register dengan nama lengkap, kontak, role, dan PIN pribadi terenkripsi.",
    color: "#F59E0B",
  },
  {
    step: "STEP 02",
    title: "Bentuk Event & Roster",
    detail:
      "Creative Leader membuat acara perdana dan menugaskan anggota sesuai perannya di dalam roster event tersebut.",
    color: "#EF4444",
  },
  {
    step: "STEP 03",
    title: "Lengkapi Pra-Produksi",
    detail:
      "Setiap seksi mengisi rundown, timeline tugas, inventaris perlengkapan, notulensi, dan rancangan anggaran.",
    color: "#4F46E5",
  },
  {
    step: "STEP 04",
    title: "Jalankan Live Stage",
    detail:
      "Masuk menggunakan PIN pada hari pelaksanaan untuk menyinkronkan stopwatch panggung, cue card MC, dan evaluasi tim.",
    color: "#06B6D4",
  },
];

const EASE_EDITORIAL = [0.22, 1, 0.36, 1] as const;

export function ImmersiveLandingView({ onOpenLogin }: ImmersiveLandingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(64);
  const [activeRole, setActiveRole] = useState<string>("leader");

  useGSAP(
    () => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.registerPlugin(ScrollTrigger);

      gsap.from(".gsap-hero-cell", {
        opacity: 0,
        y: 22,
        duration: 0.65,
        stagger: 0.12,
        ease: "power3.out",
        clearProps: "transform",
      });

      gsap.from(".gsap-feature-card", {
        opacity: 0,
        y: 20,
        duration: 0.55,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform",
        scrollTrigger: {
          trigger: "#fitur",
          start: "top 82%",
          once: true,
        },
      });

      gsap.from(".gsap-workflow-step", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.09,
        ease: "power3.out",
        clearProps: "transform",
        scrollTrigger: {
          trigger: "#alur",
          start: "top 84%",
          once: true,
        },
      });
    },
    { scope: containerRef }
  );

  const currentSegment = DEMO_SEGMENTS[segmentIndex];
  const currentRoleSpec = ROLE_SPECS.find((r) => r.id === activeRole) ?? ROLE_SPECS[0];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => {
        if (prev + 1 >= currentSegment.durationSec) {
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSegment.durationSec]);

  const handleNextSegment = () => {
    setSegmentIndex((prev) => (prev + 1) % DEMO_SEGMENTS.length);
    setElapsedSec(18);
  };

  const remainingSec = Math.max(0, currentSegment.durationSec - elapsedSec);
  const progressPct = Math.min(100, Math.round((elapsedSec / currentSegment.durationSec) * 100));

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#FAF9F5] text-slate-900 overflow-x-hidden selection:bg-indigo-600 selection:text-white"
    >
      {/* Top 4-Spectrum Prism Hairline Accent */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-[#F59E0B] via-[#EF4444] via-[#D946EF] via-[#4F46E5] to-[#06B6D4]"
      />

      {/* Sticky Editorial Topbar */}
      <header className="sticky top-0 z-40 border-b border-slate-900/15 bg-[#FAF9F5]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                CREATIVE TEAM HUB
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                STAGE &amp; PRODUCTION OS
              </span>
            </div>
          </div>

          {/* Desktop Navigation Anchors */}
          <nav
            aria-label="Navigasi Landing Page"
            className="hidden items-center gap-8 font-mono text-xs uppercase tracking-[0.14em] text-slate-600 md:flex"
          >
            <a href="#fitur" className="transition-colors hover:text-slate-900">
              01 / Modul
            </a>
            <a href="#arsitektur" className="transition-colors hover:text-slate-900">
              02 / Akses Role
            </a>
            <a href="#alur" className="transition-colors hover:text-slate-900">
              03 / Alur Kerja
            </a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-900/20 bg-white px-4 text-xs font-semibold tracking-wide text-slate-800 transition-all hover:border-slate-900/50 hover:bg-slate-50"
            >
              <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
              Daftar Akun
            </Link>
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-indigo-600 active:scale-[0.98]"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk (Login)
            </button>
          </div>

          {/* Mobile Compact Action + Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-900/20 bg-white text-slate-800"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_EDITORIAL }}
              className="overflow-hidden border-t border-slate-900/15 bg-white md:hidden"
            >
              <div className="space-y-3 px-4 py-4">
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-600">
                  <a
                    href="#fitur"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-center hover:bg-slate-50"
                  >
                    01 / Modul
                  </a>
                  <a
                    href="#arsitektur"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-center hover:bg-slate-50"
                  >
                    02 / Role
                  </a>
                  <a
                    href="#alur"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-center hover:bg-slate-50"
                  >
                    03 / Alur
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Link
                    href="/register"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-900/20 bg-[#FAF9F5] px-3 text-xs font-semibold text-slate-900"
                  >
                    <UserPlus className="h-4 w-4 text-indigo-600" />
                    Daftar Akun
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    Masuk PIN
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* HERO SPLIT ARCHITECTURAL GRID */}
        <section className="border-b border-slate-900/15">
          <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12">
            {/* Hero Left Cell */}
            <div className="gsap-hero-cell flex flex-col justify-between px-4 py-10 sm:px-8 sm:py-14 lg:col-span-7 lg:border-r lg:border-slate-900/15 lg:px-10 lg:py-16">
              <div>
                {/* Monospace Eyebrow */}
                <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-900/15 bg-white px-3.5 py-1.5 shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 sm:text-[11px]">
                    Mandatory Login Gate • Internal Team Platform
                  </span>
                </div>

                {/* Editorial Display Headline */}
                <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                  Satu Meja Komando untuk{" "}
                  <span className="bg-gradient-to-r from-[#EA580C] via-[#D946EF] to-[#4F46E5] bg-clip-text text-transparent">
                    Produksi &amp; Live Stage
                  </span>{" "}
                  Tim Kreatif.
                </h1>

                {/* Editorial Copy */}
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                  Dirancang dengan struktur kerja terukur dari pra-produksi hingga detik terakhir
                  di atas panggung. Sinkronkan stopwatch live, naskah MC, inventaris seksi, dan
                  buku kas secara aman dalam satu workspace tertutup.
                </p>

                {/* Primary & Secondary CTAs (Mobile-First Stacked / Row) */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-600 active:scale-[0.98] sm:w-auto"
                  >
                    <Lock className="h-4 w-4 text-amber-400 transition-transform group-hover:scale-110" />
                    Masuk ke Workspace (PIN)
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <Link
                    href="/register"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-900/20 bg-white px-6 text-sm font-semibold text-slate-900 shadow-xs transition-all hover:border-indigo-500/50 hover:bg-indigo-50/40 active:scale-[0.98] sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4 text-indigo-600" />
                    Daftar Akun Anggota Baru
                  </Link>
                </div>

                {/* Note for First User */}
                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>
                    Database baru masih kosong? Pendaftar pertama via{" "}
                    <Link
                      href="/register"
                      className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700"
                    >
                      /register
                    </Link>{" "}
                    otomatis menjadi <strong>Creative Leader</strong>.
                  </span>
                </p>
              </div>

              {/* Bottom Micro Architectural Spec Row */}
              <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-900/15 pt-6 sm:grid-cols-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    SPECTRUM ACCESS
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">RBAC 4-Role</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    STAGE CLOCK
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Real-Time Sync</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    DATA BACKEND
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Supabase + RLS</p>
                </div>
              </div>
            </div>

            {/* Hero Right Cell: Interactive Live Stage Console Preview */}
            <div className="gsap-hero-cell flex flex-col justify-center bg-[#F3F1EA]/80 px-4 py-10 sm:px-8 sm:py-12 lg:col-span-5 lg:px-8">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  SIMULASI LIVE STAGE CONSOLE
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 border border-emerald-500/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  PREVIEW MODE
                </span>
              </div>

              {/* Console Frame */}
              <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white shadow-xl shadow-slate-900/5">
                {/* Console Top Spectrum Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#F59E0B] via-[#D946EF] to-[#06B6D4]" />

                <div className="p-5 sm:p-6">
                  {/* Top Bar Inside Console */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${currentSegment.badgeClass}`}
                      >
                        {currentSegment.code}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {currentSegment.section}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPlaying((prev) => !prev)}
                        aria-label={isPlaying ? "Jeda simulasi stopwatch" : "Mulai simulasi stopwatch"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                      >
                        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleNextSegment}
                        aria-label="Lanjut ke segmen demo berikutnya"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-[11px] font-semibold text-slate-700 transition-colors hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                      >
                        NEXT
                        <SkipForward className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Animated Segment Details */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSegment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: EASE_EDITORIAL }}
                      className="mt-5"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        SEGMEN BERJALAN
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                        {currentSegment.title}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        PIC Utama: <span className="text-slate-800">{currentSegment.pic}</span>
                      </p>

                      {/* Stopwatch Readout */}
                      <div className="mt-5 rounded-xl border border-slate-900/10 bg-[#FAF9F5] p-4">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                              SISA WAKTU SEGMEN
                            </span>
                            <span className="mt-0.5 block font-mono text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                              {formatSecondsToHHMMSS(remainingSec)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                              DURASI TOTAL
                            </span>
                            <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-600">
                              {formatSecondsToMMSS(currentSegment.durationSec)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: currentSegment.accentHex }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                        </div>
                      </div>

                      {/* Cue & Technical Note */}
                      <div className="mt-4 space-y-2.5">
                        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                            MC &amp; FLOOR CUE
                          </span>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {currentSegment.cueScript}
                          </p>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3.5 py-2.5 text-[11px] font-mono text-slate-200">
                          <span className="truncate">{currentSegment.techNote}</span>
                          <span className="ml-2 shrink-0 text-cyan-400">SYNC OK</span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Segment Switcher Dots */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      Pilih Cue Demo:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {DEMO_SEGMENTS.map((seg, idx) => (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => {
                            setSegmentIndex(idx);
                            setElapsedSec(18);
                          }}
                          className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold transition-all ${
                            idx === segmentIndex
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          0{idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 01: ARCHITECTURAL 2x2 FEATURE LEDGER */}
        <section id="fitur" className="border-b border-slate-900/15 bg-[#FAF9F5]">
          <div className="mx-auto max-w-7xl">
            {/* Section Title Row */}
            <div className="flex flex-col gap-3 px-4 py-10 sm:px-8 sm:py-12 lg:flex-row lg:items-end lg:justify-between lg:px-10">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                  01 / ARSITEKTUR MODUL INTI
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Empat Pilar Spektrum Kerja Tim Kreatif
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-600">
                Terinspirasi dari empat warna spektrum logo kami — setiap divisi terhubung pada
                sistem rundown tunggal tanpa mencampurkan hak akses data sensitif.
              </p>
            </div>

            {/* 2x2 Exposed Hairline Grid */}
            <div className="grid grid-cols-1 border-t border-slate-900/15 md:grid-cols-2">
              {FEATURE_QUADRANTS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.index}
                    className={`gsap-feature-card group flex flex-col justify-between border-b border-slate-900/15 p-6 transition-colors sm:p-8 lg:p-10 md:odd:border-r ${item.borderHover} ${
                      index >= 2 ? "md:border-b-0" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.dotColor }}
                          />
                          {item.index} — {item.spectrumLabel}
                        </span>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${item.iconTint}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>

                      <h3 className="mt-6 text-xl font-bold tracking-tight text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {item.description}
                      </p>
                    </div>

                    <ul className="mt-6 space-y-2 border-t border-slate-900/10 pt-4">
                      {item.highlights.map((hl) => (
                        <li key={hl} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: item.dotColor }}
                          />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 02: INTERACTIVE ROLE & SECURITY ARCHITECTURE */}
        <section id="arsitektur" className="border-b border-slate-900/15 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12">
            {/* Left Intro & Role Selector Tabs */}
            <div className="px-4 py-10 sm:px-8 sm:py-14 lg:col-span-5 lg:border-r lg:border-slate-900/15 lg:px-10">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                02 / KONTROL AKSES &amp; GERBANG PIN
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Tampilan Adaptif Sesuai Jabatan Anggota
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Tidak ada lagi dokumen penting yang salah dilihat. Setiap anggota masuk dengan PIN
                pribadi dan langsung disuguhkan modul yang relevan bagi perannya.
              </p>

              {/* Interactive Role Pills */}
              <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {ROLE_SPECS.map((role) => {
                  const selected = role.id === activeRole;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setActiveRole(role.id)}
                      className={`relative flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-slate-900 bg-slate-950 text-white shadow-sm"
                          : "border-slate-200 bg-[#FAF9F5] text-slate-800 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: role.accent }}
                        />
                        <span className="text-sm font-semibold">{role.label}</span>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          selected ? "translate-x-0.5 text-white" : "text-slate-400"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Animated Role Detail Panel */}
            <div className="flex flex-col justify-center bg-[#FAF9F5]/60 px-4 py-10 sm:px-8 sm:py-14 lg:col-span-7 lg:px-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentRoleSpec.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.28, ease: EASE_EDITORIAL }}
                  className="rounded-2xl border border-slate-900/15 bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: currentRoleSpec.accent }}
                      />
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        ROLE SPEC • {currentRoleSpec.label}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-700">
                      <Users className="h-3 w-3" />
                      TERISOLASI RLS
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-slate-950 sm:text-2xl">
                    {currentRoleSpec.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    {currentRoleSpec.summary}
                  </p>

                  <div className="mt-6 space-y-3">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      HAK AKSES UTAMA DALAM WORKSPACE:
                    </p>
                    {currentRoleSpec.permissions.map((perm) => (
                      <div
                        key={perm}
                        className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-[#FAF9F5] p-3.5"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: currentRoleSpec.accent }}
                        />
                        <span className="text-sm text-slate-800">{perm}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* SECTION 03: EDITORIAL WORKFLOW STRIP */}
        <section id="alur" className="border-b border-slate-900/15 bg-[#FAF9F5]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  03 / ALUR OPERASIONAL BERSIH
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Mulai Dari Kosong Hingga Siap Panggung
                </h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                <CalendarClock className="h-4 w-4 text-slate-700" />
                <span>4 Langkah Terstruktur</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-900/15 bg-white sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((item, idx) => (
                <div
                  key={item.step}
                  className={`gsap-workflow-step flex flex-col justify-between p-6 ${
                    idx < WORKFLOW_STEPS.length - 1
                      ? "border-b border-slate-900/10 lg:border-b-0 lg:border-r"
                      : ""
                  } ${idx === 0 || idx === 2 ? "sm:border-r sm:border-slate-900/10" : ""}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-xs font-bold tracking-[0.18em]"
                        style={{ color: item.color }}
                      >
                        {item.step}
                      </span>
                      <Layers className="h-4 w-4 text-slate-300" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  </div>
                  <div
                    className="mt-6 h-1 w-10 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 04: CLOSING EDITORIAL GATE CTA */}
        <section className="relative overflow-hidden bg-slate-950 text-[#FAF9F5]">
          {/* Subtle Prism Aura Background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl"
          />

          <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-8 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: EASE_EDITORIAL }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
                <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                MANDATORY WORKSPACE ENTRY
              </span>

              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Siap Mengatur Acara Berikutnya?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Masuk dengan PIN akun Anda untuk langsung membuka dasbor event, atau daftarkan
                anggota baru ke dalam database tim secara aman.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#EF4444] to-[#4F46E5] px-7 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  <LogIn className="h-4 w-4" />
                  Masuk (Login PIN)
                </button>
                <Link
                  href="/register"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:w-auto"
                >
                  <UserPlus className="h-4 w-4 text-cyan-300" />
                  Daftar Akun (/register)
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Architectural Footer */}
      <footer className="border-t border-slate-900/15 bg-[#FAF9F5] px-4 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              CREATIVE TEAM HUB
            </span>
          </div>
          <p className="text-center font-mono text-[11px] text-slate-500">
            Integrated Stage &amp; Creative Ministry Operations • Secured PIN Gate
          </p>
        </div>
      </footer>
    </div>
  );
}
