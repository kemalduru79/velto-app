# AUTH-P1B + FIN-P1B Test Checklist

## Build
- [ ] `npm run build` succeeds.
- [ ] No new environment variable is requested.
- [ ] Existing Supabase and export variables remain available.

## Authentication and account menu
- [ ] In an incognito window, open `http://localhost:3000/create?flow=creator_lab`.
- [ ] Login page opens and explains that the user will return to Velto Studio.
- [ ] Successful login opens `/create?flow=creator_lab`, not `/dashboard`.
- [ ] Opening `/login` directly and signing in opens `/dashboard`.
- [ ] Account menu appears on dashboard and Velto Studio.
- [ ] Account menu shows user identity and the expected credit balance.
- [ ] `Kullanıcı değiştir` signs out and opens login while preserving the current destination.
- [ ] `Çıkış yap` signs out and returns to `/`.
- [ ] Revisiting the protected CreatorLab URL after logout opens login.

## Credit metering
Record the starting balance from the account menu before each test.

- [ ] Standard image generation reduces available balance by 1.
- [ ] Pro image generation reduces available balance by 2.
- [ ] Standard narrator or dialogue voice reduces available balance by 1.
- [ ] Pro AI video task acceptance reduces available balance by 6.
- [ ] Standard final export reduces available balance by 1.
- [ ] A user with insufficient credits receives an error before the provider operation starts.
- [ ] A synchronous failed image/voice/export operation does not leave credits reserved.
- [ ] Supabase `velto_credit_ledger` contains matching reserve and settle/release entries.

## Supabase verification query

```sql
select
  entry_type,
  operation_type,
  balance_delta,
  reserved_delta,
  balance_after,
  reserved_after,
  provider,
  reference_id,
  created_at
from public.velto_credit_ledger
where user_id = '404ce723-1d87-4be1-990a-e9dc2867660b'::uuid
order by created_at desc
limit 50;
```
