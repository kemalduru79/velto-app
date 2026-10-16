\set ON_ERROR_STOP on
do $$
declare r jsonb; reservation_id uuid; replay boolean; j public.velto_jobs;
begin
  r := public.velto_credit_reserve('22222222-2222-4222-8222-222222222222',1,'creator_export',
    'creator-final-export:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:sig','velto-export','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{}',now()+interval '1 day');
  reservation_id := (r#>>'{reservation,id}')::uuid;
  replay := coalesce((r->>'idempotency_replay')::boolean,false);
  if not replay then
    insert into public.velto_creator_economic_operations(attempt_key,logical_operation_id,idempotency_key,credit_reservation_id,
      user_id,project_id,route,operation_type,provider,state,quantities,cost_status,currency,cost_components)
    values ('creator-final-export:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:sig:velto-export:1',
      'creator-final-export:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:sig','creator-final-export:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:sig',reservation_id,
      '22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','/api/creator-final-export-jobs','creator_export','velto-export',
      'reserved','{"sceneCount":36,"requestCount":1}','unknown','USD','{}');
    select * into j from public.velto_enqueue_creator_final_export('22222222-2222-4222-8222-222222222222',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','2026-10-16 14:00:00+00','concurrent-sig',repeat('1',64),'{}',repeat('2',64),repeat('3',64),
      jsonb_build_object('creditReservationId',reservation_id,'reservedCredits',1,
        'economicAttemptKey','creator-final-export:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee:sig:velto-export:1'));
  end if;
end $$;
