# Velto FOUNDATION-P1 — AUTH + Credit Ledger Foundation

Bu ZIP, mevcut `kemalduru79/velto-app` ana dalı incelenerek hazırlanmıştır. Dosyalar repo köküne aynı klasör yapısıyla kopyalanmalıdır.

## Kurulum sırası

1. ZIP içindeki dosyaları repo köküne kopyalayın.
2. Supabase SQL Editor veya migration pipeline üzerinden şu migration'ı çalıştırın:
   - `supabase/migrations/20260728_foundation_p1_auth_credit_ledger.sql`
3. Supabase Authentication URL Configuration içinde aşağıdaki redirect URL'lerini ekleyin:
   - `https://<domain>/login`
   - `https://<domain>/reset-password`
   - local test için `http://localhost:3000/login`
   - local test için `http://localhost:3000/reset-password`
4. Mevcut environment variable'ların bulunduğunu doğrulayın:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. `npm run build` çalıştırın.

## Kredi testi

Yeni hesaplar 0 krediyle açılır. Test kullanıcısına SQL Editor üzerinden kredi tanımlamak için:

```sql
select public.velto_credit_grant(
  '<USER_UUID>'::uuid,
  100,
  'foundation-p1-test',
  'grant',
  '{"reason":"manual test credit"}'::jsonb
);
```

Client oturumunun access token'ı ile:

- `GET /api/credits` — bakiye
- `POST /api/credits` `{ "action": "reserve", ... }`
- `POST /api/credits` `{ "action": "settle", ... }`
- `POST /api/credits` `{ "action": "release", ... }`

çağrıları yapılabilir.

## Önemli sınır

Bu ilk teslim, AUTH-P1'i tamamlar ve FIN-P1'in ledger/engine temelini kurar. Medya endpoint'lerinin reserve–settle–release akışına bağlanması bir sonraki mikro-sprinttir.
