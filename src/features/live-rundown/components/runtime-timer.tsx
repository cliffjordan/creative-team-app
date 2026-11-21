"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { Clock, Volume2 } from "lucide-react";
import { formatSecondsToHHMMSS, formatSecondsToMMSS } from "@/lib/utils";

export interface RuntimeTimerProps {
  liveStartedAt?: string | null;
  liveEndedAt?: string | null;
  livePausedAt?: string | null;
  isPaused: boolean;
  totalPauseSeconds: number;
  clockOffsetMs?: number;
  segmentStartAt?: string | null;
  currentItemStartedAt?: string | null;
  segmentPauseSeconds: number;
  estimatedDurationMinutes: number;
  nextSegmentTitle?: string | null;
  nextSegmentSection?: string | null;
}

function RuntimeTimerComponent({
  liveStartedAt,
  liveEndedAt,
  livePausedAt,
  isPaused,
  totalPauseSeconds,
  clockOffsetMs = 0,
  segmentStartAt,
  currentItemStartedAt,
  segmentPauseSeconds,
  estimatedDurationMinutes,
  nextSegmentTitle,
  nextSegmentSection,
}: RuntimeTimerProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const effectiveSegmentStart = segmentStartAt || currentItemStartedAt;

  useEffect(() => {
    setNow(Date.now());
  }, [liveStartedAt, liveEndedAt, livePausedAt, effectiveSegmentStart, isPaused]);

  useEffect(() => {
    if (liveEndedAt || isPaused) return;
    const syncNow = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    };
    const handleFocus = () => setNow(Date.now());
    document.addEventListener("visibilitychange", syncNow);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", syncNow);
      window.removeEventListener("focus", handleFocus);
    };
  }, [liveEndedAt, isPaused]);

  useEffect(() => {
    if (isPaused || !liveStartedAt || liveEndedAt) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, liveStartedAt, liveEndedAt]);

  const syncedNow = now + clockOffsetMs;
  const effectiveNow = liveEndedAt
    ? new Date(liveEndedAt).getTime()
    : isPaused && livePausedAt
    ? new Date(livePausedAt).getTime()
    : syncedNow;

  const totalElapsedSeconds = liveStartedAt
    ? Math.max(0, Math.floor((effectiveNow - new Date(liveStartedAt).getTime()) / 1000) - totalPauseSeconds)
    : 0;

  const segmentElapsedSeconds = effectiveSegmentStart
    ? Math.max(0, Math.floor((effectiveNow - new Date(effectiveSegmentStart).getTime()) / 1000) - segmentPauseSeconds)
    : 0;

  const segmentTargetSeconds = (estimatedDurationMinutes || 0) * 60;
  const segmentRemainingSeconds = segmentTargetSeconds - segmentElapsedSeconds;
  const isOvertime = !!effectiveSegmentStart && segmentRemainingSeconds < 0;
  const isCueAlertActive =
    !!liveStartedAt &&
    !liveEndedAt &&
    segmentRemainingSeconds <= 180 &&
    segmentRemainingSeconds > 0 &&
    !!nextSegmentTitle;

  const prevCueAlertRef = useRef<boolean>(false);
  useEffect(() => {
    if (isCueAlertActive && !prevCueAlertRef.current) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {
          // Ignore if vibration unsupported
        }
      }
    }
    prevCueAlertRef.current = isCueAlertActive;
  }, [isCueAlertActive]);

  return (
    <div className="space-y-3">
      {isCueAlertActive && (
        <div className="rounded-2xl bg-amber-400/20 border border-amber-200/60 px-3.5 py-2.5 text-amber-50 backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-200">
            <Volume2 className="w-4 h-4 shrink-0 animate-bounce" />
            <span>3-Minute CUE Alert!</span>
          </div>
          <p className="text-xs text-amber-50/95 mt-1 leading-relaxed">
            Segmen tersisa{" "}
            <strong className="font-mono">{formatSecondsToMMSS(segmentRemainingSeconds)}</strong> — Section{" "}
            <strong>{nextSegmentSection || "ACARA"}</strong> segera standby untuk{" "}
            <strong>&ldquo;{nextSegmentTitle}&rdquo;</strong>.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-indigo-100/85">
          <span>Actual Runtime</span>
          <span className="inline-flex items-center gap-1 font-mono text-indigo-100">
            <Clock className="w-3.5 h-3.5" />
            Total Event: {formatSecondsToHHMMSS(totalElapsedSeconds)}
          </span>
        </div>

        <div
          className={`mt-2 text-center font-mono font-black tracking-tight tabular-nums text-4xl sm:text-5xl ${
            isOvertime ? "text-rose-200" : "text-white"
          }`}
        >
          {formatSecondsToHHMMSS(segmentElapsedSeconds)}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          {isOvertime ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
              OVERTIME +{formatSecondsToMMSS(Math.abs(segmentRemainingSeconds))}
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                isCueAlertActive
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              Tersisa {formatSecondsToMMSS(Math.max(0, segmentRemainingSeconds))}
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono font-medium bg-white/15 text-indigo-50 border border-white/20">
            Target: {estimatedDurationMinutes || 0}m
          </span>
        </div>
      </div>
    </div>
  );
}

export const RuntimeTimer = memo(RuntimeTimerComponent);
