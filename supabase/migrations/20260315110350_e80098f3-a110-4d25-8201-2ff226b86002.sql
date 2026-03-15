
-- Extensões
create extension if not exists pgcrypto;

-- Tipos
do $$ begin
  create type public.plan_code as enum ('freemium', 'standard', 'pro', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.analysis_status as enum (
    'draft', 'awaiting_clarification', 'processing', 'completed', 'failed', 'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.agent_kind as enum (
    'master_orchestrator', 'sociobehavioral', 'offer_engineer', 'performance_scientist', 'chief_strategist'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.response_format as enum ('json', 'markdown', 'text');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.upload_kind as enum (
    'user_input', 'analysis_attachment', 'generated_report', 'generated_asset'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.feedback_type as enum ('like', 'dislike');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.integration_provider as enum (
    'stripe', 'openai', 'anthropic', 'serper', 'ibge', 'meta_ads', 'ga4', 'canva', 'gamma'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.integration_status as enum (
    'disconnected', 'pending', 'connected', 'error'
  );
exception when duplicate_object then null;
end $$;

-- Timestamp helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Planos
create table if not exists public.plans (
  id bigserial primary key,
  code public.plan_code unique not null,
  name text not null,
  description text,
  price_monthly numeric(10,2) not null default 0,
  price_yearly numeric(10,2),
  uploads_limit_daily integer not null,
  synthetic_audience_enabled boolean not null default false,
  advanced_templates_enabled boolean not null default false,
  enterprise_integrations_enabled boolean not null default false,
  reports_level text not null default 'basic',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at before update on public.plans for each row execute function public.set_updated_at();

insert into public.plans
  (code, name, description, price_monthly, price_yearly, uploads_limit_daily, synthetic_audience_enabled, advanced_templates_enabled, enterprise_integrations_enabled, reports_level)
values
  ('freemium', 'Freemium', 'Plano inicial com análise básica e limite diário de uploads', 0, 0, 2, false, false, false, 'basic'),
  ('standard', 'Standard', 'Plano intermediário com audiência sintética geracional', 97, 970, 5, true, false, false, 'complete'),
  ('pro', 'Pro', 'Plano avançado com uploads ilimitados e recursos premium', 197, 1970, 999999, true, true, false, 'complete'),
  ('enterprise', 'Enterprise', 'Plano corporativo com integrações externas e contexto por empresa', 997, 9970, 999999, true, true, true, 'enterprise')
on conflict (code) do update
set name = excluded.name, description = excluded.description,
    price_monthly = excluded.price_monthly, price_yearly = excluded.price_yearly,
    uploads_limit_daily = excluded.uploads_limit_daily,
    synthetic_audience_enabled = excluded.synthetic_audience_enabled,
    advanced_templates_enabled = excluded.advanced_templates_enabled,
    enterprise_integrations_enabled = excluded.enterprise_integrations_enabled,
    reports_level = excluded.reports_level, updated_at = now();

-- Perfis
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  avatar_url text,
  company_name text,
  role_title text,
  onboarding_completed boolean not null default false,
  current_plan_id bigint not null references public.plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare freemium_plan_id bigint;
begin
  select id into freemium_plan_id from public.plans where code = 'freemium' limit 1;
  insert into public.profiles (id, full_name, email, current_plan_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, freemium_plan_id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Enterprises
create table if not exists public.enterprises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text unique,
  slug text unique,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_enterprises_updated_at on public.enterprises;
create trigger trg_enterprises_updated_at before update on public.enterprises for each row execute function public.set_updated_at();

create table if not exists public.enterprise_members (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.enterprises(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (enterprise_id, user_id)
);

-- Analysis requests
create table if not exists public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  enterprise_id uuid references public.enterprises(id) on delete set null,
  title text,
  raw_prompt text not null,
  normalized_payload jsonb,
  missing_variables jsonb,
  clarification_questions jsonb,
  industry text,
  region text,
  declared_target_audience text,
  primary_channel text,
  metrics_snapshot jsonb,
  status public.analysis_status not null default 'draft',
  score_overall numeric(5,2),
  score_sociobehavioral numeric(5,2),
  score_offer numeric(5,2),
  score_performance numeric(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_analysis_requests_updated_at on public.analysis_requests;
create trigger trg_analysis_requests_updated_at before update on public.analysis_requests for each row execute function public.set_updated_at();

-- Files
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_request_id uuid references public.analysis_requests(id) on delete cascade,
  enterprise_id uuid references public.enterprises(id) on delete set null,
  kind public.upload_kind not null default 'user_input',
  bucket_name text not null default 'agora-files',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Agents catalog
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  code public.agent_kind unique not null,
  display_name text not null,
  description text,
  system_prompt text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at before update on public.agents for each row execute function public.set_updated_at();

insert into public.agents (code, display_name, description)
values
  ('master_orchestrator', 'Agente Orquestrador Master', 'Normaliza intake, detecta variáveis faltantes e roteia a análise'),
  ('sociobehavioral', 'Analista Sociocomportamental', 'Classifica era do marketing, geração, neuromarketing e canais'),
  ('offer_engineer', 'Engenheiro de Oferta', 'Avalia proposta de valor, fricção, credibilidade e latência'),
  ('performance_scientist', 'Cientista de Performance', 'Audita KPIs, benchmark e timing index'),
  ('chief_strategist', 'Estrategista-Chefe', 'Consolida o relatório executivo e a campanha otimizada')
on conflict (code) do update
set display_name = excluded.display_name, description = excluded.description, updated_at = now();

-- Agent responses
create table if not exists public.agent_responses (
  id bigserial primary key,
  analysis_request_id uuid not null references public.analysis_requests(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  response_format public.response_format not null default 'json',
  content jsonb,
  content_text text,
  tokens_input integer,
  tokens_output integer,
  latency_ms integer,
  model_name text,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now(),
  check ((content is not null) or (content_text is not null))
);

-- Generated outputs
create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  analysis_request_id uuid not null references public.analysis_requests(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  output_type text not null,
  title text,
  content_markdown text,
  file_url text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Feedback
create table if not exists public.analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  analysis_request_id uuid not null references public.analysis_requests(id) on delete cascade,
  agent_response_id bigint references public.agent_responses(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback public.feedback_type not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (analysis_request_id, user_id)
);

-- External integrations
create table if not exists public.external_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  enterprise_id uuid references public.enterprises(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'disconnected',
  external_account_id text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or enterprise_id is not null)
);

drop trigger if exists trg_external_integrations_updated_at on public.external_integrations;
create trigger trg_external_integrations_updated_at before update on public.external_integrations for each row execute function public.set_updated_at();

-- Daily usage counters
create table if not exists public.daily_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  uploads_count integer not null default 0,
  analyses_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

drop trigger if exists trg_daily_usage_counters_updated_at on public.daily_usage_counters;
create trigger trg_daily_usage_counters_updated_at before update on public.daily_usage_counters for each row execute function public.set_updated_at();

-- Upload limit check
create or replace function public.check_upload_limit(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  select p.uploads_limit_daily into v_limit
  from public.profiles pr join public.plans p on p.id = pr.current_plan_id where pr.id = p_user_id;
  if v_limit is null then return false; end if;
  select count(*) into v_count from public.files f
  where f.user_id = p_user_id and f.kind in ('user_input', 'analysis_attachment')
    and (f.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
  return v_count < v_limit;
end;
$$;

-- Indexes
create index if not exists idx_profiles_plan on public.profiles(current_plan_id);
create index if not exists idx_analysis_requests_user on public.analysis_requests(user_id);
create index if not exists idx_analysis_requests_enterprise on public.analysis_requests(enterprise_id);
create index if not exists idx_analysis_requests_status on public.analysis_requests(status);
create index if not exists idx_files_user on public.files(user_id);
create index if not exists idx_files_analysis_request on public.files(analysis_request_id);
create index if not exists idx_agent_responses_request on public.agent_responses(analysis_request_id);
create index if not exists idx_agent_responses_agent on public.agent_responses(agent_id);
create index if not exists idx_generated_outputs_request on public.generated_outputs(analysis_request_id);
create index if not exists idx_feedback_request on public.analysis_feedback(analysis_request_id);
create index if not exists idx_external_integrations_user on public.external_integrations(user_id);
create index if not exists idx_external_integrations_enterprise on public.external_integrations(enterprise_id);
create index if not exists idx_agent_responses_content_gin on public.agent_responses using gin (content);
create index if not exists idx_analysis_requests_payload_gin on public.analysis_requests using gin (normalized_payload);

-- RLS
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.enterprises enable row level security;
alter table public.enterprise_members enable row level security;
alter table public.analysis_requests enable row level security;
alter table public.files enable row level security;
alter table public.agents enable row level security;
alter table public.agent_responses enable row level security;
alter table public.generated_outputs enable row level security;
alter table public.analysis_feedback enable row level security;
alter table public.external_integrations enable row level security;
alter table public.daily_usage_counters enable row level security;

-- Policies
create policy "Authenticated users can read plans" on public.plans for select to authenticated using (true);
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Enterprise members can read enterprise" on public.enterprises for select to authenticated
using (exists (select 1 from public.enterprise_members em where em.enterprise_id = enterprises.id and em.user_id = auth.uid()));
create policy "Enterprise admins can update enterprise" on public.enterprises for update to authenticated
using (exists (select 1 from public.enterprise_members em where em.enterprise_id = enterprises.id and em.user_id = auth.uid() and em.is_admin = true))
with check (exists (select 1 from public.enterprise_members em where em.enterprise_id = enterprises.id and em.user_id = auth.uid() and em.is_admin = true));

create policy "Enterprise members can read membership" on public.enterprise_members for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.enterprise_members em where em.enterprise_id = enterprise_members.enterprise_id and em.user_id = auth.uid() and em.is_admin = true));

create policy "Users can read own analysis requests" on public.analysis_requests for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own analysis requests" on public.analysis_requests for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own analysis requests" on public.analysis_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own analysis requests" on public.analysis_requests for delete to authenticated using (user_id = auth.uid());

create policy "Users can read own files" on public.files for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own files" on public.files for insert to authenticated with check (user_id = auth.uid());
create policy "Users can delete own files" on public.files for delete to authenticated using (user_id = auth.uid());

create policy "Authenticated users can read agents" on public.agents for select to authenticated using (true);

create policy "Users can read own agent responses" on public.agent_responses for select to authenticated
using (exists (select 1 from public.analysis_requests ar where ar.id = agent_responses.analysis_request_id and ar.user_id = auth.uid()));

create policy "Users can read own generated outputs" on public.generated_outputs for select to authenticated
using (exists (select 1 from public.analysis_requests ar where ar.id = generated_outputs.analysis_request_id and ar.user_id = auth.uid()));

create policy "Users can read own feedback" on public.analysis_feedback for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own feedback" on public.analysis_feedback for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own feedback" on public.analysis_feedback for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read own integrations" on public.external_integrations for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.enterprise_members em where em.enterprise_id = external_integrations.enterprise_id and em.user_id = auth.uid() and em.is_admin = true));
create policy "Users can manage own integrations" on public.external_integrations for all to authenticated
using (user_id = auth.uid() or exists (select 1 from public.enterprise_members em where em.enterprise_id = external_integrations.enterprise_id and em.user_id = auth.uid() and em.is_admin = true))
with check (user_id = auth.uid() or exists (select 1 from public.enterprise_members em where em.enterprise_id = external_integrations.enterprise_id and em.user_id = auth.uid() and em.is_admin = true));

create policy "Users can read own daily usage counters" on public.daily_usage_counters for select to authenticated using (user_id = auth.uid());

-- Storage
insert into storage.buckets (id, name, public) values ('agora-files', 'agora-files', false) on conflict (id) do nothing;

create policy "Users can upload own storage files" on storage.objects for insert to authenticated
with check (bucket_id = 'agora-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read own storage files" on storage.objects for select to authenticated
using (bucket_id = 'agora-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own storage files" on storage.objects for delete to authenticated
using (bucket_id = 'agora-files' and auth.uid()::text = (storage.foldername(name))[1]);
