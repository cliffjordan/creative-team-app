import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function isAuthorizedRequest(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const cronHeader = request.headers.get("x-cron-secret") ?? "";

  if (authHeader === `Bearer ${configuredSecret}`) {
    return true;
  }
  if (cronHeader === configuredSecret) {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  noStore();

  if (!isAuthorizedRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: true,
        service: "creative-team-supabase-keep-alive",
        dbReachable: false,
        note: "Supabase credentials not configured",
        latencyMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      console.error("[keep-alive] Supabase ping failed:", error.message);
      return NextResponse.json(
        {
          ok: false,
          service: "creative-team-supabase-keep-alive",
          dbReachable: false,
          error: "Database ping failed",
          latencyMs: Date.now() - startedAt,
          timestamp,
        },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        service: "creative-team-supabase-keep-alive",
        dbReachable: true,
        latencyMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error("[keep-alive] Exception:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        ok: false,
        service: "creative-team-supabase-keep-alive",
        dbReachable: false,
        error: "Database ping failed",
        latencyMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
