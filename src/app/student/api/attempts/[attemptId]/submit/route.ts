import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/app/auth/getRole";

export async function POST(
  req: Request,
  { params }: { params: { attemptId: string } }
) {
  const supabase = await createClient();
  const { user, role } = await getUserRole();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (role !== "STUDENT") return new NextResponse("Forbidden", { status: 403 });

  let attemptId = params.attemptId;
  if (!attemptId) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("attempts");
    if (idx >= 0 && parts[idx + 1]) {
      attemptId = parts[idx + 1];
    }
  }
  if (!attemptId) return new NextResponse("Missing attemptId", { status: 400 });

  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .select("id,assessment_id,student_id,status,expires_at")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single();

  if (aErr || !attempt) return new NextResponse("Attempt not found", { status: 404 });
  if (attempt.status !== "IN_PROGRESS") {
    return new NextResponse("Attempt not in progress", { status: 400 });
  }

  const { data: assessment, error: asErr } = await supabase
    .from("assessments")
    .select("id,end_at")
    .eq("id", attempt.assessment_id)
    .single();

  if (asErr || !assessment) return new NextResponse("Assessment not found", { status: 404 });

  const now = Date.now();
  const expiresAt = attempt.expires_at ? new Date(attempt.expires_at).getTime() : null;
  const endAt = assessment.end_at ? new Date(assessment.end_at).getTime() : null;
  const isExpired =
    (expiresAt !== null && now > expiresAt) || (endAt !== null && now > endAt);

  if (isExpired) {
    await supabase.from("attempts").update({ status: "TIMED_OUT" }).eq("id", attempt.id);
    return new NextResponse("Waktu habis", { status: 400 });
  }

  const { data: scoreRows, error: sErr } = await supabase.rpc("score_attempt", {
    p_attempt_id: attempt.id,
  });
  if (sErr) return new NextResponse(sErr.message, { status: 400 });

  const scoreRow = Array.isArray(scoreRows) ? scoreRows[0] : scoreRows;
  const correct = Number(scoreRow?.correct ?? 0);
  const wrong = Number(scoreRow?.wrong ?? 0);
  const blank = Number(scoreRow?.blank ?? 0);
  const total = Number(scoreRow?.total ?? 0);
  const score = Number(scoreRow?.score ?? correct);

  const { error: uErr } = await supabase
    .from("attempts")
    .update({
      status: "SUBMITTED",
      submitted_at: new Date(now).toISOString(),
      score,
    })
    .eq("id", attempt.id)
    .eq("student_id", user.id);

  if (uErr) return new NextResponse(uErr.message, { status: 400 });

  return NextResponse.json({ score, correct, wrong, blank, total });
}
