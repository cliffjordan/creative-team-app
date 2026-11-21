import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { SaveDocumentSchema } from "@/lib/validators/schemas";

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
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak ditemukan. Silakan login." }, { status: 401 });
  }

  const eventId = context.params.id;
  try {
    const body = await request.json();
    const parsed = SaveDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data dokumen tidak valid" },
        { status: 400 }
      );
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
    const { data: existing } = await supabase
      .from("event_documents")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Dokumen belum diinisiasi untuk event ini." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("event_documents")
      .update({
        document_data: parsed.data.document_data,
        ...(parsed.data.org_chart_url !== undefined
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
