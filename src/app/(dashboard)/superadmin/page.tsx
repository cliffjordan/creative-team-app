import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { SuperadminMaintenanceView } from "@/features/superadmin/superadmin-maintenance-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperadminPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?redirect=/superadmin");
  }
  if (!session.isSuperadmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 animate-tab-enter">
      <SuperadminMaintenanceView />
    </div>
  );
}
