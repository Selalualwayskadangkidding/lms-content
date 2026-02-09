"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AssessmentRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  subjects?: { name: string } | { name: string }[] | null;
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
  if (status === "SELESAI") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (status === "BELUM DIBUKA")
    return "bg-amber-100 text-amber-800 ring-amber-200";
  if (status === "TUTUP") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

export default function StudentAssessmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AssessmentRow[]>([]);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [teacherById, setTeacherById] = useState<Record<string, string | null>>({});
  const [feedbackByAssessment, setFeedbackByAssessment] = useState<Record<string, string | null>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("assessments")
        .select(
          "id,owner_id,title,description,start_at,end_at,duration_minutes,is_published,subjects(name)"
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      const rows = (data as AssessmentRow[]) ?? [];
      setList(rows);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || rows.length === 0) {
        setCompletedSet(new Set());
        setTeacherById({});
        setFeedbackByAssessment({});
        return;
      }

      const ownerIds = Array.from(
        new Set(rows.map((row) => row.owner_id).filter(Boolean))
      ) as string[];
      if (ownerIds.length > 0) {
        const { data: teachers } = await supabase
          .from("profiles")
          .select("id,name")
          .in("id", ownerIds)
          .eq("role", "TEACHER");

        const map: Record<string, string | null> = {};
        (teachers ?? []).forEach((t) => {
          map[t.id] = t.name ?? null;
        });
        setTeacherById(map);
      } else {
        setTeacherById({});
      }

      const ids = rows.map((row) => row.id);
      const { data: completed } = await supabase
        .from("attempts")
        .select("id,assessment_id,status,updated_at")
        .eq("student_id", user.id)
        .in("assessment_id", ids)
        .in("status", ["SUBMITTED", "TIMED_OUT"]);

      const completedRows = (completed ?? []) as {
        id: string;
        assessment_id: string;
        updated_at: string | null;
      }[];

      const doneIds = completedRows.map((row) => row.assessment_id).filter(Boolean);
      setCompletedSet(new Set(doneIds));

      const latestAttemptByAssessment: Record<string, { id: string; updatedAt: number }> = {};
      completedRows.forEach((row) => {
        const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        const existing = latestAttemptByAssessment[row.assessment_id];
        if (!existing || updatedAt > existing.updatedAt) {
          latestAttemptByAssessment[row.assessment_id] = { id: row.id, updatedAt };
        }
      });

      const latestAttemptIds = Object.values(latestAttemptByAssessment).map((v) => v.id);
      if (latestAttemptIds.length === 0) {
        setFeedbackByAssessment({});
      } else {
        const { data: feedbackRows } = await supabase
          .from("teacher_feedback")
          .select("attempt_id,message,updated_at")
          .in("attempt_id", latestAttemptIds);

        const feedbackByAttempt: Record<string, string | null> = {};
        (feedbackRows ?? []).forEach((row) => {
          feedbackByAttempt[row.attempt_id] = row.message ?? null;
        });

        const map: Record<string, string | null> = {};
        Object.entries(latestAttemptByAssessment).forEach(([assessmentId, attempt]) => {
          map[assessmentId] = feedbackByAttempt[attempt.id] ?? null;
        });
        setFeedbackByAssessment(map);
      }
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

  const grouped = useMemo(() => {
    const buckets = {
      UPCOMING: [] as AssessmentRow[],
      ONGOING: [] as AssessmentRow[],
      ENDED: [] as AssessmentRow[],
      DONE: [] as AssessmentRow[],
    };

    list.forEach((row) => {
      if (completedSet.has(row.id)) {
        buckets.DONE.push(row);
        return;
      }
      const status = computeStatus(row);
      if (status === "UPCOMING") buckets.UPCOMING.push(row);
      else if (status === "ENDED") buckets.ENDED.push(row);
      else buckets.ONGOING.push(row);
    });

    return buckets;
  }, [list, completedSet]);

  const sections = [
    {
      key: "UPCOMING",
      title: "Belum Dibuka",
      description: "Belum bisa dikerjakan.",
      empty: "Belum ada assessment yang belum dibuka.",
    },
    {
      key: "ONGOING",
      title: "Dibuka",
      description: "Sedang bisa dikerjakan.",
      empty: "Belum ada assessment yang dibuka.",
    },
    {
      key: "ENDED",
      title: "Tutup",
      description: "Waktu pengerjaan sudah berakhir.",
      empty: "Belum ada assessment yang ditutup.",
    },
    {
      key: "DONE",
      title: "Selesai Dikerjakan",
      description: "Assessment yang sudah kamu kerjakan.",
      empty: "Belum ada assessment yang selesai dikerjakan.",
    },
  ] as const;

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
            <div className="space-y-6">
              {sections.map((section) => {
                const items = grouped[section.key];
                return (
                  <div key={section.key}>
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
                      <p className="text-sm text-slate-600">{section.description}</p>
                    </div>
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-500 shadow-sm">
                        {section.empty}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {items.map((a) => {
                          const isCompleted = completedSet.has(a.id);
                          const baseStatus = computeStatus(a);
                          const status = isCompleted
                            ? "SELESAI"
                            : baseStatus === "UPCOMING"
                            ? "BELUM DIBUKA"
                            : baseStatus === "ENDED"
                            ? "TUTUP"
                            : "DIBUKA";
                          const teacherName = teacherById[a.owner_id] ?? "Guru";
                          const rawSubjects = a.subjects;
                          const subjectName = Array.isArray(rawSubjects)
                            ? rawSubjects[0]?.name
                            : rawSubjects?.name;
                          const feedback = feedbackByAssessment[a.id] ?? null;
                          return (
                            <div
                              key={a.id}
                              className="group rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="mt-1 truncate text-lg font-extrabold text-slate-900">
                                    {a.title}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-slate-500">
                                    Guru: {teacherName}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Mapel: {subjectName ?? "Mapel"}
                                  </div>
                                  {a.description ? (
                                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                                      {a.description}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm text-slate-400">
                                      Tidak ada deskripsi.
                                    </p>
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

                              {status === "SELESAI" ? (
                                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                  <div className="text-xs font-semibold text-slate-600">
                                    Evaluasi Guru
                                  </div>
                                  {feedback ? (
                                    <p className="mt-1 line-clamp-3 text-sm text-slate-700">
                                      {feedback}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm text-slate-400">
                                      Belum ada evaluasi.
                                    </p>
                                  )}
                                </div>
                              ) : null}

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
                                  Detail -&gt;
                                </Link>
                                {status === "DIBUKA" ? (
                                  <Link
                                    href={`/student/assessments/${a.id}`}
                                    className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                                  >
                                    Mulai
                                  </Link>
                                ) : status === "SELESAI" ? (
                                  <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                                    Sudah selesai
                                  </span>
                                ) : status === "BELUM DIBUKA" ? (
                                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                    Belum dibuka
                                  </span>
                                ) : (
                                  <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                                    Tutup
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
