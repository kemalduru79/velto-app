begin;

alter table public.velto_storage_admissions
  drop constraint velto_storage_admissions_purpose_check;

alter table public.velto_storage_admissions
  add constraint velto_storage_admissions_purpose_check
  check (
    purpose in (
      'creator_generated_image',
      'storyverse_generated_image',
      'storyverse_generated_video',
      'final_movie_export'
    )
  );

commit;
