import { NextResponse } from "next/server";
import { PinLoginSchema } from "@/lib/validators/schemas";
import { createServerClient } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";
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

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      const { data, error } = await supabase.rpc("verify_user_pin", {
        p_user_id: user_id,
        p_pin: pin,
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: "Gagal memverifikasi PIN" },
          { status: 500 }
        );
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) {
        const status = result?.is_locked ? 423 : 401;
        return NextResponse.json(
          {
            success: false,
            error: result?.message || "PIN salah",
            is_locked: Boolean(result?.is_locked),
          },
          { status }
        );
      }

      const token = await signSessionToken({
        userId: result.user_id,
        fullName: result.full_name,
        baseRole: result.base_role,
        isSuperadmin: Boolean(result.is_superadmin),
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: result.user_id,
          full_name: result.full_name,
          base_role: result.base_role,
          is_superadmin: Boolean(result.is_superadmin),
        },
      });
      response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
      return response;
    }

    // Demo mode fallback (when Supabase is not configured)
    const demoUser = INITIAL_USERS.find((u) => u.id === user_id);
    if (!demoUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pin !== "1234") {
      return NextResponse.json(
        { success: false, error: "PIN salah (Demo PIN: 1234)" },
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
