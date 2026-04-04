-- Block authenticated users from writing to daily_usage_counters
-- Only service_role should manage these counters

CREATE POLICY "Deny insert for authenticated users"
ON public.daily_usage_counters
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny update for authenticated users"
ON public.daily_usage_counters
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for authenticated users"
ON public.daily_usage_counters
FOR DELETE
TO authenticated
USING (false);