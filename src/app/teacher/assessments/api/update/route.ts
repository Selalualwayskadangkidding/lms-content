import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";

type UpdatePayload = {
  id: string;
  title?: string | null;
  description?: string | null;
  subject_name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  is_published?: boolean;
  password?: string | null;
  clear_password?: boolean;
};

export async function POST(req: Request) {
  const body = (await req.json()) as UpdatePayload;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!body.id) return new NextResponse("Missing id", { status: 400 });

  const { data: owned, error: ownedErr } = await supabase
    .from("assessments")
    .select("id")
    .eq("id", body.id)
    .eq("owner_id", user.id)
    .single();

  if (ownedErr || !owned) return new NextResponse("Not found", { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title?.trim() ?? "";
  if (body.description !== undefined) updateData.description = body.description ?? null;
  if (body.subject_name !== undefined) {
    const subjectName = body.subject_name?.trim();
    if (!subjectName) {
      updateData.subject_id = null;
    } else {
      const { data: found } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", subjectName)
        .maybeSingle();
      if (found?.id) {
        updateData.subject_id = found.id;
      } else {
        const { data: created, error: sErr } = await supabase
          .from("subjects")
          .insert({ name: subjectName })
          .select("id")
          .single();
        if (sErr) return new NextResponse(sErr.message, { status: 400 });
        updateData.subject_id = created.id;
      }
    }
  }
  if (body.start_at !== undefined) updateData.start_at = body.start_at ?? null;
  if (body.end_at !== undefined) updateData.end_at = body.end_at ?? null;
  if (body.duration_minutes !== undefined)
    updateData.duration_minutes = body.duration_minutes ?? null;
  if (body.is_published !== undefined) updateData.is_published = body.is_published;

  if (body.clear_password) {
    updateData.access_password_hash = null;
  } else if (body.password !== undefined) {
    const password = body.password?.trim();
    updateData.access_password_hash = password ? hashPassword(password) : null;
  }

  const { error } = await supabase
    .from("assessments")
    .update(updateData)
    .eq("id", body.id)
    .eq("owner_id", user.id);

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
