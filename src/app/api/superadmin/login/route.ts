import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { verifyPinHash } from "@/lib/auth/pin-hash";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { ensureTechnicalSuperadmin } from "@/lib/auth/superadmin-bootstrap";
import {
  signSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const SuperadminLoginSchema = z.object({
  email: z.string().trim().email("Format email Superadmin tidak valid"),
  pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus 4 digit angka"),
});

export async function POST(request: Request) {
  noStore();

  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`superadmin-login:${ip}`, 6, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan masuk Superadmin. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const parsed = SuperadminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Email atau PIN tidak valid.",
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { email, pin } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    if (!isSupabaseConfigured()) {
      const expectedPin = process.env.SUPERADMIN_DEFAULT_PIN || "9999";
      const validDemoEmail = normalizedEmail === "superadmin@creativehub.local";
      const validDemoPin = pin === expectedPin || pin === "1234";

      if (!validDemoEmail || !validDemoPin) {
        return NextResponse.json(
          { success: false, error: "Email atau PIN Superadmin tidak valid." },
          { status: 401, headers: NO_CACHE_HEADERS }
        );
      }

      const demoSuperadmin = {
        id: "00000000-0000-4000-8000-000000000099",
        full_name: "System Superadmin",
        email: "superadmin@creativehub.local",
        phone: "+6280000000000",
        base_role: "MEMBER" as const,
        default_section: null,
        is_role_assigned: true,
        is_superadmin: true,
        avatar_url: undefined,
        failed_pin_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString(),
      };

      const token = await signSessionToken({
        userId: demoSuperadmin.id,
        fullName: demoSuperadmin.full_name,
        baseRole: demoSuperadmin.base_role,
        isSuperadmin: true,
      });

      const response = NextResponse.json(
        { success: true, user: demoSuperadmin },
        { headers: NO_CACHE_HEADERS }
      );
      response.cookies.set(
        getSessionCookieOptions().name,
        token,
        getSessionCookieOptions()
      );
      return response;
    }

    const supabase = createServerClient();
    await ensureTechnicalSuperadmin(supabase);

    const { data: userRow, error: fetchError } = await supabase
      .from("users")
      .select(
        "id, full_name, email, phone, pin_hash, base_role, default_section, is_role_assigned, is_superadmin, avatar_url, failed_pin_attempts, locked_until, created_at"
      )
      .eq("is_superadmin", true)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Gagal memverifikasi kredensial Superadmin." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (!userRow) {
      return NextResponse.json(
        { success: false, error: "Email atau PIN Superadmin tidak valid." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (
      userRow.locked_until &&
      new Date(userRow.locked_until).getTime() > Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Akun Superadmin terkunci sementara 15 menit karena 5x salah PIN.",
          is_locked: true,
        },
        { status: 423, headers: NO_CACHE_HEADERS }
      );
    }

    let isPinValid = false;
    if (userRow.pin_hash?.startsWith("scrypt$")) {
      isPinValid = verifyPinHash(pin, userRow.pin_hash);
    } else {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "verify_user_pin",
        {
          p_user_id: userRow.id,
          p_pin: pin,
        }
      );
      if (!rpcError) {
        if (typeof rpcResult === "boolean") {
          isPinValid = rpcResult;
        } else if (Array.isArray(rpcResult)) {
          isPinValid = Boolean(rpcResult[0]?.success);
        } else if (rpcResult && typeof rpcResult === "object") {
          isPinValid = Boolean((rpcResult as { success?: boolean }).success);
        }
      }
    }

    if (!isPinValid) {
      const nextAttempts = (userRow.failed_pin_attempts || 0) + 1;
      const shouldLock = nextAttempts >= 5;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      await supabase
        .from("users")
        .update({
          failed_pin_attempts: nextAttempts,
          locked_until: lockedUntil,
        })
        .eq("id", userRow.id);

      return NextResponse.json(
        {
          success: false,
          error: shouldLock
            ? "Akun Superadmin terkunci 15 menit karena 5x salah PIN."
            : "Email atau PIN Superadmin tidak valid.",
          is_locked: shouldLock,
        },
        { status: shouldLock ? 423 : 401, headers: NO_CACHE_HEADERS }
      );
    }

    if ((userRow.failed_pin_attempts || 0) > 0 || userRow.locked_until) {
      await supabase
        .from("users")
        .update({
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq("id", userRow.id);
    }

    try {
      await supabase.from("operation_records").insert({
        operation_id: crypto.randomUUID(),
        event_id: null,
        action_type: "SUPERADMIN_LOGIN",
        actor_id: userRow.id,
        details: {
          email: userRow.email,
          logged_in_at: new Date().toISOString(),
        },
      });
    } catch {
      // Abaikan jika skema audit log belum lengkap
    }

    const safeUser = {
      id: userRow.id,
      full_name: userRow.full_name,
      email: userRow.email,
      phone: userRow.phone,
      base_role: userRow.base_role,
      default_section: userRow.default_section ?? null,
      is_role_assigned: Boolean(userRow.is_role_assigned),
      is_superadmin: true,
      avatar_url: userRow.avatar_url,
      failed_pin_attempts: 0,
      locked_until: null,
      created_at: userRow.created_at,
    };

    const token = await signSessionToken({
      userId: safeUser.id,
      fullName: safeUser.full_name,
      baseRole: safeUser.base_role,
      isSuperadmin: true,
    });

    const response = NextResponse.json(
      { success: true, user: safeUser },
      { headers: NO_CACHE_HEADERS }
    );
    response.cookies.set(
      getSessionCookieOptions().name,
      token,
      getSessionCookieOptions()
    );
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
