alter table public.member_traffic_lights
add column report_window_start date,
add column report_window_end date;

update public.member_traffic_lights
set report_window_end = report_month
where report_window_end is null;

create index member_traffic_lights_report_window_idx
on public.member_traffic_lights (member_id, report_window_end desc, report_month desc);
