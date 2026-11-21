import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      full_name: session.fullName,
      base_role: session.baseRole,
      is_superadmin: session.isSuperadmin,
    },
  });
}
