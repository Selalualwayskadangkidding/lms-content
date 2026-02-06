-- Teacher results view (optional)
create or replace view public.teacher_results as
select
  at.id as attempt_id,
  at.assessment_id,
  at.student_id,
  at.status,
  at.started_at,
  at.submitted_at,
  at.score,
  p.name as student_name,
  p.nis as student_nis,
  s.correct,
  s.wrong,
  s.blank,
  s.total,
  s.score as computed_score
from public.attempts at
left join public.profiles p on p.id = at.student_id
left join lateral public.score_attempt(at.id) s on true;

grant select on public.teacher_results to authenticated;
