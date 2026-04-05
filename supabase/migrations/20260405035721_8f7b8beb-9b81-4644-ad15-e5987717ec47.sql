
-- 1. Protect plan-related columns on profiles from client-side modification
CREATE OR REPLACE FUNCTION public.protect_plan_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If called by service_role, allow all changes
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Prevent changes to plan-related columns from authenticated users
  IF NEW.current_plan_id IS DISTINCT FROM OLD.current_plan_id THEN
    NEW.current_plan_id := OLD.current_plan_id;
  END IF;

  IF NEW.original_plan_id IS DISTINCT FROM OLD.original_plan_id THEN
    NEW.original_plan_id := OLD.original_plan_id;
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profiles_plan_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_plan_columns();

-- 2. Revoke SELECT on system_prompt from authenticated role
REVOKE SELECT ON public.agents FROM authenticated;

-- Re-grant SELECT on all columns EXCEPT system_prompt
GRANT SELECT (id, code, display_name, description, is_active, created_at, updated_at) ON public.agents TO authenticated;
