import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type AssessmentRow = {
  id: string;
  title: string;
  is_published: boolean;
  owner_id: string;
};

type AttemptRow = {
  id: string;
  student_id: string;
  status: string | null;
  started_at: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  score: number | null;
  profiles?: { name: string | null; nis: string | null } | null;
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        active
          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
          : "bg-slate-100 text-slate-700 ring-slate-200",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400",
        ].join(" ")}
      />
      {active ? "ACTIVE" : "CLOSED"}
    </span>
  );
}

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

function statusBadge(status: string | null) {
  const s = (status ?? "").toUpperCase();
  const cls =
    s === "SUBMITTED"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : s === "IN_PROGRESS"
        ? "bg-sky-100 text-sky-800 ring-sky-200"
        : s === "TIMED_OUT"
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        cls,
      ].join(" ")}
    >
      {s || "-"}
    </span>
  );
}

export default async function TeacherAssessmentResultsPage({
  params,
}: {
  params: { id?: string; Id?: string };
}) {
  const assessmentId = params.id ?? params.Id;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id,title,is_published,owner_id")
    .eq("id", assessmentId ?? "")
    .single();

  const { data: attempts } = await supabase
    .from("attempts")
    .select(
      "id,student_id,status,started_at,submitted_at,updated_at,score,profiles(name,nis)"
    )
    .eq("assessment_id", assessmentId ?? "");

  const a = (assessment ?? null) as AssessmentRow | null;
  const isOwner = !!user?.id && a?.owner_id === user.id;
  const list = (attempts ?? []) as unknown as AttemptRow[];
  const sorted = list
    .slice()
    .sort((x, y) => {
      const xd = x.submitted_at ?? x.updated_at ?? x.started_at ?? "";
      const yd = y.submitted_at ?? y.updated_at ?? y.started_at ?? "";
      return yd.localeCompare(xd);
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {a?.title ?? "Assessment Results"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Riwayat pengerjaan peserta.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill active={a?.is_published ?? false} />
              <Link
                href="/teacher"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
          {!isOwner ? (
            <div className="p-8 text-center text-sm text-rose-700">
              Kamu tidak punya akses ke hasil assessment ini.
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-600">
              Belum ada peserta yang mengerjakan assessment ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Submitted/Updated</th>
                    <th className="px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sorted.map((row) => (
                    <tr key={row.id} className="text-slate-700">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.profiles?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3">{row.profiles?.nis ?? "-"}</td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3">{formatDateTime(row.started_at)}</td>
                      <td className="px-4 py-3">
                        {formatDateTime(row.submitted_at ?? row.updated_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {row.score ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
