"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StudentAttemptResultPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const attemptId =
    typeof params?.id === "string"
      ? params.id
      : typeof (params as { Id?: string })?.Id === "string"
        ? (params as { Id?: string }).Id
        : "-";

  const correct = Number(search.get("correct") ?? 0);
  const wrong = Number(search.get("wrong") ?? 0);
  const blank = Number(search.get("blank") ?? 0);
  const total = Number(search.get("total") ?? 0);
  const score = Number(search.get("score") ?? correct);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  useEffect(() => {
    async function loadFeedback() {
      if (!attemptId || attemptId === "-") {
        setFeedbackLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("teacher_feedback")
          .select("message,updated_at")
          .eq("attempt_id", attemptId)
          .maybeSingle();
        setFeedback(data?.message ?? null);
      } finally {
        setFeedbackLoading(false);
      }
    }
    loadFeedback();
  }, [attemptId, supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Hasil Attempt
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Attempt ID: <span className="font-mono">{attemptId}</span>
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-slate-500">Score</div>
              <div className="text-2xl font-bold text-slate-900">{score}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-slate-500">Total Soal</div>
              <div className="text-2xl font-bold text-slate-900">{total}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-emerald-700">Benar</div>
              <div className="text-2xl font-bold text-emerald-800">{correct}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-rose-700">Salah</div>
              <div className="text-2xl font-bold text-rose-800">{wrong}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-slate-600">Kosong</div>
              <div className="text-2xl font-bold text-slate-900">{blank}</div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => router.push("/student/assessments")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali ke Assessment
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Evaluasi Guru</h2>
          <p className="mt-1 text-sm text-slate-600">Catatan dari guru untuk kamu.</p>
          <div className="mt-4 text-sm text-slate-700">
            {feedbackLoading
              ? "Loading..."
              : feedback
                ? feedback
                : "Belum ada evaluasi."}
          </div>
        </div>
      </div>
    </div>
  );
}
