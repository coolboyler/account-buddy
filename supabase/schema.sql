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

-- AccountBuddy keeps its own login/session layer in the Express API.
-- Keep Supabase credentials server-side. If you use only a publishable/anon key,
-- the backend needs table access through the public schema.
alter table public.users disable row level security;
alter table public.expenses disable row level security;
alter table public.auth_users disable row level security;
