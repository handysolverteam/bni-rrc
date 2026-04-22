alter table public.import_batches
add column source_type text not null default 'unknown'
  check (
    source_type in (
      'unknown',
      'membership_dues_xls',
      'traffic_lights_pdf',
      'palms_chapter_summary',
      'membership_length_pdf'
    )
  ),
add column source_chapter_name text,
add column source_report_from date,
add column source_report_to date;

create index import_batches_source_window_idx
on public.import_batches (source_type, source_chapter_name, source_report_from, source_report_to);
