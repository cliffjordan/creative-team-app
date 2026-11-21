"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "DEMO";

interface RealtimeContextValue {
  connectionStatus: ConnectionStatus;
  lastSyncedAt: string | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connectionStatus: "DEMO",
  lastSyncedAt: null,
});

export function RealtimeProvider({
  eventId,
  children,
}: {
  eventId?: string;
  children: React.ReactNode;
}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DEMO");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url.includes("demo.supabase.co")) {
      setConnectionStatus("DEMO");
      return;
    }

    setConnectionStatus("CONNECTING");
    const channelName = eventId ? `event-live-${eventId}` : "creative-team-global";
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => setLastSyncedAt(new Date().toISOString())
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rundown_items" },
        () => setLastSyncedAt(new Date().toISOString())
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_logs" },
        () => setLastSyncedAt(new Date().toISOString())
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("CONNECTED");
          setLastSyncedAt(new Date().toISOString());
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("DISCONNECTED");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <RealtimeContext.Provider value={{ connectionStatus, lastSyncedAt }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}
