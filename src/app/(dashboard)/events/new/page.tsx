import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { INITIAL_USERS } from "@/lib/mock-db";
import { CreateEventForm } from "@/features/events/create-event-form";
import type { User } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function NewEventPage() {
  noStore();
  let users: Pick<User, "id" | "full_name" | "base_role" | "is_superadmin">[] = [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("users")
        .select("id, full_name, base_role, is_superadmin")
        .eq("is_superadmin", false)
        .order("full_name", { ascending: true });
      users = (data ?? []) as Pick<User, "id" | "full_name" | "base_role" | "is_superadmin">[];
    } catch {
      users = [];
    }
  }

  if (users.length === 0) {
    users = INITIAL_USERS.filter((u) => !u.is_superadmin).map((u) => ({
      id: u.id,
      full_name: u.full_name,
      base_role: u.base_role,
      is_superadmin: u.is_superadmin,
    }));
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 animate-tab-enter">
      <CreateEventForm users={users} />
    </div>
  );
}
