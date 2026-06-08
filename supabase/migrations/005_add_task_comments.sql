create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.task_comments enable row level security;

create index if not exists task_comments_user_id_task_id_created_at_idx
  on public.task_comments (user_id, task_id, created_at asc);

create policy "Guests can read their own task comments"
  on public.task_comments
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can create comments on their own tasks"
  on public.task_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks
      where tasks.id = task_comments.task_id
      and tasks.user_id = auth.uid()
    )
  );

create policy "Guests can delete their own task comments"
  on public.task_comments
  for delete
  to authenticated
  using (user_id = auth.uid());
