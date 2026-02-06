import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/teacher/_components/LogoutButton";

type ActiveAttemptRow = {
  id: string;
  status: string | null;
  expires_at: string | null;
  updated_at: string | null;
  assessments?: {
    id: string;
    title: string;
    duration_minutes: number | null;
    start_at: string | null;
    end_at: string | null;
  } | null;
};

type HistoryAttemptRow = {
  id: string;
  assessment_id: string | null;
  status: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  score: number | null;
  assessments?: { title: string } | null;
};

type AssessmentRow = {
  id: string;
  title: string;
  duration_minutes: number | null;
  start_at: string | null;
  end_at: string | null;
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

function formatSchedule(startAt: string | null, endAt: string | null) {
  if (!startAt && !endAt) return "Fleksibel";
  const s = startAt ? formatDateTime(startAt) : "-";
  const e = endAt ? formatDateTime(endAt) : "-";
  return `${s} - ${e}`;
}

function formatRemaining(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default async function StudentHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.name ??
    (user?.email ? user.email.split("@")[0] : null) ??
    "Student";

  const email = user?.email ?? "-";

  const { data: activeAttempt } = await supabase
    .from("attempts")
    .select(
      "id,status,expires_at,updated_at,assessments(id,title,duration_minutes,start_at,end_at)"
    )
    .eq("student_id", user?.id ?? "")
    .eq("status", "IN_PROGRESS")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: history } = await supabase
    .from("attempts")
    .select("id,assessment_id,status,submitted_at,updated_at,score,assessments(title)")
    .eq("student_id", user?.id ?? "")
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: available } = await supabase
    .from("assessments")
    .select("id,title,duration_minutes,start_at,end_at")
    .eq("is_published", true)
    .order("start_at", { ascending: true, nullsFirst: true })
    .limit(10);

  const now = new Date();
  const availableList = (available ?? [])
    .filter((a) => {
      const startOk = !a.start_at || new Date(a.start_at) <= now;
      const endOk = !a.end_at || new Date(a.end_at) >= now;
      return startOk && endOk;
    })
    .slice(0, 5) as AssessmentRow[];

  const active = activeAttempt as ActiveAttemptRow | null;
  const historyList = (history ?? []) as HistoryAttemptRow[];
  const availableIds = availableList.map((a) => a.id);

  const { data: completedAttempts } = await supabase
    .from("attempts")
    .select("assessment_id,status")
    .eq("student_id", user?.id ?? "")
    .in("assessment_id", availableIds)
    .in("status", ["SUBMITTED", "TIMED_OUT"]);

  const completedSet = new Set(
    (completedAttempts ?? [])
      .map((row) => row.assessment_id)
      .filter(Boolean) as string[]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Halo, {displayName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/student/assessments"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Lihat Assessments
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Sedang Berlangsung</h2>
          <p className="mt-1 text-sm text-slate-600">Attempt aktif terbaru.</p>
          <div className="mt-4">
            {!active ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Belum ada attempt aktif.
                <div className="mt-3">
                  <Link
                    href="/student/assessments"
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Cari Assessments
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Assessment</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">
                      {active.assessments?.title ?? "Assessment"}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatSchedule(
                        active.assessments?.start_at ?? null,
                        active.assessments?.end_at ?? null
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    IN_PROGRESS
                  </span>
                </div>
                {active.expires_at && (
                  <div className="mt-3 text-sm text-slate-600">
                    Sisa waktu: {formatRemaining(active.expires_at)}
                  </div>
                )}
                <div className="mt-4">
                  <Link
                    href={`/student/attempts/${active.id}`}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Lanjutkan
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Assessment Tersedia</h2>
          <p className="mt-1 text-sm text-slate-600">Yang sedang aktif sekarang.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {availableList.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada assessment aktif.</div>
            ) : (
              availableList.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">
                        {a.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Durasi: {a.duration_minutes ?? 0} menit
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatSchedule(a.start_at, a.end_at)}
                      </div>
                    </div>
                    {completedSet.has(a.id) ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        SELESAI
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        AKTIF
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    {completedSet.has(a.id) ? (
                      <span className="inline-flex cursor-not-allowed items-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                        Sudah selesai
                      </span>
                    ) : (
                      <Link
                        href={`/student/assessments/${a.id}`}
                        className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                      >
                        Mulai / Join
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Riwayat Terakhir</h2>
          <p className="mt-1 text-sm text-slate-600">5 attempt terakhir kamu.</p>
          <div className="mt-4 space-y-3">
            {historyList.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada attempt.</div>
            ) : (
              historyList.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {h.assessments?.title ?? "Assessment"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(h.submitted_at ?? h.updated_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{h.status ?? "-"}</div>
                    <div className="text-sm font-bold text-sky-700">
                      {h.score ?? 0}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
