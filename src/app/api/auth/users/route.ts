import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";
import { getServerSession } from "@/lib/auth/session";
import { hashPin } from "@/lib/auth/pin-hash";
import { SectionTypeSchema, UserBaseRoleSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at";

const CreateMemberSchema = z.object({
  full_name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  phone: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(25),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  base_role: UserBaseRoleSchema.default("MEMBER"),
  default_section: SectionTypeSchema.nullable().optional(),
  is_role_assigned: z.boolean().optional().default(true),
  pin: z.string().length(4, "PIN harus 4 digit").regex(/^\d{4}$/, "PIN harus 4 digit angka"),
});

export async function GET() {
  noStore();
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: true,
        users: INITIAL_USERS,
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT_COLUMNS)
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

    const { full_name, phone, email, base_role, default_section, is_role_assigned, pin } = parsed.data;
    const normalizedEmail = email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
    const isSuper = base_role === "CREATIVE_LEADER";
    const resolvedSection =
      default_section && default_section !== "ALL"
        ? default_section
        : base_role === "CREATIVE_LEADER" || base_role === "WAKIL_LEADER" || base_role === "SEKRETARIS" || base_role === "BENDAHARA"
        ? "INTI"
        : null;

    if (!isSupabaseConfigured()) {
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
            is_role_assigned,
            is_superadmin: isSuper,
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
        is_role_assigned,
        is_superadmin: isSuper,
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

    return NextResponse.json({ success: true, user: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
