CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare 
  pro_plan_id bigint;
  freemium_plan_id bigint;
begin
  select id into pro_plan_id from public.plans where code = 'pro' limit 1;
  select id into freemium_plan_id from public.plans where code = 'freemium' limit 1;
  
  insert into public.profiles (id, full_name, email, current_plan_id, original_plan_id, trial_ends_at)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data ->> 'full_name', ''), 
    new.email, 
    coalesce(pro_plan_id, freemium_plan_id),
    freemium_plan_id,
    now() + interval '15 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;