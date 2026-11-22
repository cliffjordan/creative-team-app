"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { INITIAL_EVENT, INITIAL_RUNDOWN_ITEMS, isUnassignedMember } from "@/lib/mock-db";
import { subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { useAuth } from "@/providers/auth-provider";
import { Event, EventTechnicalGuide, RundownItem } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Maximize2,
  Minimize2,
  Presentation,
  Radio,
} from "lucide-react";

type DeckFilter = "ALL" | "CUE_ONLY" | "RUNDOWN_ONLY";
type FontScale = "NORMAL" | "LARGE" | "XL";

interface SlideItem {
  id: string;
  kind: "CUE" | "RUNDOWN";
  badge: string;
  title: string;
  body: string;
  meta?: string;
  isActive?: boolean;
  isNext?: boolean;
}

const DEFAULT_GUIDES: EventTechnicalGuide[] = [];

export function McCueCardDeck() {
  const { currentUser, isLoading } = useAuth();
  const [guides, setGuides] = useState<EventTechnicalGuide[]>(DEFAULT_GUIDES);
  const [items, setItems] = useState<RundownItem[]>(INITIAL_RUNDOWN_ITEMS);
  const [activeEvent, setActiveEvent] = useState<Event>(INITIAL_EVENT);

  const [deckFilter, setDeckFilter] = useState<DeckFilter>("ALL");
  const [autoFollowLive, setAutoFollowLive] = useState(true);
  const [fontScale, setFontScale] = useState<FontScale>("LARGE");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionDir, setTransitionDir] = useState<"left" | "right" | "none">("none");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedGuides = localStorage.getItem("CT_SECTION_GUIDES");
      if (savedGuides) setGuides(JSON.parse(savedGuides) as EventTechnicalGuide[]);

      const savedItems = localStorage.getItem("CT_ITEMS");
      if (savedItems) setItems(JSON.parse(savedItems) as RundownItem[]);

      const savedEvent = localStorage.getItem("CT_EVENT");
      if (savedEvent) setActiveEvent(JSON.parse(savedEvent) as Event);
    } catch {}

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_SECTION_GUIDES" && Array.isArray(msg.payload)) {
        setGuides(msg.payload as EventTechnicalGuide[]);
      } else if (msg.key === "CT_ITEMS" && Array.isArray(msg.payload)) {
        setItems(msg.payload as RundownItem[]);
      } else if (msg.key === "CT_EVENT" && msg.payload) {
        setActiveEvent(msg.payload as Event);
      }
    });
    return () => unsubscribe();
  }, []);

  const slides: SlideItem[] = useMemo(() => {
    const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);
    const activeIdx = sortedItems.findIndex((it) => it.id === activeEvent.current_item_id);

    const cueSlides: SlideItem[] = guides
      .filter((g) => (g.event_id || INITIAL_EVENT.id) === activeEvent.id)
      .map((g) => ({
      id: `cue-${g.id}`,
      kind: "CUE",
      badge: g.category,
      title: g.title,
      body: g.instructions_markdown,
      meta: "Smart Digital Cue Card",
    }));

    const rundownSlides: SlideItem[] = sortedItems.map((it, idx) => ({
      id: `rnd-${it.id}`,
      kind: "RUNDOWN",
      badge: `${it.section_pic} · ${it.planned_start_time || "--:--"} (${it.estimated_duration_minutes}m)`,
      title: `#${it.order_index} ${it.title}`,
      body: it.technical_notes || it.cue_props || "Ikuti arahan Event Leader & panggung.",
      meta: it.cue_props ? `Props/Cue: ${it.cue_props}` : undefined,
      isActive: it.id === activeEvent.current_item_id || it.status === "ACTIVE",
      isNext: activeIdx !== -1 && idx === activeIdx + 1,
    }));

    if (deckFilter === "CUE_ONLY") return cueSlides;
    if (deckFilter === "RUNDOWN_ONLY") return rundownSlides;
    return [...rundownSlides, ...cueSlides];
  }, [guides, items, activeEvent.id, activeEvent.current_item_id, deckFilter]);

  useEffect(() => {
    if (!autoFollowLive) return;
    const liveIdx = slides.findIndex((s) => s.isActive);
    if (liveIdx !== -1 && liveIdx !== currentIndex) {
      setTransitionDir(liveIdx > currentIndex ? "right" : "left");
      setCurrentIndex(liveIdx);
    }
  }, [slides, autoFollowLive]);

  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(slides.length - 1);
    }
  }, [slides.length, currentIndex]);

  const goToSlide = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= slides.length) return;
    setTransitionDir(nextIdx > currentIndex ? "right" : "left");
    setCurrentIndex(nextIdx);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToSlide(currentIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToSlide(currentIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, slides.length]);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const currentSlide = slides[currentIndex];

  const textSizeClass =
    fontScale === "XL"
      ? "text-xl sm:text-2xl leading-relaxed"
      : fontScale === "LARGE"
      ? "text-base sm:text-lg leading-relaxed"
      : "text-sm sm:text-base leading-relaxed";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-xs font-semibold text-slate-500">
        Memverifikasi sesi...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Login Diperlukan</h2>
          <p className="text-xs text-slate-500">
            Silakan masuk terlebih dahulu melalui Halaman Utama untuk mengakses MC Cue Card Deck.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="primary" size="sm" className="font-bold">
                Kembali ke Halaman Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isUnassignedMember(currentUser)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Akses Cue Cards Terkunci</h2>
          <p className="text-xs text-slate-500">
            Akun Anda berstatus Member Umum dan menunggu penugasan role/divisi oleh Creative Leader.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
          >
            Kembali ke Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#F8FAFC] text-slate-900 p-4 sm:p-6 flex flex-col justify-between gap-4"
    >
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Link href="/">
            <Button size="sm" variant="ghost" className="gap-1.5 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <Presentation className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-extrabold text-slate-900">MC Cue Card Deck</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoFollowLive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              autoFollowLive
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoFollowLive ? "animate-pulse" : ""}`} />
            <span>Auto-Follow Live</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px]">
            {(["NORMAL", "LARGE", "XL"] as FontScale[]).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setFontScale(sc)}
                className={`px-2 py-0.5 rounded-lg font-bold transition ${
                  fontScale === sc ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500"
                }`}
              >
                {sc === "NORMAL" ? "A" : sc === "LARGE" ? "A+" : "A++"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="max-w-4xl w-full mx-auto grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
        {(
          [
            { id: "ALL", label: "Terpadu (Rundown + Cue)" },
            { id: "RUNDOWN_ONLY", label: "Segmen Rundown" },
            { id: "CUE_ONLY", label: "Smart Cue Cards" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setDeckFilter(tab.id);
              setCurrentIndex(0);
            }}
            className={`py-2 rounded-xl font-bold transition truncate px-2 ${
              deckFilter === tab.id
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Swipeable Slide Card */}
      <div
        className="max-w-4xl w-full mx-auto flex-1 flex items-center justify-center"
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartXRef.current === null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
          const deltaX = endX - touchStartXRef.current;
          touchStartXRef.current = null;
          if (deltaX < -50) {
            goToSlide(currentIndex + 1);
          } else if (deltaX > 50) {
            goToSlide(currentIndex - 1);
          }
        }}
      >
        {currentSlide ? (
          <div
            key={currentSlide.id}
            className={`w-full rounded-3xl bg-white border-2 p-6 sm:p-10 shadow-xl transition-all duration-300 ease-out transform ${
              transitionDir === "right"
                ? "translate-x-0 opacity-100"
                : transitionDir === "left"
                ? "translate-x-0 opacity-100"
                : "opacity-100"
            } ${
              currentSlide.isActive
                ? "border-emerald-400 shadow-emerald-500/10"
                : currentSlide.isNext
                ? "border-indigo-300"
                : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={currentSlide.kind === "CUE" ? "purple" : "cyan"}>
                  {currentSlide.badge}
                </Badge>
                {currentSlide.isActive && (
                  <Badge variant="emerald" pulse>
                    SEDANG LIVE
                  </Badge>
                )}
                {currentSlide.isNext && <Badge variant="amber">SEGMEN BERIKUTNYA</Badge>}
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                Slide {currentIndex + 1} / {slides.length}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-5">
              {currentSlide.title}
            </h1>

            <div
              className={`bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 text-slate-800 whitespace-pre-line ${textSizeClass}`}
            >
              {currentSlide.body}
            </div>

            {currentSlide.meta && (
              <div className="mt-4 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                {currentSlide.meta}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm text-slate-400">Belum ada slide Cue Card.</div>
        )}
      </div>

      {/* Bottom Slide Controls */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
        <Button
          size="md"
          variant="outline"
          disabled={currentIndex <= 0}
          onClick={() => goToSlide(currentIndex - 1)}
          className="gap-1.5 font-bold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </Button>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-md py-1">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                idx === currentIndex
                  ? "w-7 bg-indigo-600"
                  : s.isActive
                  ? "w-2.5 bg-emerald-500"
                  : "w-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        <Button
          size="md"
          variant="primary"
          disabled={currentIndex >= slides.length - 1}
          onClick={() => goToSlide(currentIndex + 1)}
          className="gap-1.5 font-bold"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
