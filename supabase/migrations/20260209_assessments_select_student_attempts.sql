-- Allow students to read assessments they have attempted (even if unpublished)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assessments'
      AND policyname = 'assessments_select_student_attempts'
  ) THEN
    CREATE POLICY assessments_select_student_attempts
      ON public.assessments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.attempts at
          WHERE at.assessment_id = assessments.id
            AND at.student_id = auth.uid()
        )
      );
  END IF;
END$$;
