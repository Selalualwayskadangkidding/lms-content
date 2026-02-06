import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  email?: string;
  password?: string;
};

let envLogged = false;

function withTimeout<T>(promise: Promise<T>, ms = 10000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout"));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  if (!envLogged) {
    envLogged = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    console.info("[auth/login] SUPABASE_URL:", url);
    console.info("[auth/login] ANON_KEY prefix:", anon.slice(0, 16));
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
  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
  }

  let authData: { data: { user: { id: string } | null }; error: { message: string } | null };
  try {
    authData = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      10000
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Auth request failed";
    if (message.toLowerCase().includes("timeout")) {
      return NextResponse.json(
        { error: "Auth timeout. Supabase sedang throttling / koneksi bermasalah." },
        { status: 503 }
      );
    }
    if (message.includes("Unexpected token")) {
      console.error("[auth/login] Non-JSON response from Supabase:", message);
      return NextResponse.json(
        { error: "Non-JSON response from Supabase (gateway/proxy error)." },
        { status: 502 }
      );
    }
    console.error("[auth/login] Auth error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data, error } = authData;
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Login gagal." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    const admin = createAdminClient();
    const { data: adminUser } = await admin.auth.admin.getUserById(data.user.id);
    const displayName =
      adminUser?.user?.user_metadata?.display_name ??
      adminUser?.user?.user_metadata?.name ??
      (adminUser?.user?.email ? adminUser.user.email.split("@")[0] : null) ??
      null;

    const { error: insertError } = await admin.from("profiles").insert({
      id: data.user.id,
      role: "STUDENT",
      is_active: true,
      name: displayName,
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      userId: data.user.id,
      role: "STUDENT",
      is_active: true,
    });
  }

  return NextResponse.json({
    userId: data.user.id,
    role: profile.role,
    is_active: profile.is_active,
  });
}
