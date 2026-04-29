
-- Enums
create type public.dose_status as enum ('pending', 'taken', 'missed', 'snoozed');
create type public.frequency_type as enum ('daily', 'alternate', 'weekdays', 'interval');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  email_reminders_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Medicines
create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text not null,
  notes text,
  times text[] not null default '{}',
  frequency_type public.frequency_type not null default 'daily',
  frequency_config jsonb not null default '{}'::jsonb,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.medicines enable row level security;

create policy "Users view own medicines" on public.medicines for select using (auth.uid() = user_id);
create policy "Users insert own medicines" on public.medicines for insert with check (auth.uid() = user_id);
create policy "Users update own medicines" on public.medicines for update using (auth.uid() = user_id);
create policy "Users delete own medicines" on public.medicines for delete using (auth.uid() = user_id);

create index medicines_user_idx on public.medicines(user_id);

-- Dose logs
create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  scheduled_for timestamptz not null,
  status public.dose_status not null default 'pending',
  taken_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (medicine_id, scheduled_for)
);
alter table public.dose_logs enable row level security;

create policy "Users view own dose logs" on public.dose_logs for select using (auth.uid() = user_id);
create policy "Users insert own dose logs" on public.dose_logs for insert with check (auth.uid() = user_id);
create policy "Users update own dose logs" on public.dose_logs for update using (auth.uid() = user_id);
create policy "Users delete own dose logs" on public.dose_logs for delete using (auth.uid() = user_id);

create index dose_logs_user_scheduled_idx on public.dose_logs(user_id, scheduled_for);
create index dose_logs_pending_idx on public.dose_logs(scheduled_for) where status = 'pending';

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
