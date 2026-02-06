"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Attempt = {
  id: string;
  assessment_id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT" | "RESET";
  started_at: string;
  expires_at: string | null;
};

type Assessment = {
  id: string;
  title: string;
  end_at: string | null;
};

type Question = {
  id: string;
  prompt: string;
  position: number;
  options: { id: string; text: string; position: number }[];
};

type ResponseRow = {
  question_id: string;
  selected_option_id: string;
};

function msToHHMMSS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function StudentAttemptPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const attemptId =
    typeof params?.id === "string"
      ? params.id
      : typeof (params as { Id?: string })?.Id === "string"
        ? (params as { Id?: string }).Id
        : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function fetchAttempt() {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/student/api/attempts/${attemptId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setAttempt(data.attempt);
      setAssessment(data.assessment);
      setQuestions(data.questions);
      const map: Record<string, string> = {};
      (data.responses as ResponseRow[]).forEach((r) => {
        map[r.question_id] = r.selected_option_id;
      });
      setResponses(map);
      setCurrentIndex(0);
    } catch (e: any) {
      setError(e.message ?? "Gagal memuat attempt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const deadline = (() => {
    const exp = attempt?.expires_at ? new Date(attempt.expires_at).getTime() : null;
    const end = assessment?.end_at ? new Date(assessment.end_at).getTime() : null;
    if (exp && end) return Math.min(exp, end);
    return exp ?? end ?? null;
  })();

  const isTimedOut =
    attempt?.status === "TIMED_OUT" ||
    (deadline !== null && Date.now() > deadline);

  const timeLeft = deadline ? msToHHMMSS(deadline - Date.now()) : "--:--:--";

  const currentQuestion = questions[currentIndex];

  async function saveResponse(questionId: string, optionId: string) {
    if (!attemptId) return;
    if (isTimedOut) return;
    setSavingQuestionId(questionId);
    setSaveError(null);
    try {
      const res = await fetch(`/student/api/attempts/${attemptId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, selected_option_id: optionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResponses((prev) => ({ ...prev, [questionId]: optionId }));
    } catch (e: any) {
      setSaveError(e.message ?? "Gagal menyimpan jawaban");
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function submitAttempt() {
    if (!attemptId) return;
    if (isTimedOut) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/student/api/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const params = new URLSearchParams({
        correct: String(data.correct ?? 0),
        wrong: String(data.wrong ?? 0),
        blank: String(data.blank ?? 0),
        total: String(data.total ?? 0),
        score: String(data.score ?? 0),
      });
      router.push(`/student/attempts/${attemptId}/result?${params.toString()}`);
    } catch (e: any) {
      setSubmitError(e.message ?? "Gagal submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt || !assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-rose-700">{error ?? "Attempt tidak ditemukan."}</p>
            <div className="mt-4">
              <button
                onClick={() => router.push("/student/assessments")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{assessment.title}</h1>
              <p className="text-sm text-slate-600">Attempt: {attempt.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {isTimedOut ? "Waktu habis" : `Sisa waktu: ${timeLeft}`}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Nomor Soal</h2>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const answered = !!responses[q.id];
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={[
                      "h-9 rounded-lg text-xs font-semibold",
                      idx === currentIndex
                        ? "bg-sky-600 text-white"
                        : answered
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            {currentQuestion ? (
              <>
                <div className="text-sm text-slate-500">Soal {currentIndex + 1}</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {currentQuestion.prompt}
                </div>

                <div className="mt-4 space-y-3">
                  {currentQuestion.options
                    .slice()
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                    .map((o) => {
                      const selected = responses[currentQuestion.id] === o.id;
                      return (
                        <label
                          key={o.id}
                          className={[
                            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                            selected
                              ? "border-sky-200 bg-sky-50 text-slate-900"
                              : "border-slate-200 bg-white text-slate-700",
                            isTimedOut ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name={`q-${currentQuestion.id}`}
                            checked={selected}
                            disabled={isTimedOut}
                            onChange={() => saveResponse(currentQuestion.id, o.id)}
                          />
                          <span>{o.text}</span>
                        </label>
                      );
                    })}
                </div>

                {saveError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                    {saveError}
                  </div>
                ) : null}
                {submitError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                    {submitError}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentIndex((x) => Math.max(0, x - 1))}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() =>
                        setCurrentIndex((x) => Math.min(questions.length - 1, x + 1))
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingQuestionId === currentQuestion.id ? (
                      <span className="text-xs text-slate-500">Saving...</span>
                    ) : null}
                    <button
                      onClick={submitAttempt}
                      disabled={submitting || isTimedOut}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">Tidak ada soal.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
