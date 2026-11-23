import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { requireEventAccess } from "@/lib/auth/guards";
import { CreateBudgetItemSchema, UpdateBudgetItemSchema } from "@/lib/validators/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

async function requireTreasurerOrLeader() {
  const session = await getServerSession();
  if (!session) {
    return { allowed: false, status: 401, error: "Sesi tidak ditemukan. Silakan login kembali." };
  }
  if (!isSupabaseConfigured()) {
    const ok = session.baseRole === "BENDAHARA" || session.baseRole === "CREATIVE_LEADER" || session.isSuperadmin;
    return ok ? { allowed: true } : { allowed: false, status: 403, error: "Hanya Bendahara yang dapat mengubah data pembiayaan." };
  }
  const supabase = createServerClient();
  const { data: actor } = await supabase
    .from("users")
    .select("base_role, is_superadmin")
    .eq("id", session.userId)
    .maybeSingle();
  if (!actor) {
    return { allowed: false, status: 401, error: "Akun tidak ditemukan." };
  }
  const allowed = actor.base_role === "BENDAHARA" || actor.base_role === "CREATIVE_LEADER" || Boolean(actor.is_superadmin);
  return allowed
    ? { allowed: true }
    : { allowed: false, status: 403, error: "Hanya Bendahara yang dapat mengelola pembiayaan event." };
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  noStore();
  const eventId = context.params.id;
  const access = await requireEventAccess(eventId);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error, items: [] },
      { status: access.status, headers: NO_CACHE_HEADERS }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, items: [] }, { headers: NO_CACHE_HEADERS });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("event_budget_ledger")
      .select("*")
      .eq("event_id", eventId)
      .order("required_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, items: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, items: data ?? [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memuat data pembiayaan", items: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireTreasurerOrLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = CreateBudgetItemSchema.safeParse({
      ...body,
      event_id: context.params.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data pembiayaan tidak valid" },
        { status: 400 }
      );
    }

    const p = parsed.data;
    const qty = Number(p.quantity);
    const unitPrice = Number(p.unit_price);
    const computedTotal = Math.round(qty * unitPrice * 100) / 100;
    const estimated =
      unitPrice > 0
        ? computedTotal
        : p.estimated_amount !== undefined
        ? Math.max(0, Number(p.estimated_amount))
        : 0;

    const payload = {
      event_id: context.params.id,
      section: p.section,
      budget_category: p.budget_category || p.section,
      item_name: p.item_name.trim(),
      required_date: p.required_date || null,
      quantity: qty,
      uom: p.uom || "Set",
      unit_price: unitPrice,
      estimated_amount: estimated,
      actual_amount: Math.max(0, Number(p.actual_amount) || 0),
      budget_status: p.budget_status || "Planning",
      receipt_photo_url: p.receipt_photo_url?.trim() || null,
      notes: p.notes?.trim() || null,
    };

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: true,
          item: { id: `b-${Date.now()}`, ...payload, created_at: new Date().toISOString() },
        },
        { status: 201 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("event_budget_ledger")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal menyimpan item pembiayaan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireTreasurerOrLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = UpdateBudgetItemSchema.safeParse({
      ...body,
      event_id: context.params.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Data pembaruan tidak valid" },
        { status: 400 }
      );
    }

    const { id, ...rest } = parsed.data;
    const qty = rest.quantity !== undefined ? Number(rest.quantity) : undefined;
    const unitPrice = rest.unit_price !== undefined ? Number(rest.unit_price) : undefined;

    if (!isSupabaseConfigured()) {
      const estimated =
        qty !== undefined && unitPrice !== undefined && unitPrice > 0
          ? Math.round(qty * unitPrice * 100) / 100
          : rest.estimated_amount;
      return NextResponse.json({
        success: true,
        item: {
          id,
          event_id: context.params.id,
          ...rest,
          ...(estimated !== undefined ? { estimated_amount: estimated } : {}),
        },
      });
    }

    const supabase = createServerClient();
    let computedEstimated = rest.estimated_amount;

    if (qty !== undefined || unitPrice !== undefined) {
      const { data: currentRow } = await supabase
        .from("event_budget_ledger")
        .select("quantity, unit_price")
        .eq("id", id)
        .eq("event_id", context.params.id)
        .maybeSingle();

      const effectiveQty = qty ?? Number(currentRow?.quantity ?? 1);
      const effectiveUnitPrice = unitPrice ?? Number(currentRow?.unit_price ?? 0);
      if (effectiveUnitPrice > 0) {
        computedEstimated = Math.round(effectiveQty * effectiveUnitPrice * 100) / 100;
      }
    }

    const updateFields: Record<string, unknown> = {
      ...(rest.section !== undefined ? { section: rest.section } : {}),
      ...(rest.budget_category !== undefined ? { budget_category: rest.budget_category } : {}),
      ...(rest.item_name !== undefined ? { item_name: rest.item_name.trim() } : {}),
      ...(rest.required_date !== undefined ? { required_date: rest.required_date || null } : {}),
      ...(qty !== undefined ? { quantity: qty } : {}),
      ...(rest.uom !== undefined ? { uom: rest.uom } : {}),
      ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
      ...(computedEstimated !== undefined ? { estimated_amount: Math.max(0, computedEstimated) } : {}),
      ...(rest.actual_amount !== undefined ? { actual_amount: Math.max(0, rest.actual_amount) } : {}),
      ...(rest.budget_status !== undefined ? { budget_status: rest.budget_status } : {}),
      ...(rest.receipt_photo_url !== undefined ? { receipt_photo_url: rest.receipt_photo_url?.trim() || null } : {}),
      ...(rest.notes !== undefined ? { notes: rest.notes?.trim() || null } : {}),
    };

    const { data, error } = await supabase
      .from("event_budget_ledger")
      .update(updateFields)
      .eq("id", id)
      .eq("event_id", context.params.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Gagal memperbarui item pembiayaan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireTreasurerOrLeader();
  if (!auth.allowed) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("itemId");
    if (!id) {
      return NextResponse.json({ success: false, error: "Parameter itemId wajib diisi" }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("event_budget_ledger")
      .delete()
      .eq("id", id)
      .eq("event_id", context.params.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Kesalahan server" },
      { status: 500 }
    );
  }
}
