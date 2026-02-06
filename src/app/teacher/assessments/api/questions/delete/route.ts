import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DeleteQuestionPayload = {
  assessment_id: string;
  question_id: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as DeleteQuestionPayload;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!body.assessment_id || !body.question_id) {
    return new NextResponse("Missing ids", { status: 400 });
  }

  const { data: owned, error: ownedErr } = await supabase
    .from("assessments")
    .select("id")
    .eq("id", body.assessment_id)
    .eq("owner_id", user.id)
    .single();

  if (ownedErr || !owned) return new NextResponse("Not found", { status: 404 });

  const { error: delKeyErr } = await supabase
    .from("answer_keys")
    .delete()
    .eq("question_id", body.question_id);
  if (delKeyErr) return new NextResponse(delKeyErr.message, { status: 400 });

  const { error: delOptErr } = await supabase
    .from("options")
    .delete()
    .eq("question_id", body.question_id);
  if (delOptErr) return new NextResponse(delOptErr.message, { status: 400 });

  const { error: delQuestionErr } = await supabase
    .from("questions")
    .delete()
    .eq("id", body.question_id)
    .eq("assessment_id", body.assessment_id);
  if (delQuestionErr) return new NextResponse(delQuestionErr.message, { status: 400 });

  return NextResponse.json({ ok: true });
}
