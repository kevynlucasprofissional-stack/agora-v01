
-- Index for fast lookup of steps by run
CREATE INDEX IF NOT EXISTS idx_run_steps_run_id_step_kind
  ON public.run_steps (run_id, step_kind);

-- Index for polling / listing runs by status
CREATE INDEX IF NOT EXISTS idx_analysis_runs_status_created
  ON public.analysis_runs (status, created_at DESC);
