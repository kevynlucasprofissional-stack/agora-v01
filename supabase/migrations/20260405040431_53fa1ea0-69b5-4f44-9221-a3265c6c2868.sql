
-- 1. Fix external_integrations: Split ALL policy into granular policies
-- Remove the broad ALL policy that lets enterprise admins access tokens
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.external_integrations;

-- Keep the existing read policy (it's already there)
-- DROP and recreate to ensure consistency
DROP POLICY IF EXISTS "Users can read own integrations" ON public.external_integrations;

-- SELECT: owners see everything, enterprise admins see metadata only (no tokens)
-- We use column-level grants for this via a restricted view approach
-- Instead, split into owner-only for token access

-- Recreate SELECT policy: everyone with access can read non-token columns
-- But we restrict token columns at the grant level
REVOKE SELECT ON public.external_integrations FROM authenticated;

-- Grant SELECT on all columns EXCEPT token columns to authenticated
GRANT SELECT (id, user_id, enterprise_id, provider, status, external_account_id, metadata, expires_at, created_at, updated_at) ON public.external_integrations TO authenticated;

-- Grant token columns only via service_role (edge functions already use service_role)
-- No need to grant token columns to authenticated at all

-- Recreate SELECT policy (unchanged logic, but tokens are now hidden at column level)
CREATE POLICY "Users can read own integrations"
ON public.external_integrations
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM enterprise_members em
    WHERE em.enterprise_id = external_integrations.enterprise_id
    AND em.user_id = auth.uid()
    AND em.is_admin = true
  ))
);

-- INSERT: only the owning user
CREATE POLICY "Users can insert own integrations"
ON public.external_integrations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: only the owning user
CREATE POLICY "Users can update own integrations"
ON public.external_integrations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: only the owning user
CREATE POLICY "Users can delete own integrations"
ON public.external_integrations
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 2. Add explicit storage UPDATE policy for agora-files
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'agora-files' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'agora-files' AND auth.uid()::text = (storage.foldername(name))[1]);
