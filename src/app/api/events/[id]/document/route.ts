import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireEventAccess } from "@/lib/auth/guards";
import { SaveDocumentSchema, validateDocumentUrls } from "@/lib/validators/schemas";
import type { BriefSectionScope } from "@/types/domain";

const SCOPE_KEY_GROUPS: Record<Exclude<BriefSectionScope, "FULL">, string[]> = {
  OVERVIEW: [
    "eventName",
    "mainTheme",
    "scriptureRef",
    "scriptureQuote",
    "eventDate",
    "eventTime",
    "location",
    "tagline",
    "background",
    "keyMessage",
    "objectives",
    "targetAudience",
    "coreConcept",
    "overviewSections",
    "desiredAtmosphere",
    "atmosphereItems",
    "journeyBefore",
    "journeyArrival",
    "journeyOpening",
    "journeyMain",
    "journeyClosing",
    "journeyAfter",
    "journeySections",
  ],
  ACARA: [
    "acaraConcept",
    "acaraProgram",
    "acaraSpecialMoment",
    "acaraTalent",
    "acaraDuration",
    "acaraSpecialReq",
    "acaraSections",
  ],
  DEKORASI: [
    "decorConcept",
    "decorStyle",
    "decorPalette",
    "decorKeyVisual",
    "decorAreas",
    "decorSpecialReq",
    "decorImageUrl",
    "decorItems",
    "decorSections",
  ],
  PERLENGKAPAN: ["equipmentItems", "techRequirements", "techRequirementItems"],
  PDD: [
    "docObjective",
    "docContent",
    "docShotlist",
    "docPlatforms",
    "docTarget",
    "pddSections",
  ],
  BUDGET: ["budgetOverview", "budgetDetails"],
  SEKRETARIAT: ["orgChartUrl", "committee", "ministers"],
  RUNDOWN: [
    "rundownTotalDuration",
    "rundownOpenGate",
    "rundownStartTime",
    "rundownEndTime",
    "rundown",
  ],
  TECHNICAL: [
    "techEvent1",
    "techEvent2",
    "techEvent3",
    "techSpecial1",
    "techSpecial2",
    "techSpecial3",
    "techPerf1",
    "techPerf2",
    "techPerf3",
    "technicalSections",
  ],
  APPROVAL: ["approvals", "finalCreativeDirection", "finalDirectionItems"],
};

const ALL_BRIEF_SCOPES = Object.keys(SCOPE_KEY_GROUPS) as Array<
  Exclude<BriefSectionScope, "FULL">
