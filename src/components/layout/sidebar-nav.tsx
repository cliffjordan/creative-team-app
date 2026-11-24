"use client";

import React from "react";
import Link from "next/link";
import {
  Home,
  Radio,
  ClipboardCheck,
  CheckSquare,
  Layers,
  CalendarDays,
  Calendar,
  Presentation,
  Wallet,
  FileText,
  BookOpen,
  Users,
  User as UserIcon,
  Shield,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/ui/brand-logo";
import { User, Event, EventRosterMember } from "@/types/domain";
import {
  isCreativeLeader,
  canManageEventRoster,
  isUnassignedMember,
  getFinanceAccessMode,
  getNotesAccessMode,
  getProposalAccessMode,
} from "@/lib/mock-db";
import { TabType } from "@/components/layout/bottom-nav";

interface SidebarNavProps {
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

export function SidebarNav({
  activeTab,
  onChangeTab,
  openIncidentsCount = 0,
  pendingMyTaskCount = 0,
  currentUser,
  activeEvent,
  roster = [],
  onOpenLogin,
  onLogout,
}: SidebarNavProps) {
  const isLive = activeEvent?.status === "EVENT_DAY" && !!activeEvent?.live_started_at && !activeEvent?.live_ended_at;
  const unassigned = isUnassignedMember(currentUser ?? null);

  const navItems: Array<{
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
      ? [{ id: "finance" as TabType, label: "Pembiayaan", icon: Wallet }]
      : []),
    ...(getNotesAccessMode(currentUser ?? null) !== "LOCKED"
      ? [{ id: "notes" as TabType, label: "Sekretariat", icon: FileText }]
      : []),
    ...(getProposalAccessMode(currentUser ?? null) !== "LOCKED"
      ? [{ id: "proposal" as TabType, label: "Dokumen Event Brief", icon: BookOpen }]
      : []),
    ...(isCreativeLeader(currentUser ?? null)
      ? [{ id: "members" as TabType, label: "Manajemen Member", icon: Users }]
      : []),
  ];

  const initials = currentUser?.full_name
    ? currentUser.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "CT";

  return (
    <aside
      aria-label="Navigasi Desktop"
      className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white border-r border-slate-200/90 z-40"
    >
      {/* Prism Spectrum Top Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-cyan-500" />
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <BrandLogo size="md" />
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
            Creative Team
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate">
            Church Event OS
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Workspace Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
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
                    "px-2 py-0.5 rounded-full text-[11px] font-bold",
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

        <div className="pt-4 mt-4 border-t border-slate-100">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Manajemen Event
          </div>
          {canManageEventRoster(currentUser ?? null, roster) && (
            <Link
              href="/events"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
            >
              <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">Events &amp; Roster</span>
            </Link>
          )}
          <Link
            href="/cue-cards"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
          >
            <Presentation className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Cue Cards MC</span>
          </Link>
          {currentUser?.is_superadmin && (
            <Link
              href="/superadmin"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-all mt-1"
            >
              <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Server Maintenance</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom User Profile */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        {currentUser ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <button
              type="button"
              onClick={() => onChangeTab("profile")}
              title="Edit Profil Akun"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg hover:bg-slate-50 p-0.5 transition"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                  <span className="truncate">{currentUser.full_name}</span>
                  <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 truncate">
                  {currentUser.base_role.replace("_", " ")} • Profil
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Ganti Akun / Logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20 hover:opacity-95 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk dengan PIN</span>
          </button>
        )}
      </div>
    </aside>
  );
}
