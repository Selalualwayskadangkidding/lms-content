import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SummaryRow = {
  attempt_id: string;
  student_name: string | null;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
  computed_score: number | null;
};

type AssessmentRow = {
  id: string;
  title: string;
  is_published: boolean;
};

export default async function TeacherAssessmentSummary({
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

  const { data: rows } = await supabase
    .from("teacher_results")
    .select("attempt_id,student_name,correct,wrong,blank,computed_score")
    .eq("assessment_id", params.id)
    .order("computed_score", { ascending: false, nullsLast: true });

  const list = (rows ?? []) as SummaryRow[];
  const info = assessment as AssessmentRow | null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="pointer-events-none absolute -top-24 left-[-120px] h-[320px] w-[320px] rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-[-160px] h-[360px] w-[360px] rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {info?.title ?? "Assessment"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ringkasan hasil siswa (urut score tertinggi ? terendah)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                info?.is_published
                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                  : "bg-slate-100 text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              {info?.is_published ? "ACTIVE" : "CLOSED"}
            </span>
            <Link
              href="/teacher"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          {list.length === 0 ? (
            <div className="text-sm text-slate-500">Belum ada yang mengerjakan.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Nama Siswa</th>
                    <th className="py-3">Benar</th>
                    <th className="py-3">Salah</th>
                    <th className="py-3">Kosong</th>
                    <th className="py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {list.map((r) => (
                    <tr key={r.attempt_id} className="text-slate-700">
                      <td className="py-3 font-semibold text-slate-900">
                        {r.student_name ?? "Siswa"}
                      </td>
                      <td className="py-3">{r.correct ?? 0}</td>
                      <td className="py-3">{r.wrong ?? 0}</td>
                      <td className="py-3">{r.blank ?? 0}</td>
                      <td className="py-3 text-right font-bold text-sky-700">
                        {r.computed_score ?? 0}
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
