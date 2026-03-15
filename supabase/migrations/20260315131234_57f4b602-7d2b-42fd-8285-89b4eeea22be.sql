-- Allow authenticated users to insert their own generated outputs
CREATE POLICY "Users can insert own generated outputs"
ON public.generated_outputs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM analysis_requests ar
    WHERE ar.id = generated_outputs.analysis_request_id
    AND ar.user_id = auth.uid()
  )
);

-- Allow authenticated users to update their own generated outputs
CREATE POLICY "Users can update own generated outputs"
ON public.generated_outputs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM analysis_requests ar
    WHERE ar.id = generated_outputs.analysis_request_id
    AND ar.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM analysis_requests ar
    WHERE ar.id = generated_outputs.analysis_request_id
    AND ar.user_id = auth.uid()
  )
);