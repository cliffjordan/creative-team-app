"use client";

import { supabase } from "@/lib/supabase/client";
import type { Event, LiveLog, RundownItem } from "@/types/domain";

export type SyncStorageKey =
  | "CT_EVENT"
  | "CT_EVENTS"
  | "CT_ITEMS"
  | "CT_LOGS"
  | "CT_TASKS"
  | "CT_ROSTER"
  | "CT_SECTION_GUIDES"
  | "CT_SECTION_BUDGETS"
  | "CT_MEETING_NOTES"
  | "CT_NOTIFICATIONS"
  | "CT_LEADER_HEARTBEAT"
  | "CT_REQUEST_LEADER_SYNC";

export interface LeaderHeartbeatPayload {
  eventId: string;
  leaderId: string;
  leaderNowMs: number;
  event: Event;
  items: RundownItem[];
  logs: LiveLog[];
}

export interface SyncMessage<T = unknown> {
  key: SyncStorageKey;
  payload: T;
  senderId: string;
  timestamp: number;
}

const CHANNEL_NAME = "ct_realtime_bus_v1";
const SENDER_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 10)}`;

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return broadcastChannel;
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("demo.supabase.co"));
}

export function publishSyncMessage<T>(key: SyncStorageKey, payload: T): void {
  if (typeof window === "undefined") return;

  const message: SyncMessage<T> = {
    key,
    payload,
    senderId: SENDER_ID,
    timestamp: Date.now(),
  };

  try {
    const ch = getBroadcastChannel();
    ch?.postMessage(message);
  } catch {
    // Ignore BroadcastChannel errors
  }

  if (isSupabaseConfigured()) {
    try {
      const sbChannel = supabase.channel("ct-live-sync");
      sbChannel.send({
        type: "broadcast",
        event: "state_sync",
        payload: message,
      });
    } catch {
      // Ignore Supabase broadcast errors
    }
  }
}

export function subscribeSyncMessages(
  onMessage: (message: SyncMessage) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChannelMessage = (event: MessageEvent<SyncMessage>) => {
    const data = event.data;
    if (!data || data.senderId === SENDER_ID) return;
    onMessage(data);
  };

  const ch = getBroadcastChannel();
  ch?.addEventListener("message", handleChannelMessage);

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || !event.newValue) return;
    const validKeys: SyncStorageKey[] = [
      "CT_EVENT",
      "CT_EVENTS",
      "CT_ITEMS",
      "CT_LOGS",
      "CT_TASKS",
      "CT_ROSTER",
      "CT_SECTION_GUIDES",
      "CT_MEETING_NOTES",
      "CT_NOTIFICATIONS",
    ];
    if (!validKeys.includes(event.key as SyncStorageKey)) return;
    try {
      const parsed = JSON.parse(event.newValue);
      onMessage({
        key: event.key as SyncStorageKey,
        payload: parsed,
        senderId: "storage-event",
        timestamp: Date.now(),
      });
    } catch {
      // Ignore malformed storage payload
    }
  };
  window.addEventListener("storage", handleStorage);

  let sbChannel: ReturnType<typeof supabase.channel> | null = null;
  if (isSupabaseConfigured()) {
    try {
      sbChannel = supabase
        .channel("ct-live-sync")
        .on("broadcast", { event: "state_sync" }, (msg) => {
          const data = msg.payload as SyncMessage | undefined;
          if (!data || data.senderId === SENDER_ID) return;
          onMessage(data);
        })
        .subscribe();
    } catch {
      // Ignore Supabase subscribe errors
    }
  }

  return () => {
    ch?.removeEventListener("message", handleChannelMessage);
    window.removeEventListener("storage", handleStorage);
    if (sbChannel) {
      supabase.removeChannel(sbChannel);
    }
  };
}
