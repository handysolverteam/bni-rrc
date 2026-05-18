alter table public.import_batches
drop constraint if exists import_batches_source_type_check;

alter table public.import_batches
add constraint import_batches_source_type_check
check (
  source_type in (
    'unknown',
    'membership_dues_xls',
    'traffic_lights_pdf',
    'traffic_lights_xlsx',
    'palms_chapter_summary',
    'membership_length_pdf',
    'chapter_sponsor_report',
    'chapter_member_training_report'
  )
);
