import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { hashPin, verifyPinHash } from "@/lib/auth/pin-hash";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { SafeNameSchema } from "@/lib/validators/schemas";
import {
  signSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";

const RegisterUserSchema = z.object({
  full_name: SafeNameSchema,
  phone: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(25),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus berupa 4 digit angka"),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`register:${ip}`, 6, 10 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Batas pendaftaran tercapai sementara. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

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

    const { full_name, phone, email, pin } = parsed.data;
    const normalizedEmail =
      email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
    const pinHash = hashPin(pin);

    if (!isSupabaseConfigured()) {
      const newUser = {
        id: crypto.randomUUID(),
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        base_role: "CREATIVE_LEADER" as const,
        default_section: "INTI" as const,
        is_role_assigned: true,
        is_superadmin: true,
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
      .select("id", { count: "exact", head: true })
      .eq("is_superadmin", false);

    const isFirstUser = (count ?? 0) === 0;
    const effectiveRole = isFirstUser ? "CREATIVE_LEADER" : "MEMBER";
    const isSuperadmin = false;
    const defaultSection = isFirstUser ? "INTI" : null;
    const isRoleAssigned = isFirstUser;

    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert({
        full_name: full_name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        pin_hash: pinHash,
        base_role: effectiveRole,
        default_section: defaultSection,
        is_role_assigned: isRoleAssigned,
        is_superadmin: isSuperadmin,
        failed_pin_attempts: 0,
      })
      .select(
        "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at"
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

// Keep unused verifyPinHash cleanly avoided if needed
void verifyPinHash;
