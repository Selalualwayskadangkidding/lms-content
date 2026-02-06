"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  subjects?: { name: string }[] | null;
};

function formatTimeHM(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSchedule(a: AssessmentRow) {
  const s = formatTimeHM(a.start_at);
  const e = formatTimeHM(a.end_at);
  if (s === "-" && e === "-") return "Tidak dijadwalkan";
  return `${s} - ${e}`;
}

function computeStatus(a: AssessmentRow) {
  const now = Date.now();
  const start = a.start_at ? new Date(a.start_at).getTime() : null;
  const end = a.end_at ? new Date(a.end_at).getTime() : null;

  if (start && now < start) return "UPCOMING";
  if (end && now > end) return "ENDED";
  if (start && end && now >= start && now <= end) return "ONGOING";
  if (start && !end && now >= start) return "ONGOING";
  if (!start && end && now <= end) return "ONGOING";
  return "ONGOING";
}

function statusClass(status: string) {
  if (status === "UPCOMING") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (status === "ENDED") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

export default function StudentAssessmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AssessmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("assessments")
        .select("id,title,description,start_at,end_at,duration_minutes,is_published,subjects(name)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setList((data as AssessmentRow[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Assessment List
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Daftar assessment yang sudah dipublish.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchList}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
              <Link
                href="/student"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-sm text-slate-600">Loading...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Belum ada assessment</h3>
              <p className="mt-1 text-sm text-slate-600">
                Tunggu guru mem-publish assessment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => {
                const status = computeStatus(a);
                return (
                  <div
                    key={a.id}
                    className="group rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500">
                          {a.subjects?.[0]?.name ?? "Mapel"}
                        </div>
                        <div className="mt-1 truncate text-lg font-extrabold text-slate-900">
                          {a.title}
                        </div>
                        {a.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {a.description}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-400">Tidak ada deskripsi.</p>
                        )}
                      </div>
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          statusClass(status),
                        ].join(" ")}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="text-slate-500">{formatSchedule(a)}</div>
                      <div className="text-slate-500">
                        {a.duration_minutes ? `${a.duration_minutes} menit` : "-"}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/student/assessments/${a.id}`}
                        className="text-sm font-semibold text-sky-700"
                      >
                        Detail →
                      </Link>
                      <Link
                        href={`/student/assessments/${a.id}`}
                        className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Mulai
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
