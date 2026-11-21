"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

interface InactivityTimeoutProps {
  disabled?: boolean;
}

export function InactivityTimeout({ disabled = false }: InactivityTimeoutProps) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled || !currentUser) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        logout();
        router.replace("/login");
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [disabled, currentUser, logout, router]);

  return null;
}
