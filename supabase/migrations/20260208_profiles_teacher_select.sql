-- Allow teachers to read profiles for students who attempted their assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_teacher_for_attempts'
  ) THEN
    CREATE POLICY profiles_select_teacher_for_attempts
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.attempts at
          JOIN public.assessments a ON a.id = at.assessment_id
          WHERE at.student_id = profiles.id
            AND a.owner_id = auth.uid()
        )
      );
  END IF;
END$$;
