-- Allow students to read teacher profiles for published assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_students_for_assessments'
  ) THEN
    CREATE POLICY profiles_select_students_for_assessments
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        profiles.role = 'TEACHER'
        AND EXISTS (
          SELECT 1
          FROM public.assessments a
          WHERE a.owner_id = profiles.id
            AND a.is_published = true
        )
      );
  END IF;
END$$;
