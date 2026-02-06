import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/app/auth/getRole";

type ResponsePayload = {
  question_id: string;
  selected_option_id: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId: attemptIdParam } = await params;
  const body = (await req.json()) as ResponsePayload;
  const supabase = await createClient();
  const { user, role } = await getUserRole();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (role !== "STUDENT") return new NextResponse("Forbidden", { status: 403 });

  let attemptId = attemptIdParam;
  if (!attemptId) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("attempts");
    if (idx >= 0 && parts[idx + 1]) {
      attemptId = parts[idx + 1];
    }
  }
  if (!attemptId) return new NextResponse("Missing attemptId", { status: 400 });
  if (!body.question_id || !body.selected_option_id) {
    return new NextResponse("Missing fields", { status: 400 });
  }

  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .select("id,assessment_id,student_id,status,expires_at")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single();

  if (aErr || !attempt) return new NextResponse("Attempt not found", { status: 404 });

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

  if (attempt.status !== "IN_PROGRESS" || isExpired) {
    if (attempt.status === "IN_PROGRESS" && isExpired) {
      await supabase.from("attempts").update({ status: "TIMED_OUT" }).eq("id", attempt.id);
    }
    return new NextResponse("Waktu habis", { status: 400 });
  }

  const { error: upErr } = await supabase
    .from("responses")
    .upsert(
      {
        attempt_id: attempt.id,
        question_id: body.question_id,
        selected_option_id: body.selected_option_id,
      },
      { onConflict: "attempt_id,question_id" }
    );

  if (upErr) return new NextResponse(upErr.message, { status: 400 });

  return NextResponse.json({ ok: true });
}
