create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id)
);

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

create index if not exists labels_user_id_created_at_idx
  on public.labels (user_id, created_at asc);

create unique index if not exists labels_user_id_lower_name_idx
  on public.labels (user_id, lower(name));

create index if not exists task_labels_user_id_task_id_idx
  on public.task_labels (user_id, task_id);

create policy "Guests can read their own labels"
  on public.labels
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can create their own labels"
  on public.labels
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Guests can update their own labels"
  on public.labels
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Guests can delete their own labels"
  on public.labels
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can read their own task labels"
  on public.task_labels
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Guests can label their own tasks"
  on public.task_labels
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks
      where tasks.id = task_labels.task_id
      and tasks.user_id = auth.uid()
    )
    and exists (
      select 1 from public.labels
      where labels.id = task_labels.label_id
      and labels.user_id = auth.uid()
    )
  );

create policy "Guests can remove their own task labels"
  on public.task_labels
  for delete
  to authenticated
  using (user_id = auth.uid());
