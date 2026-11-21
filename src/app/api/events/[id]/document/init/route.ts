import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { SectionType } from "@/types/domain";

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  const eventId = context.params.id;
  let body: { document_data?: Record<string, unknown>; org_chart_url?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!isSupabaseConfigured()) {
    const mockTasks = [
      {
        id: `t-doc-acara-${Date.now()}`,
        event_id: eventId,
        section: "ACARA" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Dokumen Brief — Bagian 03A (Acara), 07 (Rundown) & 08 (Teknis)",
        description: "Isi konsep utama alur acara, spesial moment, rundown, dan teknis pelaksanaan.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `t-doc-dekor-${Date.now()}`,
        event_id: eventId,
        section: "DEKORASI" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Dokumen Brief — Bagian 03B (Konsep & Item Dekorasi)",
        description: "Isi konsep dekorasi, palet warna, visualisasi panggung, dan item dekorasi.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `t-doc-perlengkapan-${Date.now()}`,
        event_id: eventId,
        section: "PERLENGKAPAN" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Dokumen Brief — Bagian 03C (Perlengkapan & Teknis)",
        description: "Isi daftar peralatan, qty, kegunaan, prioritas, dan catatan teknis.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `t-doc-pdd-${Date.now()}`,
        event_id: eventId,
        section: "PDD" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Dokumen Brief — Bagian 03D (Dokumentasi & Shotlist)",
        description: "Isi objektif dokumentasi, kebutuhan konten, shot list, dan output target.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `t-doc-bendahara-${Date.now()}`,
        event_id: eventId,
        section: "INTI" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Pembiayaan Event (Bagian 04 Budget Overview Dokumen)",
        description: "Input rincian anggaran di menu Pembiayaan agar otomatis masuk ke dokumen.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `t-doc-sekretaris-${Date.now()}`,
        event_id: eventId,
        section: "INTI" as SectionType,
        phase: "PRE_EVENT" as const,
        title: "Lengkapi Struktur Panitia (05) & Pelayan (06) di Menu Sekretariat",
        description: "Susun Struktur Panitia & Pelayan di menu Sekretariat untuk sinkronisasi otomatis.",
        assigned_to: null,
        due_date: new Date().toISOString().slice(0, 10),
        status: "TODO" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    return NextResponse.json(
      {
        success: true,
        document: {
          id: `doc-${eventId}`,
          event_id: eventId,
          document_data: body.document_data ?? {},
          org_chart_url: body.org_chart_url ?? null,
          created_by: session.userId,
          updated_by: session.userId,
          tasks_generated: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        tasks: mockTasks,
      },
      { status: 201 }
    );
  }

  try {
    const supabase = createServerClient();

    const [{ data: actor }, { data: eventRow }, { data: rosterRows }, { data: existingDoc }, { data: allUsers }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, base_role, is_superadmin")
          .eq("id", session.userId)
          .maybeSingle(),
        supabase
          .from("events")
          .select("id, title, event_date, event_leader_id")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_roster")
          .select("user_id, section, role_in_event, is_co_controller")
          .eq("event_id", eventId),
        supabase
          .from("event_documents")
          .select("*")
          .eq("event_id", eventId)
          .maybeSingle(),
        supabase
          .from("users")
          .select("id, full_name, base_role, default_section")
          .order("created_at", { ascending: true }),
      ]);

    if (!actor) {
      return NextResponse.json({ success: false, error: "Akun tidak ditemukan." }, { status: 401 });
    }
    if (!eventRow) {
      return NextResponse.json({ success: false, error: "Event tidak ditemukan." }, { status: 404 });
    }

    const isLeader =
      actor.base_role === "CREATIVE_LEADER" ||
      actor.base_role === "WAKIL_LEADER" ||
      Boolean(actor.is_superadmin) ||
      eventRow.event_leader_id === actor.id ||
      (rosterRows ?? []).some(
        (r) =>
          r.user_id === actor.id &&
          (r.role_in_event === "EVENT_LEADER" || r.is_co_controller)
      );

    if (!isLeader) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hanya Event Leader, Wakil Creative Leader, atau Creative Leader yang berhak menginisiasi Dokumen Event.",
        },
        { status: 403 }
      );
    }

    if (existingDoc) {
      return NextResponse.json(
        {
          success: false,
          exists: true,
          document: existingDoc,
          error: "Dokumen untuk event ini sudah dibuat. Silakan edit dokumen yang sudah ada.",
        },
        { status: 409 }
      );
    }

    const { data: createdDoc, error: insertDocErr } = await supabase
      .from("event_documents")
      .insert({
        event_id: eventId,
        document_data: body.document_data ?? {},
        org_chart_url: body.org_chart_url ?? null,
        created_by: actor.id,
        updated_by: actor.id,
        tasks_generated: true,
      })
      .select("*")
      .single();

    if (insertDocErr || !createdDoc) {
      return NextResponse.json(
        { success: false, error: insertDocErr?.message || "Gagal menginisiasi dokumen" },
        { status: 500 }
      );
    }

    // Resolve due_date (H-7 of event_date or today if H-7 is in the past)
    const eventTimeMs = new Date(`${eventRow.event_date}T00:00:00Z`).getTime();
    const h7Date = new Date(eventTimeMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueDate = h7Date < todayIso ? eventRow.event_date : h7Date;

    const findSectionLeader = (targetSection: SectionType): string | null => {
      const rosterExact = (rosterRows ?? []).find(
        (r) => r.section === targetSection && r.role_in_event === "SECTION_LEADER"
      );
      if (rosterExact) return rosterExact.user_id;

      const rosterAny = (rosterRows ?? []).find((r) => r.section === targetSection);
      if (rosterAny) return rosterAny.user_id;

      const userLeader = (allUsers ?? []).find(
        (u) => u.base_role === "SECTION_LEADER" && u.default_section === targetSection
      );
      if (userLeader) return userLeader.id;

      const userMember = (allUsers ?? []).find((u) => u.default_section === targetSection);
      return userMember?.id ?? null;
    };

    const findRoleUser = (targetRole: string): string | null => {
      const u = (allUsers ?? []).find((item) => item.base_role === targetRole);
      return u?.id ?? null;
    };

    const taskPayloads = [
      {
        event_id: eventId,
        section: "ACARA",
        phase: "PRE_EVENT",
        title: `Lengkapi Dokumen Brief — 03A (Section Acara), 07 (Rundown) & 08 (Teknis)`,
        description: `Diinisiasi otomatis dari Event Project Brief (${eventRow.title}). Isi alur acara, spesial moment, susunan rundown, dan teknis pelaksanaan.`,
        assigned_to: findSectionLeader("ACARA"),
        due_date: dueDate,
        status: "TODO",
      },
      {
        event_id: eventId,
        section: "DEKORASI",
        phase: "PRE_EVENT",
        title: `Lengkapi Dokumen Brief — 03B (Konsep, Visualisasi & Item Dekorasi)`,
        description: `Diinisiasi otomatis dari Event Project Brief (${eventRow.title}). Isi konsep dekorasi, palet warna, referensi visual, dan daftar kebutuhan item.`,
        assigned_to: findSectionLeader("DEKORASI"),
        due_date: dueDate,
        status: "TODO",
      },
      {
        event_id: eventId,
        section: "PERLENGKAPAN",
        phase: "PRE_EVENT",
        title: `Lengkapi Dokumen Brief — 03C (Peralatan, Kegunaan & Prioritas)`,
        description: `Diinisiasi otomatis dari Event Project Brief (${eventRow.title}). Isi daftar peralatan, kuantitas, prioritas (High/Med/Low), dan syarat teknis.`,
        assigned_to: findSectionLeader("PERLENGKAPAN"),
        due_date: dueDate,
        status: "TODO",
      },
      {
        event_id: eventId,
        section: "PDD",
        phase: "PRE_EVENT",
        title: `Lengkapi Dokumen Brief — 03D (Dokumentasi, Shotlist & Target Output)`,
        description: `Diinisiasi otomatis dari Event Project Brief (${eventRow.title}). Lengkapi objektif dokumentasi, shot list prioritas, dan target output.`,
        assigned_to: findSectionLeader("PDD"),
        due_date: dueDate,
        status: "TODO",
      },
      {
        event_id: eventId,
        section: "INTI",
        phase: "PRE_EVENT",
        title: `Lengkapi Rincian Pembiayaan (Bagian 04 Budget Overview Dokumen)`,
        description: `Diinisiasi otomatis untuk Bendahara. Lengkapi estimasi & tanggal diperlukan di menu Pembiayaan untuk sinkronisasi otomatis ke Dokumen Project Brief.`,
        assigned_to: findRoleUser("BENDAHARA"),
        due_date: dueDate,
        status: "TODO",
      },
      {
        event_id: eventId,
        section: "INTI",
        phase: "PRE_EVENT",
        title: `Lengkapi Struktur Panitia (05) & Daftar Pelayan (06) di Menu Sekretariat`,
        description: `Diinisiasi otomatis untuk Sekretaris. Isi Struktur Builder & Struktur Pelayan di menu Sekretariat untuk sinkronisasi otomatis ke Dokumen.`,
        assigned_to: findRoleUser("SEKRETARIS"),
        due_date: dueDate,
        status: "TODO",
      },
    ];

    const { data: insertedTasks } = await supabase
      .from("timeline_tasks")
      .insert(taskPayloads)
      .select("*");

    const notifPayloads = (insertedTasks ?? [])
      .filter((t) => Boolean(t.assigned_to))
      .map((t) => ({
        user_id: t.assigned_to as string,
        event_id: eventId,
        type: "TASK_ASSIGNED",
        title: `Tugas Dokumen Baru: ${eventRow.title}`,
        body: t.title,
      }));

    if (notifPayloads.length > 0) {
      await supabase.from("notifications").insert(notifPayloads);
    }

    return NextResponse.json(
      {
        success: true,
        document: createdDoc,
        tasks: insertedTasks ?? [],
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Terjadi kesalahan saat menginisiasi dokumen",
      },
      { status: 500 }
    );
  }
}
