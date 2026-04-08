-- Add analysis_runs to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_runs;

-- Watchdog function: finalize orphan runs stuck in 'running' > 15 min
CREATE OR REPLACE FUNCTION public.finalize_orphan_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  -- Fail orphan runs
  UPDATE public.analysis_runs
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'Watchdog: orphan run finalized'),
    completed_at = now(),
    updated_at = now()
  WHERE status = 'running'
    AND created_at < now() - interval '15 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Also fail their pending/running steps
  UPDATE public.run_steps
  SET
    status = 'failed',
    error_message = COALESCE(error_message, 'Parent run finalized by watchdog'),
    completed_at = now(),
    duration_ms = COALESCE(duration_ms, 0)
  WHERE status IN ('pending', 'running')
    AND run_id IN (
      SELECT id FROM public.analysis_runs
      WHERE status = 'failed'
        AND error_message LIKE '%Watchdog%'
        AND updated_at > now() - interval '1 minute'
    );

  RETURN affected;
END;
$$;
