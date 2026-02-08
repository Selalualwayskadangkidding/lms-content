import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/reset-password";

  console.log("[callback] hit", { code: !!code, next });

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=no_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  console.log("[callback] exchange result", { error });

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=recovery_failed&msg=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && (!profile.name || profile.name.trim() === "")) {
      try {
        const admin = createAdminClient();
        const { data: adminUser } = await admin.auth.admin.getUserById(user.id);
        const displayName =
          adminUser?.user?.user_metadata?.display_name ??
          adminUser?.user?.user_metadata?.name ??
          (adminUser?.user?.email ? adminUser.user.email.split("@")[0] : null);
        if (displayName) {
          await admin.from("profiles").update({ name: displayName }).eq("id", user.id);
        }
      } catch {
        // ignore if service role not configured
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
