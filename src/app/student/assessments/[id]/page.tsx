"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  subjects?: { name: string }[] | null;
  is_published: boolean;
  access_password_hash: string | null;
};

function formatTimeHM(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSchedule(a: Assessment) {
  const s = formatTimeHM(a.start_at);
  const e = formatTimeHM(a.end_at);
  if (s === "-" && e === "-") return "Tidak dijadwalkan";
  return `${s} - ${e}`;
}

function computeStatus(a: Assessment) {
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
  if (status === "UPCOMING") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (status === "ENDED") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

export default function StudentAssessmentDetailPage() {
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
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [completed, setCompleted] = useState(false);
  const [password, setPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function fetchDetail() {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("assessments")
        .select(
          "id,title,description,start_at,end_at,duration_minutes,is_published,access_password_hash,subjects(name)"
        )
        .eq("id", assessmentId)
        .eq("is_published", true)
        .single();

      if (qErr) throw qErr;
      setAssessment(data as Assessment);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCompleted(false);
        return;
      }

      const { data: done } = await supabase
        .from("attempts")
        .select("id,status")
        .eq("assessment_id", assessmentId)
        .eq("student_id", user.id)
        .in("status", ["SUBMITTED", "TIMED_OUT"])
        .limit(1)
        .maybeSingle();

      setCompleted(!!done);
    } catch (e: any) {
      setError(e.message ?? "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-rose-200 bg-white/80 p-6 shadow-sm">
            <p className="text-sm text-rose-700">{error ?? "Assessment tidak ditemukan."}</p>
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

  const status = completed ? "SELESAI" : computeStatus(assessment);
  const hasPassword = !!assessment.access_password_hash;
  const canJoin = !completed && status === "ONGOING";

  async function joinAttempt() {
    if (!assessmentId) return;
    if (completed) {
      setJoinError("Assessment sudah dikerjakan.");
      return;
    }
    if (!canJoin) {
      setJoinError(
        status === "UPCOMING"
          ? "Assessment belum dimulai."
          : "Assessment sudah berakhir."
      );
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/student/api/assessments/${assessmentId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/student/attempts/${data.attemptId}`);
    } catch (e: any) {
      setJoinError(e.message ?? "Gagal join assessment");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                {assessment.subjects?.[0]?.name ?? "Mapel"}
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                {assessment.title}
              </h1>
              {assessment.description ? (
                <p className="mt-2 text-sm text-slate-600">{assessment.description}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Tidak ada deskripsi.</p>
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

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
            <div>
              <span className="font-semibold text-slate-700">Jadwal: </span>
              {formatSchedule(assessment)}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Durasi: </span>
              {assessment.duration_minutes ? `${assessment.duration_minutes} menit` : "-"}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={joinAttempt}
              disabled={joining || !canJoin}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {joining
                ? "Memulai..."
                : status === "SELESAI"
                  ? "Sudah selesai"
                  : status === "UPCOMING"
                  ? "Belum Dimulai"
                  : status === "ENDED"
                    ? "Sudah Berakhir"
                    : "Mulai / Lanjutkan"}
            </button>
            <button
              onClick={() => router.push("/student/assessments")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </button>
          </div>

          {hasPassword ? (
            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-700">
                Password Assessment
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                placeholder="Masukkan password"
              />
            </div>
          ) : null}

          {joinError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {joinError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
