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

update public.renewal_tasks
set
  status = 'cancelled',
  completed_at = null
where status = 'open'
  and task_type in ('monthly_review', 'renewal_push');
