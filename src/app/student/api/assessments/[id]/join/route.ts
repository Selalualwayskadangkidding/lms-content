import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/app/auth/getRole";
import { verifyPassword } from "@/lib/password";

type JoinPayload = {
  password?: string;
};

export async function POST(
  req: Request,
  { params }: { params: { id?: string; Id?: string } }
) {
  const body = (await req.json().catch(() => ({}))) as JoinPayload;
  const supabase = await createClient();
  const { user, role } = await getUserRole();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (role !== "STUDENT") return new NextResponse("Forbidden", { status: 403 });

  let assessmentId = params.id ?? params.Id;
  if (!assessmentId) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("assessments");
    if (idx >= 0 && parts[idx + 1]) {
      assessmentId = parts[idx + 1];
    }
  }
  if (!assessmentId) return new NextResponse("Missing id", { status: 400 });

  const { data: assessment, error: aErr } = await supabase
    .from("assessments")
    .select("id,is_published,start_at,end_at,duration_minutes,access_password_hash")
    .eq("id", assessmentId)
    .single();

  if (aErr || !assessment) return new NextResponse("Assessment not found", { status: 404 });
  if (!assessment.is_published) {
    return new NextResponse("Assessment not published", { status: 400 });
  }

  const now = Date.now();
  if (assessment.start_at && now < new Date(assessment.start_at).getTime()) {
    return new NextResponse("Assessment belum dimulai", { status: 400 });
  }
  if (assessment.end_at && now > new Date(assessment.end_at).getTime()) {
    return new NextResponse("Assessment sudah berakhir", { status: 400 });
  }

  if (assessment.access_password_hash) {
    const pass = body.password?.trim();
    if (!pass) return new NextResponse("Password wajib diisi", { status: 400 });
    const ok = verifyPassword(pass, assessment.access_password_hash);
    if (!ok) return new NextResponse("Password salah", { status: 400 });
  }

  const { data: existing } = await supabase
    .from("attempts")
    .select("id,expires_at,status")
    .eq("assessment_id", assessmentId)
    .eq("student_id", user.id)
    .eq("status", "IN_PROGRESS")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const expiresAt = existing.expires_at ? new Date(existing.expires_at).getTime() : null;
    if (!expiresAt || expiresAt > now) {
      return NextResponse.json({ attemptId: existing.id, status: existing.status });
    }
  }

  const startedAt = new Date(now);
  let expiresAt: Date | null = null;
  if (assessment.duration_minutes && assessment.duration_minutes > 0) {
    expiresAt = new Date(now + assessment.duration_minutes * 60 * 1000);
  }
  if (assessment.end_at) {
    const endAt = new Date(assessment.end_at);
    if (!expiresAt || endAt.getTime() < expiresAt.getTime()) {
      expiresAt = endAt;
    }
  }

  const { data: created, error: cErr } = await supabase
    .from("attempts")
    .insert({
      assessment_id: assessmentId,
      student_id: user.id,
      status: "IN_PROGRESS",
      started_at: startedAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .select("id,status")
    .single();

  if (cErr || !created) return new NextResponse(cErr?.message ?? "Gagal buat attempt", { status: 400 });

  return NextResponse.json({ attemptId: created.id, status: created.status });
}
