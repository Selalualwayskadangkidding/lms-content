-- Fix recursive RLS by using a SECURITY DEFINER function
create or replace function public.has_attempted_assessment(p_assessment_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.attempts at
    where at.assessment_id = p_assessment_id
      and at.student_id = auth.uid()
  );
$$;

revoke all on function public.has_attempted_assessment(uuid) from public;
grant execute on function public.has_attempted_assessment(uuid) to authenticated;

drop policy if exists assessments_select_student_attempts on public.assessments;

create policy assessments_select_student_attempts
  on public.assessments
  for select
  to authenticated
  using (public.has_attempted_assessment(assessments.id));
