
CREATE TABLE public.creative_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_request_id UUID REFERENCES public.analysis_requests(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  prompt_context JSONB DEFAULT '{}'::jsonb,
  strategist_output JSONB DEFAULT '{}'::jsonb,
  image_url TEXT,
  editable_html TEXT,
  format TEXT DEFAULT '1080x1080',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own creative jobs"
  ON public.creative_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own creative jobs"
  ON public.creative_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own creative jobs"
  ON public.creative_jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_creative_jobs_updated_at
  BEFORE UPDATE ON public.creative_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
