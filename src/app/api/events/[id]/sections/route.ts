import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  requireEventAccess,
  requireSectionWriteAccess,
  type SectionResourceKind,
} from "@/lib/auth/guards";
import {
  SafeHttpUrlSchema,
  SectionTypeSchema,
  TaskPhaseSchema,
} from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const TABLE_MAP: Record<SectionResourceKind, string> = {
  tools: "section_tools_inventory",
  decor: "section_decor_items",
  shotlist: "section_pdd_shotlist",
  references: "pdd_references",
  guides: "event_technical_guides",
};

const ToolCreateSchema = z.object({
  tool_name: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(100000).default(1),
  source: z.enum(["IN_HOUSE", "RENTAL", "PURCHASE"]).default("IN_HOUSE"),
  pic_user_id: z.string().uuid().nullable().optional(),
  is_ready: z.boolean().default(false),
  notes: z.string().max(1000).nullable().optional(),
});

const ToolPatchSchema = ToolCreateSchema.partial();

const DecorCreateSchema = z.object({
  item_name: z.string().trim().min(1).max(300),
  estimated_cost: z.number().finite().min(0).max(100000000000).default(0),
  actual_cost: z.number().finite().min(0).max(100000000000).default(0),
  installation_status: z
    .enum(["PLANNING", "IN_PROGRESS", "READY", "INSTALLED"])
    .default("PLANNING"),
  pic_user_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const DecorPatchSchema = DecorCreateSchema.partial();

const ShotlistCreateSchema = z.object({
  scene_title: z.string().trim().min(1).max(300),
  shot_type: z.enum(["PHOTO", "VIDEO", "REEL"]).default("PHOTO"),
  camera_angle: z.string().max(500).nullable().optional(),
  pic_user_id: z.string().uuid().nullable().optional(),
  status: z.enum(["PENDING", "TAKEN", "EDITED"]).default("PENDING"),
  drive_link: SafeHttpUrlSchema,
});

const ShotlistPatchSchema = ShotlistCreateSchema.partial();

const ReferenceBaseSchema = z.object({
  phase: TaskPhaseSchema.default("PRE_EVENT"),
  title: z.string().trim().min(1).max(300),
  url: SafeHttpUrlSchema,
  drive_url: SafeHttpUrlSchema,
  description: z.string().max(1000).nullable().optional(),
});

const ReferenceCreateSchema = ReferenceBaseSchema.refine(
  (v) => Boolean((v.url && v.url.trim()) || (v.drive_url && v.drive_url.trim())),
  "URL referensi wajib diisi"
);

const ReferencePatchSchema = ReferenceBaseSchema.partial();

const GuideCreateSchema = z.object({
  category: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  instructions_markdown: z.string().trim().min(1).max(5000),
  layout_image_url: SafeHttpUrlSchema,
  target_sections: z.array(SectionTypeSchema).min(1).default(["ACARA", "ALL"]),
});

const GuidePatchSchema = GuideCreateSchema.partial();

function validateSectionPayload(
  kind: SectionResourceKind,
  body: Record<string, unknown>,
  isPatch: boolean
) {
  if (kind === "tools") {
    return (isPatch ? ToolPatchSchema : ToolCreateSchema).safeParse(body);
  }
  if (kind === "decor") {
    return (isPatch ? DecorPatchSchema : DecorCreateSchema).safeParse(body);
  }
  if (kind === "shotlist") {
    return (isPatch ? ShotlistPatchSchema : ShotlistCreateSchema).safeParse(body);
  }
  if (kind === "references") {
    return (isPatch ? ReferencePatchSchema : ReferenceCreateSchema).safeParse(body);
  }
  return (isPatch ? GuidePatchSchema : GuideCreateSchema).safeParse(body);
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        tools: [],
        decor: [],
        shotlist: [],
        references: [],
        guides: [],
      },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }

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
  const eventId = context.params.id;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = body?.kind as SectionResourceKind;
    const table = TABLE_MAP[kind];
    if (!table) {
      return NextResponse.json({ success: false, error: "Tipe section tidak valid" }, { status: 400 });
    }

    const writeAuth = await requireSectionWriteAccess(eventId, kind);
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.error }, { status: writeAuth.status });
    }

    const parsed = validateSectionPayload(kind, body, false);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data item section tidak valid" },
        { status: 400 }
      );
    }

    const cleanData = parsed.data as Record<string, unknown>;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: true, item: { id: `sec-${Date.now()}`, event_id: eventId, ...cleanData } },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(table)
      .insert({ ...cleanData, event_id: eventId })
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
  const eventId = context.params.id;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = body?.kind as SectionResourceKind;
    const itemId = typeof body?.id === "string" ? body.id : "";
    const table = TABLE_MAP[kind];
    if (!table || !itemId) {
      return NextResponse.json({ success: false, error: "Parameter kind/id tidak valid" }, { status: 400 });
    }

    const writeAuth = await requireSectionWriteAccess(eventId, kind);
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.error }, { status: writeAuth.status });
    }

    const parsed = validateSectionPayload(kind, body, true);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data pembaruan tidak valid" },
        { status: 400 }
      );
    }

    const cleanUpdates = parsed.data as Record<string, unknown>;
    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ success: false, error: "Tidak ada field valid untuk diperbarui" }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, item: { id: itemId, ...cleanUpdates } });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(table)
      .update(cleanUpdates)
      .eq("id", itemId)
      .eq("event_id", eventId)
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
  const eventId = context.params.id;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as SectionResourceKind;
  const itemId = url.searchParams.get("itemId");
  const table = TABLE_MAP[kind];
  if (!table || !itemId) {
    return NextResponse.json({ success: false, error: "Parameter kind/itemId tidak valid" }, { status: 400 });
  }

  const writeAuth = await requireSectionWriteAccess(eventId, kind);
  if (!writeAuth.allowed) {
    return NextResponse.json({ success: false, error: writeAuth.error }, { status: writeAuth.status });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", itemId)
    .eq("event_id", eventId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
