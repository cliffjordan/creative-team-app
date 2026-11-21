"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRealtimeStatus } from "@/providers/realtime-provider";
import {
  AppNotification,
  Event,
  EventRosterMember,
  LiveLog,
  LogSeverity,
  RundownItem,
  SectionType,
  User,
} from "@/types/domain";
import { INITIAL_USERS, isUserEventLeader } from "@/lib/mock-db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { RuntimeTimer } from "@/features/live-rundown/components/runtime-timer";
import {
  LeaderHeartbeatPayload,
  publishSyncMessage,
  subscribeSyncMessages,
} from "@/lib/sync/realtime-bus";
import { formatSecondsToMMSS } from "@/lib/utils";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  PlusCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  SkipForward,
  UserCheck,
  Presentation,
} from "lucide-react";

interface LiveStageViewProps {
  event: Event;
  items: RundownItem[];
  logs: LiveLog[];
  currentUser: User | null;
  roster?: EventRosterMember[];
  onUpdateEvent: (updated: Partial<Event>) => void;
  onUpdateItems: (items: RundownItem[]) => void;
  onAddLog: (log: Omit<LiveLog, "id" | "created_at">) => LiveLog | void;
  onDeleteLog?: (logId: string) => void;
}

function getSectionBadgeVariant(
  section: SectionType
): "purple" | "pink" | "orange" | "sky" | "neutral" {
  switch (section) {
    case "ACARA":
      return "purple";
    case "DEKORASI":
      return "pink";
    case "PERLENGKAPAN":
      return "orange";
    case "PDD":
      return "sky";
    default:
      return "neutral";
  }
}

