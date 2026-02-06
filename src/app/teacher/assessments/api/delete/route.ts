import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DeletePayload = {
  id: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as DeletePayload;
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

  const { data: qRows } = await supabase
    .from("questions")
    .select("id")
    .eq("assessment_id", body.id);
  const questionIds = (qRows ?? []).map((q) => q.id);

  if (questionIds.length > 0) {
    const { error: delKeysErr } = await supabase
      .from("answer_keys")
      .delete()
      .in("question_id", questionIds);
    if (delKeysErr) return new NextResponse(delKeysErr.message, { status: 400 });

    const { error: delOptErr } = await supabase
      .from("options")
      .delete()
      .in("question_id", questionIds);
    if (delOptErr) return new NextResponse(delOptErr.message, { status: 400 });
  }

  const { error: delQuestionsErr } = await supabase
    .from("questions")
    .delete()
    .eq("assessment_id", body.id);
  if (delQuestionsErr) return new NextResponse(delQuestionsErr.message, { status: 400 });

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("id")
    .eq("assessment_id", body.id);
  const attemptIds = (attemptRows ?? []).map((a) => a.id);

  if (attemptIds.length > 0) {
    const { error: delRespErr } = await supabase
      .from("responses")
      .delete()
      .in("attempt_id", attemptIds);
    if (delRespErr) return new NextResponse(delRespErr.message, { status: 400 });
  }

  const { error: delAttemptsErr } = await supabase
    .from("attempts")
    .delete()
    .eq("assessment_id", body.id);
  if (delAttemptsErr) return new NextResponse(delAttemptsErr.message, { status: 400 });

  const { error: delAssessErr } = await supabase
    .from("assessments")
    .delete()
    .eq("id", body.id)
    .eq("owner_id", user.id);
  if (delAssessErr) return new NextResponse(delAssessErr.message, { status: 400 });

  return NextResponse.json({ ok: true });
}
