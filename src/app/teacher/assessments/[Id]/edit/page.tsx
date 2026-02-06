"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Assessment = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  access_password_hash: string | null;
};

type AssessmentWithSubject = Assessment & {
  subjects?: { name: string } | null;
};
type QuestionRow = {
  id: string;
  prompt: string;
  points: number;
  position: number;
  options: { id: string; text: string; position: number }[];
  answer_keys: { correct_option_id: string } | { correct_option_id: string }[] | null;
};

type QuestionDraft = {
  id: string;
  prompt: string;
  points: number;
  position: number;
  options: { id?: string; text: string; position: number }[];
  correctOptionId: string | null;
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return d.toISOString();
}

export default function EditAssessmentPage() {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  const [newPrompt, setNewPrompt] = useState("");
  const [newPoints, setNewPoints] = useState("1");
  const [newOptions, setNewOptions] = useState([
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);

  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);

  async function fetchAll() {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Unauthorized");

      const { data: a, error: aErr } = await supabase
        .from("assessments")
        .select(
          "id,title,description,subject_id,start_at,end_at,duration_minutes,is_published,access_password_hash,subjects(name)"
        )
        .eq("id", assessmentId)
        .eq("owner_id", user.id)
        .single();

      if (aErr) throw aErr;
      const assessmentsRaw = (a as { subjects?: { name: string } | { name: string }[] | null })
        .subjects;
      const normalized: AssessmentWithSubject = {
        ...(a as Assessment),
        subjects: Array.isArray(assessmentsRaw)
          ? assessmentsRaw[0] ?? null
          : assessmentsRaw ?? null,
      };
      setAssessment(normalized);
      setSubjectName(normalized.subjects?.name ?? "");

      const { data: q, error: qErr } = await supabase
        .from("questions")
        .select(
          "id,prompt,points,position,options:options(id,text,position),answer_keys:answer_keys(correct_option_id)"
        )
        .eq("assessment_id", assessmentId)
        .order("position", { ascending: true });

      if (qErr) throw qErr;

      const drafts = ((q as QuestionRow[]) ?? []).map((row) => {
        const opts = [...(row.options ?? [])].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        const answerKeysRaw = row.answer_keys;
        const answerKey =
          Array.isArray(answerKeysRaw) ? answerKeysRaw[0] ?? null : answerKeysRaw ?? null;
        const correctId = answerKey?.correct_option_id ?? null;
        return {
          id: row.id,
          prompt: row.prompt,
          points: row.points ?? 1,
          position: row.position ?? 1,
          // Normalize positions to current order so correctIndex -> position stays consistent
          options: opts.map((o, idx) => ({ id: o.id, text: o.text, position: idx + 1 })),
          correctOptionId: correctId,
        };
      });

      setQuestions(drafts);
    } catch (e: any) {
      setError(e.message ?? "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  async function saveAssessment() {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/teacher/assessments/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: assessment.id,
          title: assessment.title,
          description: assessment.description,
          subject_name: subjectName,
          start_at: assessment.start_at,
          end_at: assessment.end_at,
          duration_minutes: assessment.duration_minutes,
          is_published: assessment.is_published,
          password: password || undefined,
          clear_password: clearPassword,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPassword("");
      setClearPassword(false);
      await fetchAll();
    } catch (e: any) {
      setError(e.message ?? "Gagal update assessment");
    } finally {
      setSaving(false);
    }
  }

  async function addQuestion() {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/teacher/assessments/api/questions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          prompt: newPrompt,
          points: Number(newPoints) || 1,
          options: newOptions.map((o, idx) => ({ text: o.text, position: idx + 1 })),
          correct_index: newCorrectIndex,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewPrompt("");
      setNewPoints("1");
      setNewOptions([{ text: "" }, { text: "" }, { text: "" }, { text: "" }]);
      setNewCorrectIndex(0);
      await fetchAll();
    } catch (e: any) {
      setError(e.message ?? "Gagal tambah soal");
    } finally {
      setSaving(false);
    }
  }

  async function updateQuestion(q: QuestionDraft) {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/teacher/assessments/api/questions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          question_id: q.id,
          prompt: q.prompt,
          points: q.points,
          position: q.position,
          options: q.options.map((o, idx) => ({ ...o, position: idx + 1 })),
          correct_option_id: q.correctOptionId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? q : x)));
    } catch (e: any) {
      setError(e.message ?? "Gagal update soal");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!assessment) return;
    if (!confirm("Hapus soal ini?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/teacher/assessments/api/questions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          question_id: questionId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (e: any) {
      setError(e.message ?? "Gagal hapus soal");
    } finally {
      setSaving(false);
    }
  }

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
            <p className="text-sm text-rose-700">
              {error ?? "Assessment tidak ditemukan."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Edit Assessment
          </h1>
          <button
            onClick={() => router.push("/teacher/assessments")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Info Assessment</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Judul</label>
              <input
                value={assessment.title}
                onChange={(e) =>
                  setAssessment((p) => (p ? { ...p, title: e.target.value } : p))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Mapel</label>
              <input
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Contoh: Matematika / IPA / IPS"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Deskripsi</label>
              <textarea
                value={assessment.description ?? ""}
                onChange={(e) =>
                  setAssessment((p) =>
                    p ? { ...p, description: e.target.value || null } : p
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Start at</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(assessment.start_at)}
                onChange={(e) =>
                  setAssessment((p) =>
                    p
                      ? {
                          ...p,
                          start_at: fromLocalInputValue(e.target.value),
                        }
                      : p
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">End at</label>
              <input
                type="datetime-local"
                value={toLocalInputValue(assessment.end_at)}
                onChange={(e) =>
                  setAssessment((p) =>
                    p
                      ? {
                          ...p,
                          end_at: fromLocalInputValue(e.target.value),
                        }
                      : p
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Durasi (menit)
              </label>
              <input
                type="number"
                min={1}
                value={assessment.duration_minutes ?? ""}
                onChange={(e) =>
                  setAssessment((p) =>
                    p ? { ...p, duration_minutes: Number(e.target.value) || null } : p
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={assessment.is_published}
                onChange={(e) =>
                  setAssessment((p) => (p ? { ...p, is_published: e.target.checked } : p))
                }
                className="h-4 w-4 accent-sky-500"
              />
              <span className="text-sm text-slate-700">Published</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Password baru (opsional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
              <p className="mt-1 text-xs text-slate-500">
                Status: {assessment.access_password_hash ? "Ada" : "Tidak ada"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={clearPassword}
                onChange={(e) => setClearPassword(e.target.checked)}
                className="h-4 w-4 accent-rose-500"
              />
              <span className="text-sm text-slate-700">Hapus password</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={saveAssessment}
              disabled={saving}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-slate-900">Tambah Soal</h2>
          <div className="mt-4 space-y-3">
            <input
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Pertanyaan"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
            />

            <div>
              <label className="text-xs font-semibold text-slate-600">Poin</label>
              <input
                type="number"
                min={1}
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                placeholder="Poin"
                className="mt-1 w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            {newOptions.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={newCorrectIndex === idx}
                  onChange={() => setNewCorrectIndex(idx)}
                />
                <input
                  value={o.text}
                  onChange={(e) =>
                    setNewOptions((prev) =>
                      prev.map((x, i) => (i === idx ? { text: e.target.value } : x))
                    )
                  }
                  placeholder={`Opsi ${idx + 1}`}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
            ))}

            <button
              onClick={addQuestion}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Tambah Soal
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Soal {idx + 1}
                </h3>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Hapus
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  value={q.prompt}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x))
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                />

                <div className="flex gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Poin</label>
                    <input
                      type="number"
                      min={1}
                      value={q.points}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id ? { ...x, points: Number(e.target.value) || 1 } : x
                          )
                        )
                      }
                      className="mt-1 w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Urutan</label>
                    <input
                      type="number"
                      min={1}
                      value={q.position}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id ? { ...x, position: Number(e.target.value) || 1 } : x
                          )
                        )
                      }
                      className="mt-1 w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                </div>

                  {q.options.map((o, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.correctOptionId === q.options[oIdx]?.id}
                        onChange={() =>
                          setQuestions((prev) =>
                            prev.map((x) =>
                              x.id === q.id
                                ? { ...x, correctOptionId: q.options[oIdx]?.id ?? null }
                                : x
                            )
                          )
                        }
                      />
                      <input
                      value={o.text}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  options: x.options.map((oo, i) =>
                                    i === oIdx ? { ...oo, text: e.target.value } : oo
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuestion(q)}
                    disabled={saving}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    Save Soal
                  </button>
                </div>
              </div>
            </div>
          ))}

          {questions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-sm text-slate-600">Belum ada soal.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
