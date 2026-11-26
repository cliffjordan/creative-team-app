import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { SuperadminMaintenanceView } from "@/features/superadmin/superadmin-maintenance-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperadminPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/superadmin/login");
  }
  if (!session.isSuperadmin) {
    redirect("/");
  }

  if (isSupabaseConfigured()) {
    const supabase = createServerClient();
    const { data: actor } = await supabase
      .from("users")
      .select("id, is_superadmin")
      .eq("id", session.userId)
      .maybeSingle();

    if (!actor?.is_superadmin) {
      redirect("/superadmin/login");
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 animate-tab-enter">
      <SuperadminMaintenanceView />
    </div>
  );
}
