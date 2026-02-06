import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  email?: string;
  password?: string;
  role?: "TEACHER" | "STUDENT";
  display_name?: string;
};

// DEV ONLY: create user without email confirmation. Remove in production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not Found", { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  const role = body.role;
  const displayName = body.display_name?.trim();

  if (!email || !password || (role !== "TEACHER" && role !== "STUDENT")) {
    return NextResponse.json({ error: "email, password, role wajib diisi" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: displayName ? { display_name: displayName } : undefined,
    email_confirm: true,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Gagal create user" }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name: displayName || email,
    role,
    is_active: true,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
