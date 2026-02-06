import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

export default async function TeacherAssessmentDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id,title,is_published")
    .eq("id", params.id)
    .maybeSingle();

  const { data: topAttempt } = await supabase
    .from("attempts")
    .select("id,student_id,score,updated_at,submitted_at")
    .eq("assessment_id", params.id)
    .order("score", { ascending: false, nullsLast: true })
    .order("updated_at", { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle();

  const { data: latestAttempts } = await supabase
    .from("attempts")
    .select("id,student_id,score,updated_at,submitted_at")
    .eq("assessment_id", params.id)
    .order("updated_at", { ascending: false, nullsLast: true })
    .limit(8);

  const top = topAttempt as AttemptRow | null;
  const latest = (latestAttempts ?? []) as AttemptRow[];

  const studentIds = Array.from(
    new Set([top?.student_id, ...latest.map((x) => x.student_id)].filter(Boolean))
  ) as string[];

  let labels: StudentLabelMap = {};
  if (studentIds.length > 0) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const byId = new Map(data?.users?.map((u) => [u.id, u]) ?? []);
    studentIds.forEach((id) => {
      const user = byId.get(id);
      const displayName =
        (user?.user_metadata?.display_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        (user?.email ? user.email.split("@")[0] : null) ||
        "Siswa";
      labels[id] = displayName;
    });
  }

  const getStudentLabel = (row: AttemptRow) =>
    labels[row.student_id] ?? "Siswa";

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
            <Link
              href="/teacher"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-bold text-slate-900">Nilai Tertinggi</h2>
            <p className="mt-1 text-sm text-slate-600">Top skor untuk assessment ini.</p>
            <div className="mt-4">
              {!top ? (
                <div className="text-sm text-slate-500">Belum ada hasil.</div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {getStudentLabel(top)}
                  </div>
                  <div className="text-sm font-bold text-sky-700">
                    {top.score ?? 0}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-bold text-slate-900">Latest Results</h2>
            <p className="mt-1 text-sm text-slate-600">Attempt terbaru untuk assessment ini.</p>
            <div className="mt-4 space-y-3">
              {latest.length === 0 ? (
                <div className="text-sm text-slate-500">Belum ada hasil.</div>
              ) : (
                latest.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
