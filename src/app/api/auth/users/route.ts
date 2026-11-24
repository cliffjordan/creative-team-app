import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";
import { getServerSession } from "@/lib/auth/session";
import { hashPin } from "@/lib/auth/pin-hash";
import { ensureTechnicalSuperadmin } from "@/lib/auth/superadmin-bootstrap";
import { SafeNameSchema } from "@/lib/validators/schemas";
import { SectionTypeSchema, UserBaseRoleSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at";

const PUBLIC_USER_SELECT_COLUMNS =
  "id, full_name, base_role, is_role_assigned, is_superadmin, avatar_url";

const CreateMemberSchema = z.object({
  full_name: SafeNameSchema,
  phone: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(25),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  base_role: UserBaseRoleSchema.default("MEMBER"),
  default_section: SectionTypeSchema.nullable().optional(),
  is_role_assigned: z.boolean().optional().default(true),
  is_superadmin: z.boolean().optional(),
  pin: z.string().length(4, "PIN harus 4 digit").regex(/^\d{4}$/, "PIN harus 4 digit angka"),
});

export async function GET() {
  noStore();
  const session = await getServerSession();
  if (!isSupabaseConfigured()) {
    const operationalUsers = INITIAL_USERS.filter((u) => !u.is_superadmin);
    const safeUsers = session
      ? operationalUsers
      : operationalUsers.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          base_role: u.base_role,
          is_role_assigned: u.is_role_assigned,
          is_superadmin: false,
          avatar_url: u.avatar_url,
        }));
    return NextResponse.json(
      {
        success: true,
        users: safeUsers,
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    await ensureTechnicalSuperadmin(supabase);

    const { data, error } = await supabase
      .from("users")
      .select(session ? USER_SELECT_COLUMNS : PUBLIC_USER_SELECT_COLUMNS)
      .eq("is_superadmin", false)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Gagal memuat daftar pengguna", users: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        users: data ?? [],
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server", users: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesi tidak valid. Silakan login." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data member tidak valid" },
        { status: 400 }
      );
    }

    const { full_name, phone, email, base_role, default_section, is_role_assigned, is_superadmin, pin } = parsed.data;
    if (is_superadmin === true) {
      return NextResponse.json(
        { success: false, error: "Akun teknis Superadmin tidak dapat dibuat melalui Manajemen Member." },
        { status: 403 }
      );
    }

    const normalizedEmail = email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
    const resolvedSection =
      default_section && default_section !== "ALL" ? default_section : null;

    if (!isSupabaseConfigured()) {
      if (session.baseRole !== "CREATIVE_LEADER" && !session.isSuperadmin) {
        return NextResponse.json(
          { success: false, error: "Hanya Creative Leader yang dapat menambah anggota." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          success: true,
          user: {
            id: crypto.randomUUID(),
            full_name: full_name.trim(),
            phone: phone.trim(),
            email: normalizedEmail,
            base_role,
            default_section: resolvedSection,
            is_role_assigned: is_role_assigned ?? true,
            is_superadmin: false,
            failed_pin_attempts: 0,
            created_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data: actor } = await supabase
      .from("users")
      .select("base_role, is_superadmin")
      .eq("id", session.userId)
      .maybeSingle();

    if (!actor || (actor.base_role !== "CREATIVE_LEADER" && !actor.is_superadmin)) {
      return NextResponse.json(
        { success: false, error: "Hanya Creative Leader yang dapat menambah anggota." },
        { status: 403 }
      );
    }

    if (normalizedEmail) {
      const { data: dup } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (dup) {
        return NextResponse.json({ success: false, error: "Email sudah digunakan anggota lain." }, { status: 409 });
      }
    }

    const { data: created, error: insertError } = await supabase
      .from("users")
      .insert({
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: normalizedEmail,
        pin_hash: hashPin(pin),
        base_role,
        default_section: resolvedSection,
        is_role_assigned: is_role_assigned ?? true,
        is_superadmin: false,
        failed_pin_attempts: 0,
      })
      .select(USER_SELECT_COLUMNS)
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Gagal menambahkan anggota" },
        { status: 500 }
      );
    }

    try {
      await supabase.from("operation_records").insert({
        operation_id: crypto.randomUUID(),
        event_id: null,
        action_type: "USER_CREATED",
        actor_id: session.userId,
        details: {
          target_user_id: created.id,
          target_name: created.full_name,
          base_role: created.base_role,
        },
      });
    } catch {
      // Ignore audit log error before migration_v3 is applied
    }

    return NextResponse.json({ success: true, user: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
