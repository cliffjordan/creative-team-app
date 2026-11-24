import { createServerClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/auth/pin-hash";

export async function ensureTechnicalSuperadmin(
  supabase: ReturnType<typeof createServerClient>
) {
  const { data: existingSuper } = await supabase
    .from("users")
    .select("id")
    .eq("is_superadmin", true)
    .limit(1)
    .maybeSingle();

  if (existingSuper) return;

  const defaultPin = process.env.SUPERADMIN_DEFAULT_PIN || "9999";
  await supabase.from("users").insert({
    full_name: "System Superadmin",
    email: "superadmin@creativehub.local",
    phone: "+6280000000000",
    pin_hash: hashPin(defaultPin),
    is_superadmin: true,
    base_role: "MEMBER",
    default_section: null,
    is_role_assigned: true,
    failed_pin_attempts: 0,
  });
}
