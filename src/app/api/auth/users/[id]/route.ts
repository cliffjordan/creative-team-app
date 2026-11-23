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

async function requireGovernanceActor() {
  const session = await getServerSession();
  if (!session) {
    return {
      allowed: false as const,
      status: 401,
      error: "Sesi tidak valid. Silakan login.",
      actorId: null,
      isSuperadmin: false,
      baseRole: null,
    };
  }
  if (!isSupabaseConfigured()) {
    const ok = session.baseRole === "CREATIVE_LEADER" || session.isSuperadmin;
    return ok
      ? {
          allowed: true as const,
          status: 200,
          error: "",
          actorId: session.userId,
          isSuperadmin: Boolean(session.isSuperadmin),
          baseRole: session.baseRole,
        }
      : {
          allowed: false as const,
          status: 403,
          error: "Hanya Creative Leader atau Superadmin yang berhak mengelola anggota.",
          actorId: null,
          isSuperadmin: false,
          baseRole: session.baseRole,
        };
  }

  const supabase = createServerClient();
  const { data: actor } = await supabase
    .from("users")
    .select("base_role, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();

  if (!actor || (actor.base_role !== "CREATIVE_LEADER" && !actor.is_superadmin)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Hanya Creative Leader atau Superadmin yang berhak mengelola anggota.",
      actorId: null,
      isSuperadmin: false,
      baseRole: actor?.base_role ?? null,
    };
  }

  return {
    allowed: true as const,
    status: 200,
    error: "",
    actorId: session.userId,
    isSuperadmin: Boolean(actor.is_superadmin),
    baseRole: actor.base_role,
  };
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireGovernanceActor();
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
      if (p.is_role_assigned === undefined) {
        updatePayload.is_role_assigned = true;
      }
    }
    if (p.is_superadmin !== undefined) {
      updatePayload.is_superadmin = p.is_superadmin;
    }
    if (p.default_section !== undefined) updatePayload.default_section = p.default_section;
    if (p.is_role_assigned !== undefined) updatePayload.is_role_assigned = p.is_role_assigned;
    if (p.new_pin) {
      updatePayload.pin_hash = hashPin(p.new_pin);
      updatePayload.failed_pin_attempts = 0;
      updatePayload.locked_until = null;
    }

    if ((p.base_role === "CREATIVE_LEADER" || p.is_superadmin !== undefined) && !auth.isSuperadmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya Superadmin yang berhak menunjuk atau mencabut hak Creative Leader dan Superadmin.",
        },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, user: { id: targetUserId, ...updatePayload } });
    }

    const supabase = createServerClient();
    const { data: currentTarget } = await supabase
      .from("users")
      .select("id, full_name, base_role, is_superadmin")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!currentTarget) {
      return NextResponse.json({ success: false, error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // Strict separation: non-superadmin CREATIVE_LEADER cannot alter/reset CREATIVE_LEADER or SUPERADMIN accounts
    if ((currentTarget.is_superadmin || currentTarget.base_role === "CREATIVE_LEADER") && !auth.isSuperadmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya Superadmin yang berhak mengubah akun atau mereset PIN Creative Leader dan Superadmin.",
        },
        { status: 403 }
      );
    }

    // Anti Last-Superadmin Lockout protection
    if (p.is_superadmin === false && currentTarget.is_superadmin) {
      const { count: superCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_superadmin", true);

      if ((superCount ?? 0) <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Tidak dapat mencabut status Superadmin terakhir. Tunjuk Superadmin lain terlebih dahulu.",
          },
          { status: 400 }
        );
      }
    }

    // Anti Last-Creative-Leader Lockout protection
    if (p.base_role !== undefined && p.base_role !== "CREATIVE_LEADER" && currentTarget.base_role === "CREATIVE_LEADER") {
      const { count: leaderCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("base_role", "CREATIVE_LEADER");

      if ((leaderCount ?? 0) <= 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Tidak dapat menurunkan jabatan Creative Leader terakhir. Tetapkan Creative Leader lain terlebih dahulu.",
          },
          { status: 400 }
        );
      }
    }

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

    try {
      const actionType = p.new_pin
        ? "USER_PIN_RESET"
        : p.is_superadmin !== undefined
        ? "USER_SUPERADMIN_UPDATED"
        : p.base_role !== undefined
        ? "USER_ROLE_UPDATED"
        : "USER_UPDATED";
      await supabase.from("operation_records").insert({
        operation_id: crypto.randomUUID(),
        event_id: null,
        action_type: actionType,
        actor_id: auth.actorId,
        details: {
          target_user_id: data.id,
          target_name: data.full_name,
          previous_role: currentTarget.base_role,
          new_role: data.base_role,
          previous_superadmin: Boolean(currentTarget.is_superadmin),
          new_superadmin: Boolean(data.is_superadmin),
          pin_reset: Boolean(p.new_pin),
        },
      });
    } catch {
      // Ignore audit log error before migration_v3 is applied
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
  const auth = await requireGovernanceActor();
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
  const { data: currentTarget } = await supabase
    .from("users")
    .select("id, full_name, base_role, is_superadmin")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!currentTarget) {
    return NextResponse.json({ success: false, error: "Akun tidak ditemukan." }, { status: 404 });
  }

  if ((currentTarget.is_superadmin || currentTarget.base_role === "CREATIVE_LEADER") && !auth.isSuperadmin) {
    return NextResponse.json(
      {
        success: false,
        error: "Hanya Superadmin yang berhak menghapus akun Creative Leader atau Superadmin.",
      },
      { status: 403 }
    );
  }

  if (currentTarget.is_superadmin) {
    const { count: superCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_superadmin", true);

    if ((superCount ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "Tidak dapat menghapus Superadmin terakhir." },
        { status: 400 }
      );
    }
  }

  if (currentTarget.base_role === "CREATIVE_LEADER") {
    const { count: leaderCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("base_role", "CREATIVE_LEADER");

    if ((leaderCount ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "Tidak dapat menghapus Creative Leader terakhir." },
        { status: 400 }
      );
    }
  }

  try {
    await supabase.from("operation_records").insert({
      operation_id: crypto.randomUUID(),
      event_id: null,
      action_type: "USER_DELETED",
      actor_id: auth.actorId,
      details: {
        target_user_id: currentTarget.id,
        target_name: currentTarget.full_name,
        target_role: currentTarget.base_role,
      },
    });
  } catch {
    // Ignore audit log error before migration_v3 is applied
  }

  const { error } = await supabase.from("users").delete().eq("id", targetUserId);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
