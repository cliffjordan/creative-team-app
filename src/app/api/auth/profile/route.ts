import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getServerSession,
  signSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import { hashPin, verifyPinHash } from "@/lib/auth/pin-hash";

const UpdateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Nama lengkap minimal 2 karakter").max(120),
  phone: z.string().trim().min(8, "Nomor WhatsApp minimal 8 digit").max(25),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  avatar_url: z.string().trim().max(1000).nullable().optional(),
  current_pin: z.string().optional(),
  new_pin: z.string().optional(),
});

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data profil tidak valid" },
        { status: 400 }
      );
    }

    const { full_name, phone, email, avatar_url, current_pin, new_pin } = parsed.data;
    const normalizedEmail = email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
    const wantsPinChange = Boolean(new_pin && new_pin.length > 0);

    if (wantsPinChange && !/^\d{4}$/.test(new_pin!)) {
      return NextResponse.json(
        { success: false, error: "PIN baru harus berupa 4 digit angka." },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      const updatedOffline = {
        id: session.userId,
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: normalizedEmail,
        avatar_url: avatar_url || null,
        base_role: session.baseRole,
        is_superadmin: session.isSuperadmin,
        failed_pin_attempts: 0,
        created_at: new Date().toISOString(),
      };
      const token = await signSessionToken({
        userId: updatedOffline.id,
        fullName: updatedOffline.full_name,
        baseRole: updatedOffline.base_role,
        isSuperadmin: updatedOffline.is_superadmin,
      });
      const res = NextResponse.json({ success: true, user: updatedOffline });
      res.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
      return res;
    }

    const supabase = createServerClient();
    const { data: existingUser, error: fetchErr } = await supabase
      .from("users")
      .select("id, pin_hash, base_role, is_superadmin")
      .eq("id", session.userId)
      .maybeSingle();

    if (fetchErr || !existingUser) {
      return NextResponse.json({ success: false, error: "Akun tidak ditemukan." }, { status: 404 });
    }

    if (normalizedEmail) {
      const { data: dupEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .neq("id", session.userId)
        .maybeSingle();
      if (dupEmail) {
        return NextResponse.json(
          { success: false, error: "Email tersebut sudah digunakan anggota lain." },
          { status: 409 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      avatar_url: avatar_url?.trim() || null,
    };

    if (wantsPinChange) {
      if (!current_pin || !/^\d{4}$/.test(current_pin)) {
        return NextResponse.json(
          { success: false, error: "Masukkan PIN saat ini (4 digit) untuk mengubah PIN." },
          { status: 400 }
        );
      }

      const storedHash = String(existingUser.pin_hash || "");
      let pinOk = false;
      if (storedHash.startsWith("scrypt$")) {
        pinOk = verifyPinHash(current_pin, storedHash);
      } else {
        const { data: rpcResult } = await supabase.rpc("verify_user_pin", {
          p_user_id: session.userId,
          p_pin: current_pin,
        });
        pinOk = rpcResult === true || Boolean(rpcResult?.success);
      }

      if (!pinOk) {
        return NextResponse.json(
          { success: false, error: "PIN saat ini salah. Gagal mengubah PIN." },
          { status: 401 }
        );
      }

      updatePayload.pin_hash = hashPin(new_pin!);
    }

    const { data: updatedUser, error: updateErr } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", session.userId)
      .select(USER_SELECT_COLUMNS)
      .single();

    if (updateErr || !updatedUser) {
      return NextResponse.json(
        { success: false, error: updateErr?.message || "Gagal memperbarui profil" },
        { status: 500 }
      );
    }

    const token = await signSessionToken({
      userId: updatedUser.id,
      fullName: updatedUser.full_name,
      baseRole: updatedUser.base_role,
      isSuperadmin: Boolean(updatedUser.is_superadmin),
    });

    const response = NextResponse.json({ success: true, user: updatedUser });
    response.cookies.set(getSessionCookieOptions().name, token, getSessionCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
