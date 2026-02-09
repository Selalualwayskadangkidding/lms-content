"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/app/teacher/_components/LogoutButton";

type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
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

export default function TeacherAssessmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AssessmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Unauthorized");

      const { data, error: qErr } = await supabase
        .from("assessments")
        .select("id,title,description,start_at,end_at,is_published,subjects(name)")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      const rows = (data as AssessmentRow[]) ?? [];

      // Auto-close: if end_at already passed, mark as closed in DB
      const now = Date.now();
      const expired = rows.filter(
        (x) => x.is_published && x.end_at && new Date(x.end_at).getTime() <= now
      );
      if (expired.length > 0) {
        const ids = expired.map((x) => x.id);
        await supabase.from("assessments").update({ is_published: false }).in("id", ids);
        // Reflect immediately in UI
        expired.forEach((x) => {
          x.is_published = false;
        });
      }

      setList(rows);
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

  async function deleteAssessment(id: string) {
    if (!confirm("Hapus assessment ini? Semua soal & attempt akan ikut terhapus.")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch("/teacher/assessments/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message ?? "Gagal hapus assessment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="pointer-events-none absolute -top-24 left-[-120px] h-[320px] w-[320px] rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-[-160px] h-[360px] w-[360px] rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Kelola Assessment
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Daftar assessment milikmu + tombol create.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchList}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
              <LogoutButton />
              <Link
                href="/teacher/assessments/new"
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Create Assessment
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
                Buat assessment baru agar bisa dikelola.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => (
                <div
                  key={a.id}
                  className="group rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500">
                        {Array.isArray(a.subjects)
                          ? a.subjects[0]?.name ?? "Mapel"
                          : a.subjects?.name ?? "Mapel"}
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
                        a.is_published
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : "bg-slate-100 text-slate-700 ring-slate-200",
                      ].join(" ")}
                    >
                      {a.is_published ? "ACTIVE" : "CLOSED"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <div className="text-slate-500">{formatSchedule(a)}</div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/teacher/assessments/${a.id}/edit`}
                        className="font-semibold text-slate-700 hover:text-slate-900"
                      >
                        Edit →
                      </Link>
                      <Link
                        href={`/teacher/assessments/${a.id}`}
                        className="font-semibold text-sky-700"
                      >
                        Detail Hasil →
                      </Link>
                      <button
                        onClick={() => deleteAssessment(a.id)}
                        disabled={deletingId === a.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {deletingId === a.id ? "Deleting..." : "Hapus"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
