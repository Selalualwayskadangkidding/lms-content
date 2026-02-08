"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AssessmentRow = {
  id: string;
  title: string;
  is_published: boolean;
};

  type AttemptRow = {
    id: string;
    student_id: string;
    score: number | null;
    updated_at: string | null;
    submitted_at: string | null;
    status?: string | null;
  };

type StudentLabelMap = Record<string, string>;

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

export default function TeacherAssessmentDetail() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const assessmentId =
    typeof params?.id === "string"
      ? params.id
      : typeof (params as { Id?: string })?.Id === "string"
        ? (params as { Id?: string }).Id
        : undefined;

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [results, setResults] = useState<AttemptRow[]>([]);
  const [labels, setLabels] = useState<StudentLabelMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!assessmentId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: assessmentRow, error: aErr } = await supabase
          .from("assessments")
          .select("id,title,is_published")
          .eq("id", assessmentId)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (aErr) throw aErr;
        setAssessment(assessmentRow as AssessmentRow | null);

        const { data: attempts, error: tErr } = await supabase
          .from("attempts")
          .select("id,student_id,score,updated_at,submitted_at,status")
          .eq("assessment_id", assessmentId)
          .in("status", ["SUBMITTED", "TIMED_OUT"])
          .order("score", { ascending: false })
          .order("updated_at", { ascending: false });
        if (tErr) throw tErr;
        const rows = (attempts ?? []) as AttemptRow[];
        setResults(rows);

        const ids = Array.from(new Set(rows.map((x) => x.student_id)));
        const mapped: StudentLabelMap = {};
        ids.forEach((id) => {
          mapped[id] = `Siswa ${id.slice(0, 6)}`;
        });

        if (ids.length > 0) {
          const { data: profiles, error: pErr } = await supabase
            .from("profiles")
            .select("id,name")
            .in("id", ids);
          if (!pErr && profiles) {
            profiles.forEach((p) => {
              if (p.name) mapped[p.id] = p.name;
            });
          }
        }

        setLabels(mapped);
      } catch (e: any) {
        setError(e.message ?? "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [assessmentId, router, supabase]);

  const getStudentLabel = (row: AttemptRow) => labels[row.student_id] ?? "Siswa";
  const attemptHref = (attemptId: string) =>
    assessmentId ? `/teacher/assessments/${assessmentId}/attempts/${attemptId}` : "#";

  const leaderboard = useMemo(() => {
    const map = new Map<string, AttemptRow>();
    results.forEach((row) => {
      if (!map.has(row.student_id)) {
        map.set(row.student_id, row);
      }
    });
    return Array.from(map.values());
  }, [results]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="pointer-events-none absolute -top-24 left-[-120px] h-[320px] w-[320px] rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-[-160px] h-[360px] w-[360px] rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {assessment?.title ?? "Assessment"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Detail hasil per assessment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                assessment?.is_published
                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                  : "bg-slate-100 text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              {assessment?.is_published ? "OPEN" : "CLOSED"}
            </span>
            <button
              onClick={() => router.push("/teacher/assessments")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </button>
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
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-bold text-slate-900">Nilai Tertinggi</h2>
            <p className="mt-1 text-sm text-slate-600">
              Semua murid yang sudah selesai, urut skor tertinggi.
            </p>
            <div className="mt-4 space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-sm text-slate-500">Belum ada hasil.</div>
              ) : (
                leaderboard.map((row, idx) => (
                  <Link
                    key={row.student_id}
                    href={attemptHref(row.id)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {idx + 1}
                      </span>
                      <div className="text-sm font-semibold text-slate-900">
                        {getStudentLabel(row)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-sky-700">
                      {row.score ?? 0}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-bold text-slate-900">Latest Results</h2>
            <p className="mt-1 text-sm text-slate-600">Attempt terbaru untuk assessment ini.</p>
            <div className="mt-4 space-y-3">
              {results.length === 0 ? (
                <div className="text-sm text-slate-500">Belum ada hasil.</div>
              ) : (
                results.map((r) => (
                  <Link
                    key={r.id}
                    href={attemptHref(r.id)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {getStudentLabel(r)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(r.submitted_at ?? r.updated_at)}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-sky-700">
                      {r.score ?? 0}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
