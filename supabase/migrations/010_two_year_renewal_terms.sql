alter table public.renewal_cycles
add column reported_due_date date,
add column is_two_year_renewal boolean not null default false;