>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error, exists: false, document: null },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: true, exists: false, document: null },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("event_documents")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, exists: false, document: null },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        exists: Boolean(data),
        document: data ?? null,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memuat dokumen event",
        exists: false,
        document: null,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }
  const session = access.session;

  try {
    const body = await request.json();
    const parsed = SaveDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data dokumen tidak valid" },
        { status: 400 }
      );
    }

    const urlValidationErr = validateDocumentUrls(parsed.data.document_data);
    if (urlValidationErr) {
      return NextResponse.json({ success: false, error: urlValidationErr }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        document: {
          id: `doc-${eventId}`,
          event_id: eventId,
          document_data: parsed.data.document_data,
          org_chart_url: parsed.data.org_chart_url ?? null,
          created_by: session.userId,
          updated_by: session.userId,
          tasks_generated: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    const supabase = createServerClient();

    const [{ data: actor }, { data: existing }, { data: targetEvent }, { data: actorRoster }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, base_role, default_section, is_role_assigned, is_superadmin")
          .eq("id", session.userId)
          .maybeSingle(),
        supabase
          .from("event_documents")
          .select("id, document_data")
          .eq("event_id", eventId)
          .maybeSingle(),
        supabase
          .from("events")
          .select("event_leader_id")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_roster")
          .select("section, role_in_event, is_co_controller")
          .eq("event_id", eventId)
          .eq("user_id", session.userId)
          .maybeSingle(),
      ]);

    if (!actor) {
      return NextResponse.json({ success: false, error: "Akun tidak ditemukan." }, { status: 401 });
    }

    const isUnassigned =
      !actor.is_superadmin &&
      actor.base_role === "MEMBER" &&
      !actor.is_role_assigned;

    if (isUnassigned) {
      return NextResponse.json(
        {
          success: false,
          error: "Member umum belum di-assign role/divisi tidak berhak mengubah dokumen event.",
        },
        { status: 403 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Dokumen belum diinisiasi untuk event ini." },
        { status: 404 }
      );
    }

    const isFullManager =
      actor.base_role === "CREATIVE_LEADER" ||
      actor.base_role === "WAKIL_LEADER" ||
      Boolean(actor.is_superadmin) ||
      targetEvent?.event_leader_id === actor.id ||
      actorRoster?.role_in_event === "EVENT_LEADER" ||
      Boolean(actorRoster?.is_co_controller);

    const allowedScopes = new Set<Exclude<BriefSectionScope, "FULL">>();
    if (isFullManager) {
      ALL_BRIEF_SCOPES.forEach((sc) => allowedScopes.add(sc));
    } else {
      if (actor.base_role === "SEKRETARIS") {
        allowedScopes.add("OVERVIEW");
        allowedScopes.add("SEKRETARIAT");
        allowedScopes.add("TECHNICAL");
        allowedScopes.add("APPROVAL");
      }
      if (actor.base_role === "BENDAHARA") {
        allowedScopes.add("BUDGET");
      }
      const sec = actorRoster?.section;
      if (sec === "ACARA" || sec === "ALL") {
        allowedScopes.add("ACARA");
        allowedScopes.add("RUNDOWN");
        allowedScopes.add("TECHNICAL");
      }
      if (sec === "DEKORASI" || sec === "ALL") {
        allowedScopes.add("DEKORASI");
        allowedScopes.add("TECHNICAL");
      }
      if (sec === "PERLENGKAPAN" || sec === "ALL") {
        allowedScopes.add("PERLENGKAPAN");
        allowedScopes.add("TECHNICAL");
      }
      if (sec === "PDD" || sec === "ALL") {
        allowedScopes.add("PDD");
        allowedScopes.add("TECHNICAL");
      }
    }

    if (allowedScopes.size === 0) {
      return NextResponse.json(
        { success: false, error: "Anda tidak memiliki izin mengubah dokumen event ini." },
        { status: 403 }
      );
    }

    const requestedScope = parsed.data.section_scope;
    const effectiveScopes: Array<Exclude<BriefSectionScope, "FULL">> =
      requestedScope && requestedScope !== "FULL"
        ? allowedScopes.has(requestedScope)
          ? [requestedScope]
          : []
        : Array.from(allowedScopes);

    if (effectiveScopes.length === 0) {
      return NextResponse.json(
        { success: false, error: "Anda tidak berhak mengubah bagian dokumen tersebut." },
        { status: 403 }
      );
    }

    const allowedKeys = new Set<string>();
    for (const sc of effectiveScopes) {
      for (const k of SCOPE_KEY_GROUPS[sc]) {
        allowedKeys.add(k);
      }
    }

    const existingData =
      existing.document_data && typeof existing.document_data === "object"
        ? (existing.document_data as Record<string, unknown>)
        : {};
    const scopedIncoming: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data.document_data)) {
      if (allowedKeys.has(k)) {
        scopedIncoming[k] = v;
      }
    }
    const mergedData = { ...existingData, ...scopedIncoming };
    const canUpdateOrgChart = allowedScopes.has("SEKRETARIAT");

    const { data, error } = await supabase
      .from("event_documents")
      .update({
        document_data: mergedData,
        ...(canUpdateOrgChart && parsed.data.org_chart_url !== undefined
          ? { org_chart_url: parsed.data.org_chart_url || null }
          : {}),
        updated_by: session.userId,
      })
      .eq("event_id", eventId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal memperbarui dokumen event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, document: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
