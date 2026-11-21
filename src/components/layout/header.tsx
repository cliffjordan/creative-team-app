"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { User, Event, EventRosterMember, AppNotification } from "@/types/domain";
import { canUserAccessEvent, INITIAL_NOTIFICATIONS, isCreativeLeader } from "@/lib/mock-db";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  User as UserIcon,
  LogOut,
  CalendarDays,
  ChevronDown,
  Bell,
  CheckCheck,
} from "lucide-react";

const NOTIFICATIONS_STORAGE_KEY = "CT_NOTIFICATIONS";

interface HeaderProps {
  currentUser?: User | null;
  activeEvent?: Event | null;
  events?: Event[];
  onSelectEvent?: (eventId: string) => void;
  roster?: EventRosterMember[];
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export function Header({
  currentUser,
  activeEvent,
  events = [],
  onSelectEvent,
  roster = [],
  onOpenLogin,
  onLogout,
}: HeaderProps) {
  const isLive = activeEvent?.status === "EVENT_DAY" && !!activeEvent?.live_started_at && !activeEvent?.live_ended_at;
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const eventMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch {
      // Ignore malformed localStorage
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eventMenuRef.current && !eventMenuRef.current.contains(e.target as Node)) {
        setEventMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const accessibleEvents = useMemo(() => {
    if (!events.length) return [];
    if (!currentUser) return events;
    return events.filter((ev) => canUserAccessEvent(currentUser, ev.id, roster));
  }, [events, currentUser, roster]);

  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter((n) => n.user_id === currentUser.id);
  }, [notifications, currentUser]);

  const unreadCount = useMemo(
    () => userNotifications.filter((n) => !n.read_at).length,
    [userNotifications]
  );

  const persistNotifications = (next: AppNotification[]) => {
    setNotifications(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
    }
  };

  const markAsRead = (id: string) => {
    const now = new Date().toISOString();
    persistNotifications(
      notifications.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n))
    );
  };

  const markAllAsRead = () => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    persistNotifications(
      notifications.map((n) =>
        n.user_id === currentUser.id && !n.read_at ? { ...n, read_at: now } : n
      )
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo size="sm" className="lg:hidden" />
          <div className="min-w-0" ref={eventMenuRef}>
            <div className="flex items-center gap-2">
              <h1 className="lg:hidden text-sm font-extrabold text-slate-900 leading-none">
                Creative Team
              </h1>
              <span className="hidden lg:inline text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Event
              </span>
              {isLive ? (
                <Badge variant="emerald" pulse className="text-[10px] py-0 px-2">
                  LIVE
                </Badge>
              ) : (
                <Badge variant="purple" className="text-[10px] py-0 px-2">
                  {activeEvent?.status === "POST_EVENT"
                    ? "EVALUATION"
                    : activeEvent?.status === "COMPLETED"
                    ? "COMPLETED"
                    : "STBY"}
                </Badge>
              )}
            </div>

            {accessibleEvents.length > 0 && onSelectEvent ? (
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setEventMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 hover:text-indigo-600 transition max-w-[210px] sm:max-w-sm"
                >
                  <span className="truncate">{activeEvent?.title || "Pilih Event"}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </button>
                {eventMenuOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-1.5 z-50">
                    {accessibleEvents.map((ev) => {
                      const isSelected = ev.id === activeEvent?.id;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            onSelectEvent(ev.id);
                            setEventMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-indigo-50 text-indigo-700 font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{ev.title}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {ev.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-600 truncate max-w-[200px] mt-0.5">
                {activeEvent?.title || "Perayaan Natal 2026"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCreativeLeader(currentUser ?? null) && (
            <Link
              href="/events"
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Events &amp; Roster</span>
            </Link>
          )}

          {currentUser && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                title="Notifikasi"
                className="relative w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-50">
                  <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Notifikasi</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 mt-1">
                    {userNotifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        Belum ada notifikasi.
                      </p>
                    ) : (
                      userNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          className={`w-full text-left p-2.5 rounded-xl transition ${
                            n.read_at
                              ? "opacity-65 hover:bg-slate-50"
                              : "bg-indigo-50/70 hover:bg-indigo-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {n.title}
                            </span>
                            {!n.read_at && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentUser ? (
            <div className="flex lg:hidden items-center gap-1.5">
              <div className="flex flex-col text-right">
                <div className="text-[11px] sm:text-xs font-bold text-slate-800 truncate max-w-[92px] sm:max-w-[130px]">
                  {currentUser.full_name.split(" ")[0]}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-indigo-600 uppercase truncate max-w-[92px] sm:max-w-[130px]">
                  {currentUser.base_role.replace("_", " ")}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Ganti Akun / Logout"
                className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Login PIN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