export function LiveStageView({
  event,
  items,
  logs,
  currentUser,
  roster,
  onUpdateEvent,
  onUpdateItems,
  onAddLog,
  onDeleteLog,
}: LiveStageViewProps) {
  const { connectionStatus } = useRealtimeStatus();

  const [isPaused, setIsPaused] = useState<boolean>(!!event.live_paused_at);
  const segmentPauseSeconds = event.segment_pause_seconds || 0;
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [isTimeDesynced, setIsTimeDesynced] = useState<boolean>(false);

  // Sync local pause state if event changes
  useEffect(() => {
    setIsPaused(!!event.live_paused_at);
  }, [event.id, event.live_paused_at]);

  // Anti-double-tap & idempotency
  const [isCommandInFlight, setIsCommandInFlight] = useState<boolean>(false);
  const processedOpsRef = useRef<Set<string>>(new Set());

  const runIdempotentCommand = (fn: (operationId: string) => void) => {
    if (isCommandInFlight) return;
    const operationId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (processedOpsRef.current.has(operationId)) return;
    processedOpsRef.current.add(operationId);
    setIsCommandInFlight(true);
    try {
      fn(operationId);
    } finally {
      setTimeout(() => setIsCommandInFlight(false), 400);
    }
  };

  // Undo Next state (15s grace window)
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [lastUndoItem, setLastUndoItem] = useState<{ prevItemId: string; logId?: string } | null>(null);

  // Zero-tick 60s banner state for Change Queue broadcast
  const [visibleChangeQueueId, setVisibleChangeQueueId] = useState<string | null>(null);

  useEffect(() => {
    const latestCq = logs.find((l) => l.log_type === "CHANGEQUEUE");
    if (!latestCq) {
      setVisibleChangeQueueId(null);
      return;
    }
    const ageMs = Date.now() - new Date(latestCq.created_at).getTime();
    if (ageMs >= 60000) {
      setVisibleChangeQueueId(null);
      return;
    }
    setVisibleChangeQueueId(latestCq.id);
    const timeout = setTimeout(() => {
      setVisibleChangeQueueId((curr) => (curr === latestCq.id ? null : curr));
    }, 60000 - ageMs);
    return () => clearTimeout(timeout);
  }, [logs]);

  const recentChangeQueueLog = useMemo(
    () => (visibleChangeQueueId ? logs.find((l) => l.id === visibleChangeQueueId) || null : null),
    [logs, visibleChangeQueueId]
  );

  // Modals state
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState<boolean>(false);
  const [isChangeQueueModalOpen, setIsChangeQueueModalOpen] = useState<boolean>(false);
  const [isInsertSegmentModalOpen, setIsInsertSegmentModalOpen] = useState<boolean>(false);

  // Modal Form Inputs
  const [incidentText, setIncidentText] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<LogSeverity>("MEDIUM");

  const [queueReason, setQueueReason] = useState("");
  const [selectedPendingItemId, setSelectedPendingItemId] = useState("");

  const [insertTitle, setInsertTitle] = useState("");
  const [insertDuration, setInsertDuration] = useState(5);
  const [insertSection, setInsertSection] = useState<SectionType>("ACARA");
  const [insertNotes, setInsertNotes] = useState("");

  // Leader & permission check
  const isLeaderOrCo = isUserEventLeader(currentUser, event, roster || []);
  const activeLeaderMember = (roster || []).find(
    (r) => r.event_id === event.id && r.role_in_event === "EVENT_LEADER"
  );
  const activeLeaderId = activeLeaderMember?.user_id || event.event_leader_id;
  const activeLeaderName =
    INITIAL_USERS.find((u) => u.id === activeLeaderId)?.full_name || "Event Leader";

  const broadcastLeaderHeartbeat = () => {
    if (!isLeaderOrCo) return;
    const payload: LeaderHeartbeatPayload = {
      eventId: event.id,
      leaderId: currentUser?.id || activeLeaderId,
      leaderNowMs: Date.now(),
      event,
      items,
      logs,
    };
    publishSyncMessage("CT_LEADER_HEARTBEAT", payload);
  };

  // Master Clock Heartbeat (Event Leader) & Auto-Resync (Non-Leader)
  useEffect(() => {
    if (isLeaderOrCo && event.live_started_at && !event.live_ended_at) {
      const interval = setInterval(() => {
        broadcastLeaderHeartbeat();
      }, 2000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isLeaderOrCo, event, items, logs]);

  useEffect(() => {
    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_REQUEST_LEADER_SYNC" && isLeaderOrCo) {
        broadcastLeaderHeartbeat();
      } else if (msg.key === "CT_LEADER_HEARTBEAT" && !isLeaderOrCo) {
        const hb = msg.payload as LeaderHeartbeatPayload | undefined;
        if (!hb || hb.eventId !== event.id) return;

        const driftMs = Math.abs(Date.now() + clockOffsetMs - hb.leaderNowMs);
        const stateMismatch =
          hb.event.current_item_id !== event.current_item_id ||
          hb.event.live_paused_at !== event.live_paused_at ||
          hb.event.total_pause_seconds !== event.total_pause_seconds ||
          (hb.event.segment_pause_seconds || 0) !== (event.segment_pause_seconds || 0);

        if (driftMs > 1500 || stateMismatch) {
          setIsTimeDesynced(true);
          setClockOffsetMs(hb.leaderNowMs - Date.now());
          onUpdateEvent(hb.event);
          onUpdateItems(hb.items);
          setTimeout(() => setIsTimeDesynced(false), 2500);
        }
      }
    });
    return () => unsubscribe();
  }, [isLeaderOrCo, event, items, logs, clockOffsetMs]);

  const handleForceSyncToLeader = () => {
    publishSyncMessage("CT_REQUEST_LEADER_SYNC", { eventId: event.id });
    try {
      const savedEvent = localStorage.getItem("CT_EVENT");
      if (savedEvent) onUpdateEvent(JSON.parse(savedEvent) as Event);
      const savedItems = localStorage.getItem("CT_ITEMS");
      if (savedItems) onUpdateItems(JSON.parse(savedItems) as RundownItem[]);
    } catch {}
    setClockOffsetMs(0);
    setIsTimeDesynced(false);
  };

  // Memoized segment collections
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.order_index - b.order_index),
    [items]
  );
  const activeItemIndex = sortedItems.findIndex((it) => it.id === event.current_item_id);
  const activeItem = activeItemIndex !== -1 ? sortedItems[activeItemIndex] : sortedItems[0];
  const nextItem =
    activeItemIndex !== -1 && activeItemIndex + 1 < sortedItems.length
      ? sortedItems[activeItemIndex + 1]
      : null;
  const isLastItem = sortedItems.length > 0 && activeItem?.id === sortedItems[sortedItems.length - 1]?.id;

  const pastSegments = useMemo(
    () => sortedItems.filter((it) => it.status === "FINISHED" || it.status === "SKIPPED"),
    [sortedItems]
  );

  const upcomingSegments = useMemo(
    () =>
      sortedItems.filter(
        (it) => it.status === "PENDING" && it.id !== activeItem?.id
      ),
    [sortedItems, activeItem?.id]
  );

  // Map segment id -> latest time status log (OVERTIME / EARLYEND) for Past Segments badges
  const segmentLogByItemId = useMemo(() => {
    const map = new Map<string, LiveLog>();
    for (const log of logs) {
      if (
        log.rundown_item_id &&
        (log.log_type === "OVERTIME" || log.log_type === "EARLYEND") &&
        !map.has(log.rundown_item_id)
      ) {
        map.set(log.rundown_item_id, log);
      }
    }
    return map;
  }, [logs]);

  // 1. Action: START EVENT
  const handleStartEvent = () => {
    if (!isLeaderOrCo || sortedItems.length === 0) return;
    runIdempotentCommand(() => {
      const startIso = new Date().toISOString();
      const firstItem = sortedItems[0];

      const updatedItems = sortedItems.map((it, idx) =>
        idx === 0 ? { ...it, status: "ACTIVE" as const, actual_start_at: startIso } : it
      );

      onUpdateEvent({
        live_started_at: startIso,
        current_item_id: firstItem.id,
        current_item_started_at: startIso,
        segment_pause_seconds: 0,
        status: "EVENT_DAY",
      });
      onUpdateItems(updatedItems);
    });
  };

  // 2. Action: NEXT SEGMENT with Overtime/EarlyEnd Math (on-demand Date.now)
  const handleNextSegment = () => {
    if (!isLeaderOrCo || !activeItem) return;
    runIdempotentCommand((operationId) => {
      const endIso = new Date().toISOString();
      const activePauseDelta =
        isPaused && event.live_paused_at
          ? Math.max(0, Math.floor((Date.now() - new Date(event.live_paused_at).getTime()) / 1000))
          : 0;
      const segmentStartMs = activeItem.actual_start_at
        ? new Date(activeItem.actual_start_at).getTime()
        : Date.now();
      const actualSecs = activeItem.actual_start_at
        ? Math.max(0, Math.floor((Date.now() - segmentStartMs) / 1000) - (segmentPauseSeconds + activePauseDelta))
        : 0;
      const targetSecs = (activeItem.estimated_duration_minutes || 0) * 60;
      const deltaSecs = actualSecs - targetSecs;
      const tolerance = event.time_tolerance_seconds || 60;

      let createdLogId: string | undefined;
      if (deltaSecs > tolerance) {
        const created = onAddLog({
          event_id: event.id,
          rundown_item_id: activeItem.id,
          log_type: "OVERTIME",
          delta_seconds: deltaSecs,
          reported_by: currentUser?.id || event.event_leader_id,
          description: `Segmen '${activeItem.title}' OVERTIME +${Math.round(deltaSecs / 60)} menit (${formatSecondsToMMSS(deltaSecs)}).`,
          severity: deltaSecs > 300 ? "HIGH" : "MEDIUM",
          status: "OPEN",
          operation_id: operationId,
        });
        if (created) createdLogId = created.id;
      } else if (deltaSecs < -tolerance) {
        const created = onAddLog({
          event_id: event.id,
          rundown_item_id: activeItem.id,
          log_type: "EARLYEND",
          delta_seconds: deltaSecs,
          reported_by: currentUser?.id || event.event_leader_id,
          description: `Segmen '${activeItem.title}' SELESAI LEBIH AWAL ${Math.round(Math.abs(deltaSecs) / 60)} menit (${formatSecondsToMMSS(deltaSecs)}).`,
          severity: "LOW",
          status: "OPEN",
          operation_id: operationId,
        });
        if (created) createdLogId = created.id;
      }

      const updatedItems = sortedItems.map((it) => {
        if (it.id === activeItem.id) {
          return { ...it, status: "FINISHED" as const, actual_end_at: endIso };
        }
        if (nextItem && it.id === nextItem.id) {
          return { ...it, status: "ACTIVE" as const, actual_start_at: endIso };
        }
        return it;
      });

      if (nextItem) {
        if (isPaused) setIsPaused(false);
        onUpdateEvent({
          current_item_id: nextItem.id,
          current_item_started_at: endIso,
          segment_pause_seconds: 0,
          ...(isPaused
            ? {
                live_paused_at: null,
                total_pause_seconds: (event.total_pause_seconds || 0) + activePauseDelta,
              }
            : {}),
        });
        onUpdateItems(updatedItems);

        setCanUndo(true);
        setLastUndoItem({ prevItemId: activeItem.id, logId: createdLogId });
        setTimeout(() => setCanUndo(false), 15000);
      }
    });
  };

  // 2b. Action: SKIP SEGMENT
  const handleSkipSegment = () => {
    if (!isLeaderOrCo || !activeItem || !nextItem) return;
    runIdempotentCommand((operationId) => {
      const switchIso = new Date().toISOString();
      const updatedItems = sortedItems.map((it) => {
        if (it.id === activeItem.id) {
          return { ...it, status: "SKIPPED" as const, actual_start_at: null, actual_end_at: null };
        }
        if (it.id === nextItem.id) {
          return { ...it, status: "ACTIVE" as const, actual_start_at: switchIso };
        }
        return it;
      });

      onUpdateEvent({
        current_item_id: nextItem.id,
        current_item_started_at: switchIso,
        segment_pause_seconds: 0,
      });
      onUpdateItems(updatedItems);
      onAddLog({
        event_id: event.id,
        rundown_item_id: activeItem.id,
        log_type: "INCIDENT",
        reported_by: currentUser?.id || event.event_leader_id,
        description: `Segmen '${activeItem.title}' dilewati (SKIPPED).`,
        severity: "LOW",
        status: "RESOLVED",
        operation_id: operationId,
      });
    });
  };

  // 3. Action: UNDO NEXT SEGMENT
  const handleUndoNext = () => {
    if (!canUndo || !lastUndoItem || !isLeaderOrCo) return;

    if (lastUndoItem.logId && onDeleteLog) {
      onDeleteLog(lastUndoItem.logId);
    }

    const updatedItems = sortedItems.map((it) => {
      if (it.id === lastUndoItem.prevItemId) {
        return { ...it, status: "ACTIVE" as const, actual_end_at: null };
      }
      if (activeItem && it.id === activeItem.id) {
        return { ...it, status: "PENDING" as const, actual_start_at: null };
      }
      return it;
    });

    onUpdateEvent({
      current_item_id: lastUndoItem.prevItemId,
    });
    onUpdateItems(updatedItems);
    setCanUndo(false);
    setLastUndoItem(null);
  };

  // 4. Action: PAUSE / RESUME TIMER
  const handleTogglePause = () => {
    if (!isLeaderOrCo) return;
    if (!isPaused) {
      const pauseIso = new Date().toISOString();
      setIsPaused(true);
      onUpdateEvent({ live_paused_at: pauseIso });
      onAddLog({
        event_id: event.id,
        log_type: "PAUSE",
        reported_by: currentUser?.id || event.event_leader_id,
        description: `Timer dihentikan sementara (HOLD/PAUSE) oleh Event Controller.`,
        severity: "LOW",
        status: "RESOLVED",
      });
    } else {
      const pauseStartMs = event.live_paused_at
        ? new Date(event.live_paused_at).getTime()
        : Date.now();
      const pausedDeltaSecs = Math.max(0, Math.floor((Date.now() - pauseStartMs) / 1000));

      setIsPaused(false);
      onUpdateEvent({
        live_paused_at: null,
        total_pause_seconds: (event.total_pause_seconds || 0) + pausedDeltaSecs,
        segment_pause_seconds: (event.segment_pause_seconds || 0) + pausedDeltaSecs,
      });
      onAddLog({
        event_id: event.id,
        log_type: "RESUME",
        reported_by: currentUser?.id || event.event_leader_id,
        description: `Timer dilanjutkan kembali setelah jeda ${pausedDeltaSecs} detik.`,
        severity: "LOW",
        status: "RESOLVED",
      });
    }
  };

  // 5. Action: CHANGE QUEUE LIVE
  const handleSaveChangeQueue = () => {
    if (!selectedPendingItemId || !queueReason.trim()) return;

    const itemToMove = sortedItems.find((it) => it.id === selectedPendingItemId);
    if (!itemToMove) return;

    runIdempotentCommand((operationId) => {
      const previousQueue = sortedItems
        .filter((it) => it.status === "PENDING")
        .map((it) => ({ id: it.id, order_index: it.order_index, title: it.title }));

      const otherPending = sortedItems.filter(
        (it) => it.id !== itemToMove.id && it.status === "PENDING"
      );

      const newOrder = activeItem ? activeItem.order_index + 1 : 1;
      const reorderedPending = [itemToMove, ...otherPending].map((it, idx) => ({
        ...it,
        order_index: newOrder + idx,
      }));

      const newQueue = reorderedPending.map((it) => ({
        id: it.id,
        order_index: it.order_index,
        title: it.title,
      }));

      const finishedAndActive = sortedItems.filter((it) => it.status !== "PENDING");
      const merged = [...finishedAndActive, ...reorderedPending].sort(
        (a, b) => a.order_index - b.order_index
      );

      onUpdateItems(merged);
      onAddLog({
        event_id: event.id,
        rundown_item_id: itemToMove.id,
        log_type: "CHANGEQUEUE",
        reported_by: currentUser?.id || event.event_leader_id,
        description: `Perubahan Urutan: '${itemToMove.title}' dimajukan menjadi giliran berikutnya. Alasan: ${queueReason}`,
        severity: "MEDIUM",
        status: "OPEN",
        operation_id: operationId,
        previous_queue: previousQueue,
        new_queue: newQueue,
      });

      try {
        const raw = localStorage.getItem("CT_NOTIFICATIONS");
        const existing: AppNotification[] = raw ? (JSON.parse(raw) as AppNotification[]) : [];
        const notif: AppNotification = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`,
          user_id: currentUser?.id || event.event_leader_id,
          event_id: event.id,
          type: "QUEUE_CHANGED",
          title: "Perubahan Urutan Rundown",
          body: `'${itemToMove.title}' dimajukan menjadi giliran berikutnya. Alasan: ${queueReason}`,
          read_at: null,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem("CT_NOTIFICATIONS", JSON.stringify([notif, ...existing]));
      } catch {
        // Ignore localStorage errors
      }

      setIsChangeQueueModalOpen(false);
      setQueueReason("");
      setSelectedPendingItemId("");
    });
  };

  // 6. Action: INSERT SEGMEN DADAKAN
  const handleSaveInsertSegment = () => {
    if (!insertTitle.trim()) return;

    const nextOrder = activeItem ? activeItem.order_index + 1 : 1;
    const newItem: RundownItem = {
      id: `rnd-custom-${Date.now()}`,
      rundown_id: activeItem?.rundown_id || "rnd-custom",
      order_index: nextOrder,
      title: insertTitle,
      section_pic: insertSection,
      estimated_duration_minutes: insertDuration,
      status: "PENDING",
      technical_notes: insertNotes || "Segmen sisipan darurat",
    };

    const updated = sortedItems.map((it) => {
      if (it.order_index >= nextOrder && it.status === "PENDING") {
        return { ...it, order_index: it.order_index + 1 };
      }
      return it;
    });

    const finalItems = [...updated, newItem].sort((a, b) => a.order_index - b.order_index);
    onUpdateItems(finalItems);

    onAddLog({
      event_id: event.id,
      rundown_item_id: newItem.id,
      log_type: "CHANGEQUEUE",
      reported_by: currentUser?.id || event.event_leader_id,
      description: `Segmen Dadakan Disisipkan: '${insertTitle}' (${insertDuration} menit, Section: ${insertSection}).`,
      severity: "MEDIUM",
      status: "OPEN",
    });

    setIsInsertSegmentModalOpen(false);
    setInsertTitle("");
    setInsertNotes("");
  };

  // 7. Action: SUBMIT INCIDENT
  const handleSaveIncident = () => {
    if (!incidentText.trim()) return;

    onAddLog({
      event_id: event.id,
      rundown_item_id: activeItem?.id,
      log_type: "INCIDENT",
      reported_by: currentUser?.id || "u-anon",
      description: incidentText,
      severity: incidentSeverity,
      status: "OPEN",
    });

    setIsIncidentModalOpen(false);
    setIncidentText("");
    setIncidentSeverity("MEDIUM");
  };

  // 8. Action: EVENT END
  const handleEndEvent = () => {
    if (!isLeaderOrCo) return;
    runIdempotentCommand(() => {
      const endIso = new Date().toISOString();
      const activePauseDelta =
        isPaused && event.live_paused_at
          ? Math.max(0, Math.floor((Date.now() - new Date(event.live_paused_at).getTime()) / 1000))
          : 0;

      const updatedItems = sortedItems.map((it) =>
        it.id === activeItem?.id ? { ...it, status: "FINISHED" as const, actual_end_at: endIso } : it
      );

      if (isPaused) setIsPaused(false);
      onUpdateEvent({
        live_ended_at: endIso,
        status: "POST_EVENT",
        segment_pause_seconds: (event.segment_pause_seconds || 0) + (isPaused ? activePauseDelta : 0),
        ...(isPaused
          ? {
              live_paused_at: null,
              total_pause_seconds: (event.total_pause_seconds || 0) + activePauseDelta,
            }
          : {}),
      });
      onUpdateItems(updatedItems);
    });
  };

  const isEventNotStarted = !event.live_started_at;
  const isEventEnded = !!event.live_ended_at;

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={isEventEnded ? "cyan" : isPaused ? "amber" : isEventNotStarted ? "purple" : "emerald"}
            pulse={!isEventEnded && !isPaused && !isEventNotStarted}
          >
            {isEventEnded
              ? "ENDED"
              : isPaused
              ? "PAUSED"
              : isEventNotStarted
              ? "STANDBY"
              : "LIVE"}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            Leader: <strong className="text-slate-900">{activeLeaderName}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isLeaderOrCo && (
            <button
              type="button"
              onClick={handleForceSyncToLeader}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[11px] font-bold text-amber-800 transition"
              title="Sinkronkan waktu dan segmen ke Event Leader"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync Waktu Leader</span>
            </button>
          )}
          <Link
            href="/cue-cards"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-indigo-700 transition"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Cue Card MC</span>
          </Link>
          <Badge
            variant={
              connectionStatus === "CONNECTED"
                ? "emerald"
                : connectionStatus === "CONNECTING"
                ? "amber"
                : connectionStatus === "DISCONNECTED"
                ? "crimson"
                : "cyan"
            }
            className="text-[10px] font-mono"
          >
            {connectionStatus}
          </Badge>
        </div>
      </div>

      {/* Desync Warning Banner */}
      {isTimeDesynced && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Waktu Tidak Sinkron dengan Event Leader — Menyelaraskan otomatis...</span>
          </div>
          <Button size="sm" variant="amber" onClick={handleForceSyncToLeader} className="text-xs">
            Sinkronkan ke Waktu Event Leader Sekarang
          </Button>
        </div>
      )}

      {/* Change Queue Live Push Banner */}
      {recentChangeQueueLog && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-extrabold uppercase tracking-wider">
            <ArrowUpDown className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Change Queue Live Push</span>
          </div>
          <p className="text-xs text-amber-900 mt-1">{recentChangeQueueLog.description}</p>
        </div>
      )}

      {/* PAUSE Alert Banner */}
      {isPaused && (
        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sky-800 text-xs font-bold">
            <Pause className="w-4 h-4 text-sky-600 shrink-0" />
            <span>TIMER SEDANG DIJEDA (PAUSE / HOLD)</span>
          </div>
          {isLeaderOrCo && (
            <Button size="sm" variant="primary" onClick={handleTogglePause}>
              Lanjutkan
            </Button>
          )}
        </div>
      )}

      {/* Main 2-column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Segment Gradient Card + Quick Controls + Activity Feed */}
        <div className="lg:col-span-7 space-y-5">
          {/* Prism-Aligned Gradient CURRENT SEGMENT Hero Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-500 text-white p-5 sm:p-6 shadow-xl shadow-indigo-600/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-white/15 border border-white/25 text-white">
                  Current Segment
                </span>
                {activeItem && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/95 text-indigo-700">
                    {activeItem.section_pic}
                  </span>
                )}
              </div>
              {activeItem && (
                <span className="text-xs font-mono text-indigo-100">
                  Segmen {activeItem.order_index} / {sortedItems.length}
                </span>
              )}
            </div>

            {activeItem ? (
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-extrabold leading-snug">
                  {activeItem.title}
                </h2>
                {activeItem.technical_notes && (
                  <p className="text-xs text-indigo-100/95 bg-white/10 border border-white/15 rounded-xl px-3 py-2 italic">
                    &ldquo;{activeItem.technical_notes}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-indigo-100">Belum ada segmen rundown.</p>
            )}

            {/* Isolated 1-second Runtime Timer */}
            <RuntimeTimer
              liveStartedAt={event.live_started_at}
              liveEndedAt={event.live_ended_at}
              livePausedAt={event.live_paused_at}
              isPaused={isPaused}
              totalPauseSeconds={event.total_pause_seconds || 0}
              clockOffsetMs={clockOffsetMs}
              segmentStartAt={activeItem?.actual_start_at}
              currentItemStartedAt={event.current_item_started_at}
              segmentPauseSeconds={segmentPauseSeconds}
              estimatedDurationMinutes={activeItem?.estimated_duration_minutes || 0}
              nextSegmentTitle={nextItem?.title}
              nextSegmentSection={nextItem?.section_pic}
            />

            {/* Primary Controller CTA inside Hero Card */}
            {isEventNotStarted ? (
              isLeaderOrCo ? (
                <button
                  type="button"
                  onClick={handleStartEvent}
                  disabled={sortedItems.length === 0}
                  className="w-full py-3.5 px-5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-current text-emerald-600" />
                  <span>START EVENT (OPEN GATE)</span>
                </button>
              ) : (
                <div className="p-3 text-center text-xs text-indigo-100 bg-white/10 rounded-2xl border border-white/15">
                  Menunggu Event Leader menekan tombol <strong>START EVENT</strong>...
                </div>
              )
            ) : isEventEnded ? (
              <div className="p-4 text-center bg-white/15 border border-white/25 rounded-2xl">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 mx-auto mb-1" />
                <h3 className="font-bold text-white text-sm">Event Telah Selesai</h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Seluruh rekaman waktu tersimpan. Buka tab <strong>Evaluasi</strong> untuk meninjau log.
                </p>
              </div>
            ) : (
              isLeaderOrCo && (
                <div className="space-y-2.5">
                  {isLastItem ? (
                    <button
                      type="button"
                      disabled={isCommandInFlight}
                      onClick={handleEndEvent}
                      className="w-full py-3.5 px-5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] transition"
                    >
                      <span>EVENT END (SELESAI)</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isCommandInFlight}
                        onClick={handleNextSegment}
                        className="flex-1 py-3.5 px-5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-50"
                      >
                        <SkipForward className="w-5 h-5 fill-current text-indigo-600" />
                        <span>NEXT SEGMENT</span>
                      </button>
                      <button
                        type="button"
                        disabled={isLastItem || isCommandInFlight}
                        onClick={handleSkipSegment}
                        className="px-4 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-xs transition disabled:opacity-40"
                      >
                        Skip
                      </button>
                    </div>
                  )}

                  {canUndo && (
                    <Button
                      size="md"
                      variant="amber"
                      onClick={handleUndoNext}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-bold"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>BATALKAN NEXT (Kembali ke Segmen Sebelumnya - 15s)</span>
                    </Button>
                  )}
                </div>
              )
            )}
          </div>

          {/* Quick Actions Dock */}
          {!isEventEnded && !isEventNotStarted && isLeaderOrCo && (
            <div className="grid grid-cols-3 gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsChangeQueueModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                <span>Tukar Urutan</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInsertSegmentModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              >
                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Segmen</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleTogglePause}
                className={`flex items-center gap-1.5 text-xs font-semibold ${
                  isPaused
                    ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    : "text-slate-700"
                }`}
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{isPaused ? "Resume" : "Jeda Timer"}</span>
              </Button>
            </div>
          )}

          {/* Live Activity Feed */}
          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-600" />
                <span>Live Activity Feed</span>
              </h3>
              <span className="text-[11px] font-medium text-slate-500">
                {logs.length} kejadian tercatat
              </span>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  Belum ada log kejadian atau kendala.
                </div>
              ) : (
                logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2.5 text-xs"
                  >
                    <div className="mt-0.5 shrink-0">
                      {log.log_type === "OVERTIME" && <Badge variant="crimson">OVERTIME</Badge>}
                      {log.log_type === "EARLYEND" && <Badge variant="emerald">EARLY END</Badge>}
                      {log.log_type === "CHANGEQUEUE" && <Badge variant="amber">CHANGE QUEUE</Badge>}
                      {log.log_type === "INCIDENT" && <Badge variant="orange">INCIDENT</Badge>}
                      {log.log_type === "PAUSE" && <Badge variant="cyan">HOLD</Badge>}
                      {log.log_type === "RESUME" && <Badge variant="emerald">GO</Badge>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-medium leading-relaxed">{log.description}</p>
                      <span className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Upcoming Segments & Past Segments */}
        <div className="lg:col-span-5 space-y-5">
          {/* UPCOMING SEGMENTS */}
          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Upcoming Segments ({upcomingSegments.length})
              </h3>
            </div>

            {upcomingSegments.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                {isEventEnded ? "Semua segmen telah selesai." : "Tidak ada segmen berikutnya."}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {upcomingSegments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className={`p-3 rounded-2xl border transition ${
                      idx === 0
                        ? "bg-indigo-50/70 border-indigo-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold text-indigo-600">
                        {idx === 0 ? "NEXT UP · " : `#${seg.order_index} · `}
                        {seg.planned_start_time || "--:--"} · {seg.estimated_duration_minutes}m
                      </span>
                      <Badge variant={getSectionBadgeVariant(seg.section_pic)} className="text-[10px]">
                        {seg.section_pic}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{seg.title}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* PAST SEGMENTS */}
          <Card className="p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Past Segments ({pastSegments.length})
            </h3>

            {pastSegments.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                Belum ada segmen yang selesai dijalankan.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {pastSegments.map((seg) => {
                  const statusLog = segmentLogByItemId.get(seg.id);
                  return (
                    <div
                      key={seg.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-slate-500">
                            #{seg.order_index} · {seg.estimated_duration_minutes}m
                          </span>
                          <Badge variant={getSectionBadgeVariant(seg.section_pic)} className="text-[10px]">
                            {seg.section_pic}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1 truncate">
                          {seg.title}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {seg.status === "SKIPPED" ? (
                          <Badge variant="neutral" className="text-[10px]">SKIPPED</Badge>
                        ) : statusLog?.log_type === "OVERTIME" ? (
                          <Badge variant="crimson" className="text-[10px]">OVERTIME</Badge>
                        ) : statusLog?.log_type === "EARLYEND" ? (
                          <Badge variant="emerald" className="text-[10px]">EARLY END</Badge>
                        ) : (
                          <Badge variant="emerald" className="text-[10px]">ON TIME</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Floating Orange ADD INCIDENT FAB */}
      <button
        type="button"
        onClick={() => setIsIncidentModalOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-orange-500/30 active:scale-95 transition"
      >
        <AlertOctagon className="w-4 h-4" />
        <span>+ ADD INCIDENT</span>
      </button>

      {/* MODAL 1: LAPOR INSIDEN */}
      <Modal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        title="Lapor Kendala / Insiden Lapangan"
        description="Laporan ini akan langsung tersinkron ke layar seluruh kru dan masuk agenda evaluasi."
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Tingkat Urgensi</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as LogSeverity[]).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setIncidentSeverity(sev)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    incidentSeverity === sev
                      ? sev === "CRITICAL"
                        ? "bg-rose-600 border-rose-600 text-white"
                        : sev === "HIGH"
                        ? "bg-orange-500 border-orange-500 text-white"
                        : sev === "MEDIUM"
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-slate-700 border-slate-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Keterangan Kendala</label>
            <textarea
              rows={3}
              value={incidentText}
              onChange={(e) => setIncidentText(e.target.value)}
              placeholder="Contoh: Mic singer kresek-kresek di baris kanan, lilin induk padam tertiup AC..."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
            />
          </div>

          <Button size="lg" variant="crimson" onClick={handleSaveIncident} className="w-full font-bold">
            Kirim Laporan Insiden
          </Button>
        </div>
      </Modal>

      {/* MODAL 2: TUKAR URUTAN LIVE (Change Queue) */}
      <Modal
        isOpen={isChangeQueueModalOpen}
        onClose={() => setIsChangeQueueModalOpen(false)}
        title="Ubah Urutan Acara Live (Change Queue)"
        description="Pilih segmen yang akan dimajukan menjadi giliran berikutnya setelah segmen aktif."
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Pilih Segmen yang Dimajukan
            </label>
            <select
              value={selectedPendingItemId}
              onChange={(e) => setSelectedPendingItemId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            >
              <option value="">-- Pilih Segmen Pending --</option>
              {sortedItems
                .filter((it) => it.status === "PENDING")
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    #{it.order_index} {it.title} ({it.section_pic}) - {it.estimated_duration_minutes}m
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Alasan Perubahan Urutan (Wajib)
            </label>
            <input
              type="text"
              value={queueReason}
              onChange={(e) => setQueueReason(e.target.value)}
              placeholder="Contoh: Penampil kelas B belum siap kostum, kelas C maju duluan"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <Button
            size="lg"
            variant="amber"
            onClick={handleSaveChangeQueue}
            disabled={!selectedPendingItemId || !queueReason.trim()}
            className="w-full font-bold"
          >
            Terapkan Perubahan Urutan &amp; Broadcast
          </Button>
        </div>
      </Modal>

      {/* MODAL 3: INSERT SEGMEN DADAKAN */}
      <Modal
        isOpen={isInsertSegmentModalOpen}
        onClose={() => setIsInsertSegmentModalOpen(false)}
        title="Sisipkan Segmen Dadakan"
        description="Segmen ini akan disisipkan langsung setelah segmen yang sedang aktif."
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Nama Acara / Segmen</label>
            <input
              type="text"
              value={insertTitle}
              onChange={(e) => setInsertTitle(e.target.value)}
              placeholder="Contoh: Sambutan Tambahan Gembala Sidang"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Durasi (Menit)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={insertDuration}
                onChange={(e) => setInsertDuration(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Section PIC</label>
              <select
                value={insertSection}
                onChange={(e) => setInsertSection(e.target.value as SectionType)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="ACARA">ACARA</option>
                <option value="PDD">PDD</option>
                <option value="PERLENGKAPAN">PERLENGKAPAN</option>
                <option value="DEKORASI">DEKORASI</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Teknis (Opsional)</label>
            <input
              type="text"
              value={insertNotes}
              onChange={(e) => setInsertNotes(e.target.value)}
              placeholder="Contoh: Mic wireless 1 standby di mimbar"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <Button
            size="lg"
            variant="primary"
            onClick={handleSaveInsertSegment}
            disabled={!insertTitle.trim()}
            className="w-full font-bold"
          >
            Sisipkan ke Rundown Sekarang
          </Button>
        </div>
      </Modal>
    </div>
  );
}
