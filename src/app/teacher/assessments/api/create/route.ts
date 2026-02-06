import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";

type CreatePayload = {
  title: string;
  description?: string | null;
  subject_name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  password?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CreatePayload;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!body.title || !body.title.trim()) {
    return new NextResponse("Title is required", { status: 400 });
  }

  const password = body.password?.trim();
  const access_password_hash = password ? hashPassword(password) : null;

  let subject_id: string | null = null;
  const subjectName = body.subject_name?.trim();
  if (subjectName) {
    const { data: found } = await supabase
      .from("subjects")
      .select("id")
      .eq("name", subjectName)
      .maybeSingle();
    if (found?.id) {
      subject_id = found.id;
    } else {
      const { data: created, error: sErr } = await supabase
        .from("subjects")
        .insert({ name: subjectName })
        .select("id")
        .single();
      if (sErr) return new NextResponse(sErr.message, { status: 400 });
      subject_id = created.id;
    }
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      title: body.title.trim(),
      description: body.description ?? null,
      subject_id,
      start_at: body.start_at ?? null,
      end_at: body.end_at ?? null,
      duration_minutes: body.duration_minutes ?? null,
      owner_id: user.id,
      access_password_hash,
      is_published: false,
    })
    .select("id")
    .single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ id: data.id });
}
