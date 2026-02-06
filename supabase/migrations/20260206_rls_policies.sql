-- Minimal RLS policies

-- enable RLS
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;

-- subjects: read for all authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_select_all'
  ) THEN
    CREATE POLICY subjects_select_all
      ON public.subjects
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END$$;

-- subjects: allow insert for authenticated (teacher can create new subject names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_insert_authenticated'
  ) THEN
    CREATE POLICY subjects_insert_authenticated
      ON public.subjects
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END$$;

-- profiles: read own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_self'
  ) THEN
    CREATE POLICY profiles_select_self
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END$$;

-- assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_select_published_or_owner'
  ) THEN
    CREATE POLICY assessments_select_published_or_owner
      ON public.assessments
      FOR SELECT
      TO authenticated
      USING (is_published = true OR owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_insert_owner'
  ) THEN
    CREATE POLICY assessments_insert_owner
      ON public.assessments
      FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_update_owner'
  ) THEN
    CREATE POLICY assessments_update_owner
      ON public.assessments
      FOR UPDATE
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_delete_owner'
  ) THEN
    CREATE POLICY assessments_delete_owner
      ON public.assessments
      FOR DELETE
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END$$;

-- questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_select_owner'
  ) THEN
    CREATE POLICY questions_select_owner
      ON public.questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_insert_owner'
  ) THEN
    CREATE POLICY questions_insert_owner
      ON public.questions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_update_owner'
  ) THEN
    CREATE POLICY questions_update_owner
      ON public.questions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_delete_owner'
  ) THEN
    CREATE POLICY questions_delete_owner
      ON public.questions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_select_student'
  ) THEN
    CREATE POLICY questions_select_student
      ON public.questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.is_published = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.attempts at
          WHERE at.assessment_id = questions.assessment_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;

-- options
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_select_owner'
  ) THEN
    CREATE POLICY options_select_owner
      ON public.options
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_insert_owner'
  ) THEN
    CREATE POLICY options_insert_owner
      ON public.options
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_update_owner'
  ) THEN
    CREATE POLICY options_update_owner
      ON public.options
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_delete_owner'
  ) THEN
    CREATE POLICY options_delete_owner
      ON public.options
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_select_student'
  ) THEN
    CREATE POLICY options_select_student
      ON public.options
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.is_published = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.attempts at ON at.assessment_id = q.assessment_id
          WHERE q.id = options.question_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;

-- answer_keys (teacher owner only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_select_owner'
  ) THEN
    CREATE POLICY answer_keys_select_owner
      ON public.answer_keys
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_insert_owner'
  ) THEN
    CREATE POLICY answer_keys_insert_owner
      ON public.answer_keys
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_update_owner'
  ) THEN
    CREATE POLICY answer_keys_update_owner
      ON public.answer_keys
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_delete_owner'
  ) THEN
    CREATE POLICY answer_keys_delete_owner
      ON public.answer_keys
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;

-- attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_select_owner_or_student'
  ) THEN
    CREATE POLICY attempts_select_owner_or_student
      ON public.attempts
      FOR SELECT
      TO authenticated
      USING (
        student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = attempts.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_insert_student'
  ) THEN
    CREATE POLICY attempts_insert_student
      ON public.attempts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = attempts.assessment_id
            AND a.is_published = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_update_student'
  ) THEN
    CREATE POLICY attempts_update_student
      ON public.attempts
      FOR UPDATE
      TO authenticated
      USING (student_id = auth.uid())
      WITH CHECK (student_id = auth.uid());
  END IF;
END$$;

-- responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_select_owner_or_student'
  ) THEN
    CREATE POLICY responses_select_owner_or_student
      ON public.responses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.attempts at
          JOIN public.assessments a ON a.id = at.assessment_id
          WHERE at.id = responses.attempt_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_insert_student'
  ) THEN
    CREATE POLICY responses_insert_student
      ON public.responses
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_update_student'
  ) THEN
    CREATE POLICY responses_update_student
      ON public.responses
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;
-- Minimal RLS policies

-- enable RLS
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;

-- subjects: read for all authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_select_all'
  ) THEN
    CREATE POLICY subjects_select_all
      ON public.subjects
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END$$;

