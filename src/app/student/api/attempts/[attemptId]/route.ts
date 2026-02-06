import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/app/auth/getRole";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId: attemptIdParam } = await params;
  const supabase = await createClient();
  const { user, role } = await getUserRole();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (role !== "STUDENT") return new NextResponse("Forbidden", { status: 403 });

  let attemptId = attemptIdParam;
  if (!attemptId) {
    const url = new URL(_req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("attempts");
    if (idx >= 0 && parts[idx + 1]) {
      attemptId = parts[idx + 1];
    }
  }
  if (!attemptId) return new NextResponse("Missing attemptId", { status: 400 });

  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .select("id,assessment_id,student_id,status,started_at,expires_at")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single();

  if (aErr || !attempt) return new NextResponse("Attempt not found", { status: 404 });

  const { data: assessment, error: asErr } = await supabase
    .from("assessments")
    .select("id,title,end_at")
    .eq("id", attempt.assessment_id)
    .single();
  if (asErr || !assessment) return new NextResponse("Assessment not found", { status: 404 });

  const now = Date.now();
  const expiresAt = attempt.expires_at ? new Date(attempt.expires_at).getTime() : null;
  const endAt = assessment.end_at ? new Date(assessment.end_at).getTime() : null;
  const isExpired =
    (expiresAt !== null && now > expiresAt) || (endAt !== null && now > endAt);

  if (attempt.status === "IN_PROGRESS" && isExpired) {
    await supabase.from("attempts").update({ status: "TIMED_OUT" }).eq("id", attempt.id);
    attempt.status = "TIMED_OUT";
  }

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id,prompt,position,options(id,text,position)")
    .eq("assessment_id", attempt.assessment_id)
    .order("position", { ascending: true });

  if (qErr) return new NextResponse(qErr.message, { status: 400 });

  const { data: responses, error: rErr } = await supabase
    .from("responses")
    .select("question_id,selected_option_id")
    .eq("attempt_id", attempt.id);

  if (rErr) return new NextResponse(rErr.message, { status: 400 });

  return NextResponse.json({
    attempt,
    assessment,
    questions: questions ?? [],
    responses: responses ?? [],
  });
}
