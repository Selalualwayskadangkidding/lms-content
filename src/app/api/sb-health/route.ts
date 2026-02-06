import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      cache: "no-store",
    });

    const text = await r.text();
    return NextResponse.json({ status: r.status, text });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : JSON.stringify(e);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}