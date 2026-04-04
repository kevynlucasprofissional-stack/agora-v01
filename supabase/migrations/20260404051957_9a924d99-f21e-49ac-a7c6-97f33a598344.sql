-- Rate limiting table: stores request counts per user per function per time window
CREATE TABLE public.rate_limit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by user + function + time
CREATE INDEX idx_rate_limit_log_lookup 
ON public.rate_limit_log (user_id, function_name, created_at DESC);

-- Auto-cleanup: delete entries older than 1 hour (keeps table small)
CREATE INDEX idx_rate_limit_log_cleanup 
ON public.rate_limit_log (created_at);

-- Enable RLS 
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No client access - only service_role can read/write
CREATE POLICY "Deny all for authenticated" ON public.rate_limit_log
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- RPC function: atomically log request and check if over limit
-- Returns true if request is ALLOWED, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_max_requests INT DEFAULT 30,
  p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Count recent requests in window
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at >= v_window_start;
  
  -- If over limit, deny
  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Log this request
  INSERT INTO public.rate_limit_log (user_id, function_name)
  VALUES (p_user_id, p_function_name);
  
  -- Cleanup old entries (older than 2 hours) - non-blocking
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - INTERVAL '2 hours';
  
  RETURN TRUE;
END;
$$;