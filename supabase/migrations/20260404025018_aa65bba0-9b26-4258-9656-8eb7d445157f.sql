-- Enum for run status
CREATE TYPE public.run_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Enum for step kind
CREATE TYPE public.run_step_kind AS ENUM (
  'intake',
  'sociobehavioral',
  'offer_analysis',
  'performance_timing',
  'synthesis',
  'image_generation',
  'post_processing'
);

-- Analysis runs table
CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_request_id uuid NOT NULL REFERENCES public.analysis_requests(id) ON DELETE CASCADE,
  status public.run_status NOT NULL DEFAULT 'pending',
  model_primary text,
  model_fallback text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Run steps table
CREATE TABLE public.run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  step_kind public.run_step_kind NOT NULL,
  step_order smallint NOT NULL DEFAULT 0,
  status public.run_status NOT NULL DEFAULT 'pending',
  agent_kind public.agent_kind,
  input_payload jsonb DEFAULT '{}'::jsonb,
  output_payload jsonb DEFAULT '{}'::jsonb,
  model_used text,
  tokens_input integer,
  tokens_output integer,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_analysis_runs_request ON public.analysis_runs(analysis_request_id);
CREATE INDEX idx_run_steps_run ON public.run_steps(run_id);

-- Enable RLS
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_steps ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own runs (via analysis_requests ownership)
CREATE POLICY "Users can read own analysis runs"
ON public.analysis_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.analysis_requests ar
    WHERE ar.id = analysis_runs.analysis_request_id
    AND ar.user_id = auth.uid()
  )
);

-- RLS: Users can read steps of their own runs
CREATE POLICY "Users can read own run steps"
ON public.run_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.analysis_runs r
    JOIN public.analysis_requests ar ON ar.id = r.analysis_request_id
    WHERE r.id = run_steps.run_id
    AND ar.user_id = auth.uid()
  )
);

-- Updated_at trigger for analysis_runs
CREATE TRIGGER update_analysis_runs_updated_at
BEFORE UPDATE ON public.analysis_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();