import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

type SectionKind = "tools" | "decor" | "shotlist" | "references" | "guides";

const TABLE_MAP: Record<SectionKind, string> = {
  tools: "section_tools_inventory",
  decor: "section_decor_items",
  shotlist: "section_pdd_shotlist",
  references: "pdd_references",
  guides: "event_technical_guides",
};

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: true, tools: [], decor: [], shotlist: [], references: [], guides: [] },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const [toolsRes, decorRes, shotRes, refRes, guideRes] = await Promise.all([
      supabase.from("section_tools_inventory").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("section_decor_items").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("section_pdd_shotlist").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("pdd_references").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("event_technical_guides").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    ]);

    return NextResponse.json(
      {
        success: true,
        tools: toolsRes.data ?? [],
        decor: decorRes.data ?? [],
        shotlist: shotRes.data ?? [],
        references: refRes.data ?? [],
        guides: guideRes.data ?? [],
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memuat data section",
        tools: [],
        decor: [],
        shotlist: [],
        references: [],
        guides: [],
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const kind = body?.kind as SectionKind;
    const table = TABLE_MAP[kind];
    if (!table) {
      return NextResponse.json({ success: false, error: "Tipe section tidak valid" }, { status: 400 });
    }

    const { kind: _k, id: _rawId, ...rest } = body as Record<string, unknown>;
    void _k;
    void _rawId;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: true, item: { id: `sec-${Date.now()}`, event_id: context.params.id, ...rest } },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(table)
      .insert({ ...rest, event_id: context.params.id })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal menambah item section" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const kind = body?.kind as SectionKind;
    const itemId = body?.id as string;
    const table = TABLE_MAP[kind];
    if (!table || !itemId) {
      return NextResponse.json({ success: false, error: "Parameter kind/id tidak valid" }, { status: 400 });
    }

    const { kind: _k, id: _id, ...updates } = body as Record<string, unknown>;
    void _k;
    void _id;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, item: { id: itemId, ...updates } });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", itemId)
      .eq("event_id", context.params.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan." }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as SectionKind;
  const itemId = url.searchParams.get("itemId");
  const table = TABLE_MAP[kind];
  if (!table || !itemId) {
    return NextResponse.json({ success: false, error: "Parameter kind/itemId tidak valid" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", itemId)
    .eq("event_id", context.params.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
