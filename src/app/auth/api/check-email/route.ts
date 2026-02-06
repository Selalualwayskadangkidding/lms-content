import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Payload = {
  email?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = body.email?.trim().toLowerCase();
  if (!email) return new NextResponse("Email wajib diisi", { status: 400 });

  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  let page = 1;
  const perPage = 200;
  let exists = false;

  while (page <= 50) {
    const resp = await fetch(`${baseUrl}?page=${page}&per_page=${perPage}`, {
      headers,
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new NextResponse(text, { status: 400 });
    }

    const data = await resp.json();
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    if (users.some((u: any) => (u.email ?? "").toLowerCase() === email)) {
      exists = true;
      break;
    }
    if (!users.length) break;
    page += 1;
  }

  return NextResponse.json({ exists });
}
