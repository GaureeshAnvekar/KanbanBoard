create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, team_member_id)
);

alter table public.team_members enable row level security;
alter table public.task_assignees enable row level security;

create index if not exists team_members_user_id_created_at_idx
  on public.team_members (user_id, created_at asc);

create index if not exists task_assignees_user_id_task_id_idx
  on public.task_assignees (user_id, task_id);

create policy "Guests can read their own team members"
  on public.team_members
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can create their own team members"
  on public.team_members
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Guests can update their own team members"
  on public.team_members
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Guests can delete their own team members"
  on public.team_members
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can read their own task assignees"
  on public.task_assignees
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can assign their own tasks"
  on public.task_assignees
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks
      where tasks.id = task_assignees.task_id
      and tasks.user_id = auth.uid()
    )
    and exists (
      select 1 from public.team_members
      where team_members.id = task_assignees.team_member_id
      and team_members.user_id = auth.uid()
    )
  );

create policy "Guests can remove their own task assignees"
  on public.task_assignees
  for delete
  to authenticated
  using (user_id = auth.uid());
