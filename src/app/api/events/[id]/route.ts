import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { INITIAL_EVENTS } from "@/lib/mock-db";
import {
  executeSupabaseEventDeletion,
  validateEventDeletionStatus,
} from "@/lib/events/delete-event";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const DeleteEventBodySchema = z.object({
  reason: z.string().trim().max(1000, "Alasan maksimal 1000 karakter").optional(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  noStore();

  try {
    const { id } = await params;

    let reason: string | undefined;
    try {
      const rawText = await request.text();
      if (rawText.trim()) {
        const parsed = DeleteEventBodySchema.safeParse(JSON.parse(rawText));
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: parsed.error.errors[0]?.message ?? "Payload alasan tidak valid.",
            },
            { status: 400, headers: NO_CACHE_HEADERS }
          );
        }
        reason = parsed.data.reason;
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Format JSON request tidak valid." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!isSupabaseConfigured()) {
      const session = await getServerSession();
      if (!session) {
        return NextResponse.json(
          { success: false, error: "Sesi login tidak ditemukan." },
          { status: 401, headers: NO_CACHE_HEADERS }
        );
      }
      if (session.baseRole !== "CREATIVE_LEADER" && !session.isSuperadmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Hanya Creative Leader atau Superadmin yang berhak menghapus event.",
          },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }

      const demoTarget = INITIAL_EVENTS.find((ev) => ev.id === id);
      if (demoTarget) {
        const validation = validateEventDeletionStatus(demoTarget.status, reason);
        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: validation.error },
            { status: validation.status, headers: NO_CACHE_HEADERS }
          );
        }
      }

      revalidatePath("/events");
      revalidatePath("/");
      return NextResponse.json(
        {
          success: true,
          deletedEvent: demoTarget
            ? { id: demoTarget.id, title: demoTarget.title, status: demoTarget.status }
            : { id, title: "Demo Event", status: "DRAFT" },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const result = await executeSupabaseEventDeletion(id, reason);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status, headers: NO_CACHE_HEADERS }
      );
    }

    revalidatePath("/events");
    revalidatePath("/");

    return NextResponse.json(
      {
        success: true,
        deletedEvent: result.deletedEvent,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal menghapus event.",
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
