"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AssessmentRow = {
  id: string;
  title: string;
};

type AttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  status: string | null;
  score: number | null;
  submitted_at: string | null;
  updated_at: string | null;
};

type FeedbackRow = {
  id: string;
  message: string;
  updated_at: string | null;
};

type QuestionRow = {
  id: string;
  prompt: string;
  position: number | null;
  options: { id: string; text: string; position: number | null }[];
  correct_option_id: string | null;
};

type ResponseRow = {
  question_id: string;
  selected_option_id: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeacherAttemptDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();

  const assessmentId =
    typeof params?.id === "string"
      ? params.id
      : typeof (params as { Id?: string })?.Id === "string"
        ? (params as { Id?: string }).Id
        : undefined;

  const attemptId =
    typeof (params as { attemptId?: string })?.attemptId === "string"
      ? (params as { attemptId?: string }).attemptId
      : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [studentName, setStudentName] = useState<string>("Siswa");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [responseMap, setResponseMap] = useState<Record<string, string | null>>({});
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackUpdatedAt, setFeedbackUpdatedAt] = useState<string | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!assessmentId || !attemptId) return;
      setLoading(true);
      setError(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: aRow, error: aErr } = await supabase
          .from("assessments")
          .select("id,title")
          .eq("id", assessmentId)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (aErr) throw aErr;
        if (!aRow) {
          setError("Assessment tidak ditemukan.");
          return;
        }
        setAssessment(aRow as AssessmentRow);

        const { data: tRow, error: tErr } = await supabase
          .from("attempts")
          .select("id,assessment_id,student_id,status,score,submitted_at,updated_at")
          .eq("id", attemptId)
          .eq("assessment_id", assessmentId)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!tRow) {
          setError("Attempt tidak ditemukan.");
          return;
        }
        setAttempt(tRow as AttemptRow);

        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", (tRow as AttemptRow).student_id)
          .maybeSingle();
        if (profile?.name) setStudentName(profile.name);

        const { data: qRows, error: qErr } = await supabase
          .from("questions")
          .select("id,prompt,position,options(id,text,position),answer_keys(correct_option_id)")
          .eq("assessment_id", assessmentId);
        if (qErr) throw qErr;

        const sortedQuestions = (qRows ?? [])
          .map((q) => ({
            ...q,
            options: [...(q.options ?? [])].sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0)
            ),
            correct_option_id:
              (Array.isArray((q as any).answer_keys)
                ? (q as any).answer_keys[0]?.correct_option_id
                : null) ?? null,
          }))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) as QuestionRow[];
        setQuestions(sortedQuestions);

        const { data: rRows, error: rErr } = await supabase
          .from("responses")
          .select("question_id,selected_option_id")
          .eq("attempt_id", attemptId);
        if (rErr) throw rErr;
        const map: Record<string, string | null> = {};
        (rRows ?? []).forEach((r: ResponseRow) => {
          map[r.question_id] = r.selected_option_id ?? null;
        });
        setResponseMap(map);

        const { data: fbRow } = await supabase
          .from("teacher_feedback")
          .select("id,message,updated_at")
          .eq("attempt_id", attemptId)
          .maybeSingle();
        if (fbRow) {
          const fb = fbRow as FeedbackRow;
          setFeedbackId(fb.id);
          setFeedback(fb.message ?? "");
          setFeedbackUpdatedAt(fb.updated_at);
        } else {
          setFeedbackId(null);
          setFeedback("");
          setFeedbackUpdatedAt(null);
        }
      } catch (e: any) {
        setError(e.message ?? "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [assessmentId, attemptId, router, supabase]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {assessment?.title ?? "Detail Attempt"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Jawaban murid: <span className="font-semibold">{studentName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={assessmentId ? `/teacher/assessments/${assessmentId}` : "/teacher/assessments"}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">Status</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {attempt?.status ?? "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">Score</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {attempt?.score ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">Submitted</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(attempt?.submitted_at ?? attempt?.updated_at ?? null)}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Evaluasi Guru</h2>
              <p className="mt-1 text-sm text-slate-600">
                Catatan satu arah untuk murid ini.
              </p>
              <div className="mt-4">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  placeholder="Tulis evaluasi untuk murid..."
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!assessment || !attempt) return;
                    setSavingFeedback(true);
                    setSaveError(null);
                    setSaveOk(null);
                    try {
                      const {
                        data: { user },
                      } = await supabase.auth.getUser();
                      if (!user) throw new Error("Unauthorized");

                      const payload = {
                        attempt_id: attempt.id,
                        assessment_id: assessment.id,
                        teacher_id: user.id,
                        student_id: attempt.student_id,
                        message: feedback.trim(),
                        updated_at: new Date().toISOString(),
                      };

                      if (feedbackId) {
                        const { error: uErr } = await supabase
                          .from("teacher_feedback")
                          .update(payload)
                          .eq("id", feedbackId);
                        if (uErr) throw uErr;
                      } else {
                        const { data: iRow, error: iErr } = await supabase
                          .from("teacher_feedback")
                          .insert(payload)
                          .select("id,updated_at")
                          .single();
                        if (iErr) throw iErr;
                        if (iRow) {
                          setFeedbackId(iRow.id);
                          setFeedbackUpdatedAt(iRow.updated_at ?? payload.updated_at);
                        }
                      }

                      setFeedbackUpdatedAt(payload.updated_at);
                      setSaveOk("Evaluasi tersimpan.");
                    } catch (e: any) {
                      setSaveError(e.message ?? "Gagal simpan evaluasi.");
                    } finally {
                      setSavingFeedback(false);
                    }
                  }}
                  disabled={savingFeedback || feedback.trim() === ""}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingFeedback ? "Menyimpan..." : "Simpan Evaluasi"}
                </button>
                {feedbackUpdatedAt ? (
                  <span className="text-xs text-slate-500">
                    Terakhir update: {formatDateTime(feedbackUpdatedAt)}
                  </span>
                ) : null}
              </div>
              {saveError ? (
                <div className="mt-3 text-sm font-semibold text-rose-700">{saveError}</div>
              ) : null}
              {saveOk ? (
                <div className="mt-3 text-sm font-semibold text-emerald-700">{saveOk}</div>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              {questions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
                  <p className="text-sm text-slate-600">Belum ada soal.</p>
                </div>
              ) : (
                questions.map((q, idx) => {
                  const selectedId = responseMap[q.id] ?? null;
                  const correctId = q.correct_option_id ?? null;
                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {idx + 1}
                        </span>
                        <div className="text-sm font-semibold text-slate-900">
                          {q.prompt}
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {q.options.map((opt) => {
                          const isSelected = opt.id === selectedId;
                          const isCorrect = opt.id === correctId;
                          return (
                            <div
                              key={opt.id}
                              className={[
                                "flex items-center justify-between rounded-xl border px-4 py-2 text-sm",
                                isCorrect
                                  ? "border-emerald-300 bg-emerald-50 text-slate-900"
                                  : isSelected
                                    ? "border-rose-300 bg-rose-50 text-slate-900"
                                    : "border-slate-200 bg-white text-slate-700",
                              ].join(" ")}
                            >
                              <span>{opt.text}</span>
                              {isCorrect ? (
                                <span className="text-xs font-semibold text-emerald-700">
                                  Benar
                                </span>
                              ) : isSelected ? (
                                <span className="text-xs font-semibold text-rose-700">
                                  Dipilih (Salah)
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                        {q.options.length === 0 ? (
                          <div className="text-xs text-slate-500">Tidak ada opsi.</div>
                        ) : null}
                        {!correctId ? (
                          <div className="text-xs font-semibold text-amber-700">
                            Kunci jawaban belum diisi.
                          </div>
                        ) : null}
                        {!selectedId ? (
                          <div className="text-xs font-semibold text-rose-600">
                            Tidak dijawab
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
