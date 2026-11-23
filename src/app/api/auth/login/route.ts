import { NextResponse } from "next/server";
import { PinLoginSchema } from "@/lib/validators/schemas";
import { createServerClient } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";
import { verifyPinHash } from "@/lib/auth/pin-hash";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import {
  signSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("demo.supabase.co") &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("demo-service-key")
  );

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan login. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = PinLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Input tidak valid",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { user_id, pin } = parsed.data;
    const accountLimit = checkRateLimit(`login:${ip}:${user_id}`, 6, 5 * 60 * 1000);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan PIN untuk akun ini. Coba lagi dalam ${accountLimit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      const { data: userRow, error: fetchError } = await supabase
        .from("users")
        .select(
          "id, full_name, email, phone, pin_hash, base_role, default_section, is_role_assigned, is_superadmin, avatar_url, failed_pin_attempts, locked_until, created_at"
        )
        .eq("id", user_id)
        .maybeSingle();

      if (fetchError) {
        return NextResponse.json(
          { success: false, error: "Gagal mengambil data pengguna" },
          { status: 500 }
        );
      }

      if (!userRow) {
        return NextResponse.json(
          { success: false, error: "Akun tidak ditemukan" },
          { status: 404 }
        );
      }

      if (userRow.locked_until && new Date(userRow.locked_until).getTime() > Date.now()) {
        return NextResponse.json(
          {
            success: false,
            error: "Akun terkunci sementara 15 menit karena 5x salah PIN.",
            is_locked: true,
          },
          { status: 423 }
        );
      }

      let isPinValid = false;

      if (userRow.pin_hash?.startsWith("scrypt$")) {
        isPinValid = verifyPinHash(pin, userRow.pin_hash);
      } else {
        const { data: rpcResult, error: rpcError } = await supabase.rpc("verify_user_pin", {
          p_user_id: user_id,
          p_pin: pin,
        });
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
          .eq("id", user_id);

        return NextResponse.json(
          {
            success: false,
            error: shouldLock
              ? "Akun terkunci 15 menit karena 5x salah PIN."
              : `PIN salah! Percobaan ${nextAttempts}/5.`,
            is_locked: shouldLock,
          },
          { status: shouldLock ? 423 : 401 }
        );
      }

      if ((userRow.failed_pin_attempts || 0) > 0 || userRow.locked_until) {
        await supabase
          .from("users")
          .update({
            failed_pin_attempts: 0,
            locked_until: null,
          })
          .eq("id", user_id);
      }

      const safeUser = {
        id: userRow.id,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        base_role: userRow.base_role,
        default_section: userRow.default_section ?? null,
        is_role_assigned: Boolean(userRow.is_role_assigned),
        is_superadmin: Boolean(userRow.is_superadmin),
        avatar_url: userRow.avatar_url,
        failed_pin_attempts: 0,
        locked_until: null,
        created_at: userRow.created_at,
      };

      const token = await signSessionToken({
        userId: safeUser.id,
        fullName: safeUser.full_name,
        baseRole: safeUser.base_role,
        isSuperadmin: safeUser.is_superadmin,
      });

      const response = NextResponse.json({
        success: true,
        user: safeUser,
      });
      response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
      return response;
    }

    const demoUser = INITIAL_USERS.find((u) => u.id === user_id);
    if (!demoUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pin !== "1234") {
      return NextResponse.json(
        { success: false, error: "PIN salah" },
        { status: 401 }
      );
    }

    const token = await signSessionToken({
      userId: demoUser.id,
      fullName: demoUser.full_name,
      baseRole: demoUser.base_role,
      isSuperadmin: demoUser.is_superadmin,
    });

    const response = NextResponse.json({
      success: true,
      user: demoUser,
    });
    response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
