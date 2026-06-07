alter table public.tasks
  add column if not exists position integer not null default 0;

with ranked_tasks as (
  select
    id,
    row_number() over (
      partition by user_id, status
      order by created_at asc
    ) - 1 as next_position
  from public.tasks
)
update public.tasks
set position = ranked_tasks.next_position
from ranked_tasks
where tasks.id = ranked_tasks.id;

create index if not exists tasks_user_status_position_idx
  on public.tasks (user_id, status, position asc);
