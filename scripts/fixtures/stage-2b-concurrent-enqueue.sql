\set ON_ERROR_STOP on
select id from public.velto_enqueue_creator_final_export(
  '22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','2026-10-16 10:00:00+00',
  'concurrent-signature',repeat('1',64),'{"version":1,"scenes":[1,2,3],"audioTimeline":{"musicIntent":"none","placements":[]}}',
  repeat('2',64),repeat('3',64),'{"renderPayload":{"scenes":[1,2,3]}}');
