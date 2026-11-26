"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumberBadge } from "@/components/motion/animated-primitives";
import { FADE_FAST, SPRING_SNAPPY, SPRING_TAB } from "@/providers/motion-provider";
import {
  Home,
  Radio,
  CheckSquare,
  Layers,
  LayoutGrid,
  ClipboardCheck,
  Calendar,
  Wallet,
  FileText,
  BookOpen,
  CalendarDays,
  Presentation,
  Users,
  User as UserIcon,
  Shield,
  X,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { User, Event, EventRosterMember } from "@/types/domain";
import {
  isCreativeLeader,
  canManageEventRoster,
  isUnassignedMember,
  getFinanceAccessMode,
  getNotesAccessMode,
  getProposalAccessMode,
} from "@/lib/mock-db";

export type TabType =
  | "home"
  | "live"
  | "rundown"
  | "evaluation"
  | "sections"
  | "timeline"
  | "calendar"
  | "finance"
  | "notes"
  | "proposal"
  | "members"
  | "profile";

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  openIncidentsCount?: number;
  pendingMyTaskCount?: number;
  currentUser?: User | null;
  activeEvent?: Event | null;
  roster?: EventRosterMember[];
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

const DRAWER_ONLY_TABS: TabType[] = [
  "evaluation",
  "calendar",
  "finance",
  "notes",
  "proposal",
  "members",
  "profile",
];

export function BottomNav({
  activeTab,
  onChangeTab,
  openIncidentsCount = 0,
  pendingMyTaskCount = 0,
  currentUser,
  activeEvent,
  roster = [],
  onOpenLogin,
  onLogout,
}: BottomNavProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isLive =
    activeEvent?.status === "EVENT_DAY" &&
    !!activeEvent?.live_started_at &&
    !activeEvent?.live_ended_at;

  const unassigned = isUnassignedMember(currentUser ?? null);

  const primaryTabs: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    liveDot?: boolean;
    badge?: number;
  }> = unassigned
    ? [
        { id: "home", label: "Home", icon: Home },
        { id: "timeline", label: "Timeline", icon: CheckSquare, badge: pendingMyTaskCount },
        { id: "calendar", label: "Calendar", icon: Calendar },
        { id: "profile", label: "Profil", icon: UserIcon },
      ]
    : [
        { id: "home", label: "Home", icon: Home },
        { id: "live", label: "Live", icon: Radio, liveDot: isLive },
        { id: "timeline", label: "Timeline", icon: CheckSquare, badge: pendingMyTaskCount },
        { id: "sections", label: "Sections", icon: Layers },
      ];

  const workspaceItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    liveDot?: boolean;
  }> = [
    { id: "home", label: "Home Dashboard", icon: Home },
    ...(!unassigned
      ? [
          { id: "live" as TabType, label: "Live Rundowns", icon: Radio, liveDot: isLive },
          {
            id: "evaluation" as TabType,
            label: "Event Evaluations",
            icon: ClipboardCheck,
            badge: openIncidentsCount,
          },
        ]
      : []),
    {
      id: "timeline",
      label: "Tasks & Timeline",
      icon: CheckSquare,
      badge: pendingMyTaskCount,
    },
    { id: "calendar", label: "Calendar & Schedule", icon: Calendar },
    ...(!unassigned ? [{ id: "sections" as TabType, label: "Sections & Tools", icon: Layers }] : []),
    ...(getFinanceAccessMode(currentUser ?? null) !== "LOCKED"
      ? [{ id: "finance" as TabType, label: "Pembiayaan & Anggaran", icon: Wallet }]
      : []),
    ...(getNotesAccessMode(currentUser ?? null) !== "LOCKED"
      ? [{ id: "notes" as TabType, label: "Sekretariat", icon: FileText }]
      : []),
    ...(getProposalAccessMode(currentUser ?? null) !== "LOCKED"
      ? [{ id: "proposal" as TabType, label: "Dokumen Project Brief", icon: BookOpen }]
      : []),
    ...(isCreativeLeader(currentUser ?? null)
      ? [{ id: "members" as TabType, label: "Manajemen Member", icon: Users }]
      : []),
    { id: "profile", label: "Edit Profil Akun", icon: UserIcon },
  ];

  const isMenuActive = isDrawerOpen || DRAWER_ONLY_TABS.includes(activeTab);

  const initials = currentUser?.full_name
    ? currentUser.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "CT";

  const handleSelectTab = (tab: TabType) => {
    onChangeTab(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Navigation Drawer / Bottom Sheet */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Semua Menu Navigasi Mobile"
            className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_FAST}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs"
            />

            {/* Scrollable Sheet */}
            <motion.div
              data-lenis-prevent
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SPRING_SNAPPY}
              className="relative z-10 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-8 shadow-2xl border-t border-slate-200"
            >
            {/* Sheet Header + Drag Handle */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Menu Creative Team
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pilih modul atau manajemen event
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Tutup menu"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active User Profile Card */}
            <div className="mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              {currentUser ? (
                <div className="flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectTab("profile")}
                    className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {currentUser.full_name}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 truncate">
                        {currentUser.base_role.replace("_", " ")} • Edit Profil
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onLogout?.();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Akun</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenLogin?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk dengan PIN</span>
                </button>
              )}
            </div>

            {/* Workspace Menu List */}
            <div className="space-y-1.5 mb-5">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Workspace Menu
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {workspaceItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition border",
                        isActive
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold"
                          : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0",
                            isActive ? "text-indigo-600" : "text-slate-400"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.liveDot && (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            item.id === "timeline"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-rose-100 text-rose-700"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manajemen Event & Panggung */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Manajemen Event &amp; Panggung
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {canManageEventRoster(currentUser ?? null, roster) && (
                  <Link
                    href="/events"
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50/70 border border-indigo-200 hover:bg-indigo-100 transition"
                  >
                    <CalendarDays className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">Events &amp; Roster</span>
                  </Link>
                )}
                <Link
                  href="/cue-cards"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition"
                >
                  <Presentation className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">Cue Cards MC</span>
                </Link>
                {currentUser?.is_superadmin && (
                  <Link
                    href="/superadmin"
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50/70 border border-indigo-200 hover:bg-indigo-100 transition"
                  >
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">Server Maintenance</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Fixed Bottom Bar */}
      <nav
        aria-label="Navigasi Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] py-1.5 px-2 safe-bottom"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = !isDrawerOpen && activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 select-none",
                  isActive
                    ? "bg-indigo-50 text-indigo-600 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-200",
                      isActive && "scale-105 text-indigo-600"
                    )}
                  />
                  {tab.liveDot && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <AnimatedNumberBadge
                      value={tab.badge}
                      className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center shadow-sm"
                    />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    transition={SPRING_TAB}
                    className="absolute -bottom-1.5 w-6 h-0.5 rounded-full bg-indigo-600"
                  />
                )}
              </button>
            );
          })}

          {/* 5th Tab: Menu Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className={cn(
              "relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 select-none",
              isMenuActive
                ? "bg-indigo-50 text-indigo-600 font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <div className="relative">
              <LayoutGrid
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isMenuActive && "scale-105 text-indigo-600"
                )}
              />
              {openIncidentsCount > 0 && (
                <AnimatedNumberBadge
                  value={openIncidentsCount}
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-sm"
                />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
              Menu
            </span>
            {isMenuActive && (
              <motion.div
                layoutId="bottom-nav-active-pill"
                transition={SPRING_TAB}
                className="absolute -bottom-1.5 w-6 h-0.5 rounded-full bg-indigo-600"
              />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
