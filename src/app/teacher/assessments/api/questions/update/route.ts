import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UpdateQuestionPayload = {
  assessment_id: string;
  question_id: string;
  prompt: string;
  points?: number | null;
  position?: number | null;
  options: { text: string; position?: number | null }[];
  correct_option_id: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as UpdateQuestionPayload;
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

  const { error: qErr } = await supabase
    .from("questions")
    .update({
      prompt: body.prompt.trim(),
      points: body.points ?? 1,
      position: body.position ?? 1,
    })
    .eq("id", body.question_id)
    .eq("assessment_id", body.assessment_id);

  if (qErr) return new NextResponse(qErr.message, { status: 400 });

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

  const optionsPayload = body.options.map((o, idx) => ({
    question_id: body.question_id,
    text: o.text.trim(),
    position: o.position ?? idx + 1,
  }));

  const { data: insertedOpts, error: optErr } = await supabase
    .from("options")
    .insert(optionsPayload)
    .select("id,position");

  if (optErr) return new NextResponse(optErr.message, { status: 400 });

  let correct = insertedOpts?.find((o) => o.id === body.correct_option_id);
  if (!correct && body.correct_option_id) {
    // allow mapping by previous option id (when client sends old ids)
    const pos = body.options.findIndex((o: any) => o.id === body.correct_option_id);
    if (pos >= 0) {
      correct = insertedOpts?.find((o) => o.position === pos + 1);
    }
  }
  if (!correct) return new NextResponse("Correct option not found", { status: 400 });

  const { error: keyErr } = await supabase
    .from("answer_keys")
    .insert({ question_id: body.question_id, correct_option_id: correct.id });

  if (keyErr) return new NextResponse(keyErr.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
