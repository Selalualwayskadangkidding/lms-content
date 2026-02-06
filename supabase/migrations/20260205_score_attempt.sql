create or replace function public.score_attempt(p_attempt_id uuid)
returns table(correct int, wrong int, blank int, total int, score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_id uuid;
begin
  select assessment_id into v_assessment_id
  from public.attempts
  where id = p_attempt_id;

  if v_assessment_id is null then
    return;
  end if;

  return query
  with q as (
    select id from public.questions where assessment_id = v_assessment_id
  ),
  r as (
    select question_id, selected_option_id
    from public.responses
    where attempt_id = p_attempt_id
  ),
  k as (
    select question_id, correct_option_id
    from public.answer_keys
    where question_id in (select id from q)
  ),
  joined as (
    select q.id as question_id,
           r.selected_option_id,
           k.correct_option_id
    from q
    left join r on r.question_id = q.id
    left join k on k.question_id = q.id
  )
  select
    count(*) filter (where selected_option_id is not null and selected_option_id = correct_option_id)::int as correct,
    count(*) filter (where selected_option_id is not null and selected_option_id <> correct_option_id)::int as wrong,
    count(*) filter (where selected_option_id is null)::int as blank,
    count(*)::int as total,
    count(*) filter (where selected_option_id is not null and selected_option_id = correct_option_id)::int as score
  from joined;
end;
$$;

grant execute on function public.score_attempt(uuid) to authenticated;
