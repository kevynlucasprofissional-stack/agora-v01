
-- Add trial columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_plan_id bigint DEFAULT NULL;

-- Update the handle_new_user trigger function to assign standard plan + 15 day trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare 
  standard_plan_id bigint;
  freemium_plan_id bigint;
begin
  select id into standard_plan_id from public.plans where code = 'standard' limit 1;
  select id into freemium_plan_id from public.plans where code = 'freemium' limit 1;
  
  insert into public.profiles (id, full_name, email, current_plan_id, original_plan_id, trial_ends_at)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data ->> 'full_name', ''), 
    new.email, 
    coalesce(standard_plan_id, freemium_plan_id),
    freemium_plan_id,
    now() + interval '15 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
