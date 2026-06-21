create table if not exists public.users (
  id text primary key,
  name text not null
);

create table if not exists public.expenses (
  id text primary key,
  description text not null,
  amount numeric not null check (amount > 0),
  paid_by text not null references public.users(id) on delete restrict,
  date text not null,
  category text not null check (category in ('餐饮', '购物', '居住', '交通', '娱乐', '其他')),
  settled_at text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses(date desc);
create index if not exists expenses_settled_at_idx on public.expenses(settled_at desc);

create table if not exists public.auth_users (
  id text primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.expenses enable row level security;
alter table public.auth_users enable row level security;

drop policy if exists "accountbuddy users read" on public.users;
drop policy if exists "accountbuddy users write" on public.users;
drop policy if exists "accountbuddy expenses read" on public.expenses;
drop policy if exists "accountbuddy expenses write" on public.expenses;
drop policy if exists "accountbuddy auth users locked" on public.auth_users;

create policy "accountbuddy users read"
  on public.users
  for select
  to authenticated
  using (true);

create policy "accountbuddy users write"
  on public.users
  for update
  to authenticated
  using (true)
  with check (true);

create policy "accountbuddy expenses read"
  on public.expenses
  for select
  to authenticated
  using (true);

create policy "accountbuddy expenses write"
  on public.expenses
  for all
  to authenticated
  using (true)
  with check (true);

create policy "accountbuddy auth users locked"
  on public.auth_users
  for select
  to service_role
  using (true);
