import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserRole() {
  const supabase = await createClient(); // karena di project kamu createClient async
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  if (!user) return { user: null, role: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Dev safety: auto-provision missing profile so student flows work.
    const admin = createAdminClient();
    const nameFromMeta =
      (user.user_metadata?.display_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      (user.email ? user.email.split("@")[0] : null) ||
      "Student";

    const { error: insertErr } = await admin.from("profiles").insert({
      id: user.id,
      role: "STUDENT",
      is_active: true,
      name: nameFromMeta,
    });

    if (!insertErr) return { user, role: "STUDENT" as const };

    // If insert failed (race/duplicate), try to read again.
    const { data: retryProfile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .single();

    if (!retryProfile) return { user, role: null };
    if (!retryProfile.is_active) return { user, role: "INACTIVE" as const };
    return { user, role: retryProfile.role as "TEACHER" | "STUDENT" };
  }

  if (!profile.is_active) return { user, role: "INACTIVE" as const };

  return { user, role: profile.role as "TEACHER" | "STUDENT" };
}
