-- 1. Revoke SELECT on token columns from authenticated users
REVOKE SELECT (encrypted_access_token, encrypted_refresh_token) ON public.external_integrations FROM authenticated;

-- 2. Add DELETE policy for creative_jobs
CREATE POLICY "Users can delete own creative jobs"
ON public.creative_jobs
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 3. Remove realtime publication for sensitive tables
DO $$
BEGIN
  -- Try to drop each table from publication, ignore if not present
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.analysis_requests;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.analysis_runs;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.run_steps;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;