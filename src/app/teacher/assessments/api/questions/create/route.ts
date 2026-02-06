import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateQuestionPayload = {
  assessment_id: string;
  prompt: string;
  points?: number | null;
  options: { text: string; position?: number | null }[];
  correct_index: number;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CreateQuestionPayload;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!body.assessment_id) return new NextResponse("Missing assessment_id", { status: 400 });
  if (!body.prompt?.trim()) return new NextResponse("Prompt required", { status: 400 });
  if (!body.options || body.options.length < 2) {
    return new NextResponse("Options required", { status: 400 });
  }

  const { data: owned, error: ownedErr } = await supabase
    .from("assessments")
    .select("id")
    .eq("id", body.assessment_id)
    .eq("owner_id", user.id)
    .single();

  if (ownedErr || !owned) return new NextResponse("Not found", { status: 404 });

  const { data: lastPosRow } = await supabase
    .from("questions")
    .select("position")
    .eq("assessment_id", body.assessment_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (lastPosRow?.position ?? 0) + 1;

  const { data: q, error: qErr } = await supabase
    .from("questions")
    .insert({
      assessment_id: body.assessment_id,
      prompt: body.prompt.trim(),
      points: body.points ?? 1,
      position: nextPosition,
    })
    .select("id")
    .single();

  if (qErr) return new NextResponse(qErr.message, { status: 400 });

  const optionsPayload = body.options.map((o, idx) => ({
    question_id: q.id,
    text: o.text.trim(),
    position: o.position ?? idx + 1,
  }));

  const { data: insertedOpts, error: optErr } = await supabase
    .from("options")
    .insert(optionsPayload)
    .select("id,position");

  if (optErr) return new NextResponse(optErr.message, { status: 400 });

  const correctPosition = (body.correct_index ?? 0) + 1;
  const correct = insertedOpts?.find((o) => o.position === correctPosition);
  if (!correct) return new NextResponse("Correct option not found", { status: 400 });

  const { error: keyErr } = await supabase
    .from("answer_keys")
    .insert({ question_id: q.id, correct_option_id: correct.id });

  if (keyErr) return new NextResponse(keyErr.message, { status: 400 });
  return NextResponse.json({ id: q.id });
}
