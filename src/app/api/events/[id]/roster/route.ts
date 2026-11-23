import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { AssignRosterSchema } from "@/lib/validators/schemas";

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
    return NextResponse.json({ success: true, roster: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("event_roster")
      .select(
        `
        *,
        user:users(id, full_name, base_role, avatar_url)
      `
      )
      .eq("event_id", eventId)
      .order("section", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, roster: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, roster: data ?? [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat roster", roster: [] },
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

  const eventId = context.params.id;
  try {
    const body = await request.json();
    const parsed = AssignRosterSchema.safeParse({ ...body, event_id: eventId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data roster tidak valid" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: true,
          member: {
            id: crypto.randomUUID(),
            ...parsed.data,
          },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const [{ data: actor }, { data: targetEvent }, { data: actorRoster }, { data: existingMember }] =
      await Promise.all([
        supabase
          .from("users")
          .select("base_role, is_superadmin")
          .eq("id", session.userId)
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
        supabase
          .from("event_roster")
          .select("id, section")
          .eq("event_id", eventId)
          .eq("user_id", parsed.data.user_id)
          .maybeSingle(),
      ]);

    const isTopLeader =
      actor?.base_role === "CREATIVE_LEADER" ||
      actor?.base_role === "WAKIL_LEADER" ||
      Boolean(actor?.is_superadmin) ||
      targetEvent?.event_leader_id === session.userId ||
      actorRoster?.role_in_event === "EVENT_LEADER" ||
      Boolean(actorRoster?.is_co_controller);

    const isMatchedSectionLeader =
      actorRoster?.role_in_event === "SECTION_LEADER" &&
      actorRoster.section === parsed.data.section &&
      parsed.data.role_in_event === "MEMBER";

    if (!isTopLeader && !isMatchedSectionLeader) {
      return NextResponse.json(
        {
          success: false,
          error: "Section Leader hanya dapat menambahkan Member ke divisi yang dipimpinnya.",
        },
        { status: 403 }
      );
    }

    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: `Anggota ini sudah terdaftar di divisi ${existingMember.section} pada event ini (maksimal 1 section per event).`,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("event_roster")
      .insert({
        event_id: eventId,
        user_id: parsed.data.user_id,
        section: parsed.data.section,
        role_in_event: parsed.data.role_in_event,
        is_co_controller: parsed.data.is_co_controller,
      })
      .select(
        `
        *,
        user:users(id, full_name, base_role, avatar_url)
      `
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error:
            error?.code === "23505"
              ? "Anggota ini sudah terdaftar di divisi lain pada event ini."
              : error?.message || "Gagal menambahkan anggota ke roster",
        },
        { status: error?.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true, member: data }, { status: 201 });
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

  const eventId = context.params.id;
  const url = new URL(request.url);
  const rosterId = url.searchParams.get("rosterId");
  if (!rosterId) {
    return NextResponse.json({ success: false, error: "rosterId wajib diisi" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  try {
    const supabase = createServerClient();
    const [{ data: actor }, { data: targetEvent }, { data: actorRoster }, { data: targetRow }] =
      await Promise.all([
        supabase
          .from("users")
          .select("base_role, is_superadmin")
          .eq("id", session.userId)
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
        supabase
          .from("event_roster")
          .select("id, section, role_in_event")
          .eq("id", rosterId)
          .eq("event_id", eventId)
          .maybeSingle(),
      ]);

    if (!targetRow) {
      return NextResponse.json({ success: false, error: "Data roster tidak ditemukan." }, { status: 404 });
    }

    const isTopLeader =
      actor?.base_role === "CREATIVE_LEADER" ||
      actor?.base_role === "WAKIL_LEADER" ||
      Boolean(actor?.is_superadmin) ||
      targetEvent?.event_leader_id === session.userId ||
      actorRoster?.role_in_event === "EVENT_LEADER" ||
      Boolean(actorRoster?.is_co_controller);

    const isMatchedSectionLeader =
      actorRoster?.role_in_event === "SECTION_LEADER" &&
      actorRoster.section === targetRow.section &&
      targetRow.role_in_event === "MEMBER";

    if (!isTopLeader && !isMatchedSectionLeader) {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Section Leader hanya dapat menghapus Member pada divisinya sendiri.",
        },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("event_roster")
      .delete()
      .eq("id", rosterId)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
