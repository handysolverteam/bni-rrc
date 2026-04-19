alter table public.renewal_tasks
drop constraint if exists renewal_tasks_task_type_check;

alter table public.renewal_tasks
add constraint renewal_tasks_task_type_check
check (
  task_type in (
    'mc_discussion',
    'member_discussion',
    'monthly_review',
    'renewal_push',
    'docs_collection',
    'payment_due',
    'critical_deadline'
  )
);

delete from public.renewal_tasks task
using public.renewal_cycles cycle
where task.renewal_cycle_id = cycle.id
  and cycle.status = 'active';

insert into public.renewal_tasks (
  renewal_cycle_id,
  task_type,
  due_date,
  status,
  notes,
  completed_at
)
select
  cycle.id,
  task.task_type,
  task.due_date,
  'open',
  null,
  null
from public.renewal_cycles cycle
cross join lateral (
  values
    ('mc_discussion', cycle.renewal_date - 90),
    ('member_discussion', cycle.renewal_date - 60),
    ('docs_collection', cycle.renewal_date - 45),
    ('payment_due', cycle.renewal_date - 30)
) as task(task_type, due_date)
where cycle.status = 'active';
