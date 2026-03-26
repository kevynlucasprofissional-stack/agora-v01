
-- Table to persist workspace artboards
CREATE TABLE public.workspace_artboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Artboard',
  format text NOT NULL DEFAULT '1080x1080',
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  z_index integer NOT NULL DEFAULT 0,
  layers_state jsonb DEFAULT NULL,
  thumbnail text DEFAULT NULL,
  creative_job_id uuid REFERENCES public.creative_jobs(id) ON DELETE SET NULL DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.workspace_artboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own artboards" ON public.workspace_artboards
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_updated_at_workspace_artboards
  BEFORE UPDATE ON public.workspace_artboards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
