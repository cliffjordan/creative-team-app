import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { hashPin } from "@/lib/auth/pin-hash";
import { SectionTypeSchema, UserBaseRoleSchema } from "@/lib/validators/schemas";

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, is_superadmin, base_role, default_section, is_role_assigned, avatar_url, failed_pin_attempts, locked_until, created_at";

const UpdateMemberSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(25).optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  base_role: UserBaseRoleSchema.optional(),
  default_section: SectionTypeSchema.nullable().optional(),
  is_role_assigned: z.boolean().optional(),
  is_superadmin: z.boolean().optional(),
  new_pin: z
    .string()
    .length(4, "PIN harus 4 digit")
    .regex(/^\d{4}$/, "PIN harus berupa 4 digit angka")
    .optional(),
});

async function requireCreativeLeader() {
  const session = await getServerSession();
  if (!session) {
    return { allowed: false, status: 401, error: "Sesi tidak valid. Silakan login.", actorId: null };
  }
  if (!isSupabaseConfigured()) {
    const ok = session.baseRole === "CREATIVE_LEADER" || session.isSuperadmin;
    return ok
      ? { allowed: true, actorId: session.userId }
      : { allowed: false, status: 403, error: "Hanya Creative Leader yang berhak mengelola anggota.", actorId: null };
  }

  const supabase = createServerClient();
  const { data: actor } = await supabase
    .from("users")
    .select("base_role, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();

  if (!actor || (actor.base_role !== "CREATIVE_LEADER" && !actor.is_superadmin)) {
    return { allowed: false, status: 403, error: "Hanya Creative Leader yang berhak mengelola anggota.", actorId: null };
  }
  return { allowed: true, actorId: session.userId };
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireCreativeLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const targetUserId = context.params.id;
  try {
    const body = await request.json();
    const parsed = UpdateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data perubahan tidak valid" },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const updatePayload: Record<string, unknown> = {};
    if (p.full_name !== undefined) updatePayload.full_name = p.full_name.trim();
    if (p.phone !== undefined) updatePayload.phone = p.phone.trim();
    if (p.email !== undefined) {
      updatePayload.email = p.email && p.email.trim().length > 0 ? p.email.trim().toLowerCase() : null;
    }
    if (p.base_role !== undefined) {
      updatePayload.base_role = p.base_role;
      updatePayload.is_superadmin = p.is_superadmin ?? p.base_role === "CREATIVE_LEADER";
    } else if (p.is_superadmin !== undefined) {
      updatePayload.is_superadmin = p.is_superadmin;
    }
    if (p.default_section !== undefined) updatePayload.default_section = p.default_section;
    if (p.is_role_assigned !== undefined) updatePayload.is_role_assigned = p.is_role_assigned;
    if (p.new_pin) {
      updatePayload.pin_hash = hashPin(p.new_pin);
      updatePayload.failed_pin_attempts = 0;
      updatePayload.locked_until = null;
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, user: { id: targetUserId, ...updatePayload } });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select(USER_SELECT_COLUMNS)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal memperbarui data anggota" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireCreativeLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const targetUserId = context.params.id;
  if (auth.actorId === targetUserId) {
    return NextResponse.json(
      { success: false, error: "Anda tidak dapat menghapus akun Anda sendiri." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("users").delete().eq("id", targetUserId);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
