create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'todo',
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  description text,
  priority text not null default 'normal',
  due_date date,
  constraint tasks_status_check check (status in ('todo', 'in_progress', 'in_review', 'done')),
  constraint tasks_priority_check check (priority in ('low', 'normal', 'high'))
);

alter table public.tasks enable row level security;

create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

create policy "Guests can read their own tasks"
  on public.tasks
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can create their own tasks"
  on public.tasks
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Guests can update their own tasks"
  on public.tasks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Guests can delete their own tasks"
  on public.tasks
  for delete
  to authenticated
  using (user_id = auth.uid());
