-- Teacher feedback per attempt (one-way message)
create table if not exists public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id)
);

create index if not exists teacher_feedback_attempt_id_idx on public.teacher_feedback(attempt_id);
create index if not exists teacher_feedback_student_id_idx on public.teacher_feedback(student_id);

alter table public.teacher_feedback enable row level security;

-- Teacher can read/write feedback for their own assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_feedback'
      AND policyname = 'teacher_feedback_teacher_rw'
  ) THEN
    CREATE POLICY teacher_feedback_teacher_rw
      ON public.teacher_feedback
      FOR ALL
      TO authenticated
      USING (
        teacher_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.assessments a
          WHERE a.id = teacher_feedback.assessment_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        teacher_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.assessments a
          WHERE a.id = teacher_feedback.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Student can read own feedback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_feedback'
      AND policyname = 'teacher_feedback_student_read'
  ) THEN
    CREATE POLICY teacher_feedback_student_read
      ON public.teacher_feedback
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END$$;
