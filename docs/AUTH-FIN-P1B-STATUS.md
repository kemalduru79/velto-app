# AUTH-P1B + FIN-P1B Status

## Delivered

### AUTH-P1B
- Protected product routes retain their original destination through login.
- Opening `/create?flow=creator_lab` without a session redirects to login with a safe `returnTo` value.
- Successful login or immediate signup session returns to the requested product surface.
- Direct `/login` continues to use `/dashboard` as the default destination.
- Shared account menu is available on the dashboard, Velto Studio and Storyverse surfaces.
- Account menu shows the signed-in user, available credits and reserved credits.
- Logout and switch-user actions are included.
- Return URLs are restricted to safe internal application paths.

### FIN-P1B
- Server-side authentication protects CreatorLab image, voice, dialogue voice, video and export operations.
- Credit reservation occurs before a billable provider operation starts.
- Successful operations settle the reservation.
- Operations that fail before completion release the reservation.
- Idempotency keys are sent for billable requests.
- Credit balance refreshes in the account menu after successful billable operations.
- Export now passes through an authenticated Next.js proxy instead of calling the export service directly from the browser.

## Initial credit policy

| Operation | Draft | Standard | Pro | Cinematic |
| --- | ---: | ---: | ---: | ---: |
| Image / thumbnail | 0 | 1 | 2 | 4 |
| Narrator voice | 0 | 1 | 2 | 3 |
| Dialogue voice | 0 | 1 | 2 | 3 |
| AI video block | 0 | 0 | 6 | 10 |
| Final export | 0 | 1 | 2 | 3 |

This is an initial product policy, not final commercial pricing. It should be calibrated later against provider cost, failure rates, retry behavior and target gross margin.

## Important implementation note

Video credit is settled when the selected provider accepts the generation task and returns a valid task identifier. The provider job then continues asynchronously. A future reconciliation job should evaluate failed asynchronous tasks and apply refunds where the provider and commercial policy justify it.

## Not included in this sprint
- Subscription packages and credit purchase.
- Final commercial credit pricing.
- Automated expiration cleanup for abandoned reservations.
- Asynchronous video-failure reconciliation/refund.
- Detailed user-facing credit ledger page.
- Provider-cost USD calculation where the provider response does not expose final cost.