-- subjects: allow insert for authenticated (teacher can create new subject names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_insert_authenticated'
  ) THEN
    CREATE POLICY subjects_insert_authenticated
      ON public.subjects
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END$$;

-- profiles: read own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_self'
  ) THEN
    CREATE POLICY profiles_select_self
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END$$;

-- assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_select_published_or_owner'
  ) THEN
    CREATE POLICY assessments_select_published_or_owner
      ON public.assessments
      FOR SELECT
      TO authenticated
      USING (is_published = true OR owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_insert_owner'
  ) THEN
    CREATE POLICY assessments_insert_owner
      ON public.assessments
      FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_update_owner'
  ) THEN
    CREATE POLICY assessments_update_owner
      ON public.assessments
      FOR UPDATE
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_delete_owner'
  ) THEN
    CREATE POLICY assessments_delete_owner
      ON public.assessments
      FOR DELETE
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END$$;

-- questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_select_owner'
  ) THEN
    CREATE POLICY questions_select_owner
      ON public.questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_insert_owner'
  ) THEN
    CREATE POLICY questions_insert_owner
      ON public.questions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_update_owner'
  ) THEN
    CREATE POLICY questions_update_owner
      ON public.questions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_delete_owner'
  ) THEN
    CREATE POLICY questions_delete_owner
      ON public.questions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_select_student'
  ) THEN
    CREATE POLICY questions_select_student
      ON public.questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.assessments a
          WHERE a.id = questions.assessment_id
            AND a.is_published = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.attempts at
          WHERE at.assessment_id = questions.assessment_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;

-- options
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_select_owner'
  ) THEN
    CREATE POLICY options_select_owner
      ON public.options
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_insert_owner'
  ) THEN
    CREATE POLICY options_insert_owner
      ON public.options
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_update_owner'
  ) THEN
    CREATE POLICY options_update_owner
      ON public.options
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_delete_owner'
  ) THEN
    CREATE POLICY options_delete_owner
      ON public.options
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'options' AND policyname = 'options_select_student'
  ) THEN
    CREATE POLICY options_select_student
      ON public.options
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = options.question_id
            AND a.is_published = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.attempts at ON at.assessment_id = q.assessment_id
          WHERE q.id = options.question_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;

-- answer_keys (teacher owner only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_select_owner'
  ) THEN
    CREATE POLICY answer_keys_select_owner
      ON public.answer_keys
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_insert_owner'
  ) THEN
    CREATE POLICY answer_keys_insert_owner
      ON public.answer_keys
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_update_owner'
  ) THEN
    CREATE POLICY answer_keys_update_owner
      ON public.answer_keys
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'answer_keys' AND policyname = 'answer_keys_delete_owner'
  ) THEN
    CREATE POLICY answer_keys_delete_owner
      ON public.answer_keys
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.questions q
          JOIN public.assessments a ON a.id = q.assessment_id
          WHERE q.id = answer_keys.question_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;

-- attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_select_owner_or_student'
  ) THEN
    CREATE POLICY attempts_select_owner_or_student
      ON public.attempts
      FOR SELECT
      TO authenticated
      USING (
        student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = attempts.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_insert_student'
  ) THEN
    CREATE POLICY attempts_insert_student
      ON public.attempts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.assessments a
          WHERE a.id = attempts.assessment_id
            AND a.is_published = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attempts' AND policyname = 'attempts_update_student'
  ) THEN
    CREATE POLICY attempts_update_student
      ON public.attempts
      FOR UPDATE
      TO authenticated
      USING (student_id = auth.uid())
      WITH CHECK (student_id = auth.uid());
  END IF;
END$$;

-- responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_select_owner_or_student'
  ) THEN
    CREATE POLICY responses_select_owner_or_student
      ON public.responses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.attempts at
          JOIN public.assessments a ON a.id = at.assessment_id
          WHERE at.id = responses.attempt_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_insert_student'
  ) THEN
    CREATE POLICY responses_insert_student
      ON public.responses
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'responses' AND policyname = 'responses_update_student'
  ) THEN
    CREATE POLICY responses_update_student
      ON public.responses
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.attempts at
          WHERE at.id = responses.attempt_id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;
