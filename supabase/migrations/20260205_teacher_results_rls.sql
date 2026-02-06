-- Teacher results access policies
-- Assessments: owner can read; published readable by all authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'assessments' AND policyname = 'assessments_select_owner_or_published'
  ) THEN
    CREATE POLICY assessments_select_owner_or_published
      ON public.assessments
      FOR SELECT
      TO authenticated
      USING (owner_id = auth.uid() OR is_published = true);
  END IF;
END$$;

-- Attempts: student can read own attempts; teacher can read attempts for owned assessments
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
          SELECT 1
          FROM public.assessments a
          WHERE a.id = attempts.assessment_id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Profiles: user can read own profile; teacher can read profiles of students who attempted their assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_self_or_teacher'
  ) THEN
    CREATE POLICY profiles_select_self_or_teacher
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.attempts at
          JOIN public.assessments a ON a.id = at.assessment_id
          WHERE at.student_id = profiles.id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;
