DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analysis_feedback_unique_user_analysis'
  ) THEN
    ALTER TABLE public.analysis_feedback ADD CONSTRAINT analysis_feedback_unique_user_analysis UNIQUE (analysis_request_id, user_id);
  END IF;
END $$;