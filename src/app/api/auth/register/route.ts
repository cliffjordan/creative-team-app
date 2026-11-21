import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/auth/pin-hash";
import {
  signSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import { UserBaseRoleSchema } from "@/lib/validators/schemas";

const RegisterUserSchema = z.object({
  full_name: z.string().trim().min(2, "Nama lengkap minimal 2 karakter").max(120),
  phone: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(25),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  base_role: UserBaseRoleSchema.default("MEMBER"),
  section: z.enum(["ACARA", "DEKORASI", "PERLENGKAPAN", "PDD"]).optional().nullable(),
  pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus berupa 4 digit angka"),
});

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("demo.supabase.co") &&
      !key.includes("demo-service-key")
  );
}

const SECTION_LABEL_MAP: Record<string, string> = {
  ACARA: "Acara",
  DEKORASI: "Dekorasi",
  PERLENGKAPAN: "Perlengkapan",
  PDD: "PDD",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegisterUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Data pendaftaran tidak valid",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { full_name, phone, email, base_role, section, pin } = parsed.data;
    const normalizedEmail =
      email && email.trim().length > 0 ? email.trim().toLowerCase() : null;

    let displayName = full_name.trim();
    if (
      section &&
      (base_role === "SECTION_LEADER" || base_role === "MEMBER") &&
      !displayName.toLowerCase().includes(SECTION_LABEL_MAP[section].toLowerCase())
    ) {
      const rolePrefix = base_role === "SECTION_LEADER" ? "Leader " : "";
      displayName = `${displayName} (${rolePrefix}${SECTION_LABEL_MAP[section]})`;
    }

    const pinHash = hashPin(pin);

    if (!isSupabaseConfigured()) {
      const newUser = {
        id: crypto.randomUUID(),
        full_name: displayName,
        email: normalizedEmail,
        phone: phone.trim(),
        base_role,
        is_superadmin: base_role === "CREATIVE_LEADER",
        failed_pin_attempts: 0,
        created_at: new Date().toISOString(),
      };

      const token = await signSessionToken({
        userId: newUser.id,
        fullName: newUser.full_name,
        baseRole: newUser.base_role,
        isSuperadmin: newUser.is_superadmin,
      });

      const response = NextResponse.json({ success: true, user: newUser }, { status: 201 });
      response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
      return response;
    }

    const supabase = createServerClient();

    if (normalizedEmail) {
      const { data: existingEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Email sudah terdaftar. Silakan gunakan email lain atau langsung login.",
          },
          { status: 409 }
        );
      }
    }

    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    const isFirstUser = (count ?? 0) === 0;
    const effectiveRole = isFirstUser ? "CREATIVE_LEADER" : base_role;
    const isSuperadmin = isFirstUser || effectiveRole === "CREATIVE_LEADER";

    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert({
        full_name: displayName,
        email: normalizedEmail,
        phone: phone.trim(),
        pin_hash: pinHash,
        base_role: effectiveRole,
        is_superadmin: isSuperadmin,
        failed_pin_attempts: 0,
      })
      .select(
        "id, full_name, email, phone, is_superadmin, base_role, avatar_url, failed_pin_attempts, locked_until, created_at"
      )
      .single();

    if (insertError || !insertedUser) {
      return NextResponse.json(
        {
          success: false,
          error: insertError?.message || "Gagal mendaftarkan akun baru",
        },
        { status: 500 }
      );
    }

    const token = await signSessionToken({
      userId: insertedUser.id,
      fullName: insertedUser.full_name,
      baseRole: insertedUser.base_role,
      isSuperadmin: Boolean(insertedUser.is_superadmin),
    });

    const response = NextResponse.json(
      {
        success: true,
        user: insertedUser,
      },
      { status: 201 }
    );
    response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan server saat registrasi",
      },
      { status: 500 }
    );
  }
}
