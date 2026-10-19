# Stage 4B2 — Local-only approved trial runbook

## Why local execution?

Vercel's protected Preview Exa secret cannot be exported to a one-time sandbox via the available authorized integration. A branch-specific Preview token provisioning attempt was blocked by platform security controls; do not bypass them.

This opt-in CLI uses the **existing developer workstation's** `.env.local` file and never reads or writes production/Supabase data. It sends synthetic script content only, uses exactly the user-approved original source `https://arxiv.org/abs/2304.03442`, and has no Apply or media-generation path.

## Authorized envelope

- Max estimated spend: USD 5.00, **not** an absolute provider-billing ceiling.
- Exa search: at most 1; conservative pre-reservation USD 0.75. Stop if reported Exa cost exceeds the reservation.
- OpenAI: at most 3 calls; reserved USD 1.25 each, 1,050 max output tokens per call.
- Model: `gpt-4.1-mini` for provider smoke checks; **not** editorial-quality acceptance for production.
- Exact source: `https://arxiv.org/abs/2304.03442` only.
- Script: synthetic 5-section sample with 36 synthetic scenes; strictly Preview-only.
- No automatic retry, no fallback provider, no persistent state mutation.
- A successful smoke report is `REVIEW_REQUIRED` until the canonical full-script executor passes controlled acceptance.

## Before running

Run on the authorized development Mac with Node.js 24 and the repo's existing local `.env.local` containing `EXA_API_KEY` and `OPENAI_API_KEY`. Do not copy or paste keys into GitHub, chat, terminal output or the PR.

```bash
cd /Users/duruhome/velto-app
git status --short
# Only proceed with branch switch if the working tree is clean.
git fetch origin
git switch agent/creatorlab-r2-stage4b2-provider-acceptance-prep
git pull --ff-only
node scripts/stage-4b2-local-live-probe.mjs
```

The default command prints `DRY_RUN_ONLY`, `exaCalls: 0`, `openAiCalls: 0`, and unchanged synthetic-script checksums. It never invokes providers.

## One-time execution (already approved in chat)

Do not run this command more than once without checking the results and obtaining a fresh execution budget.

```bash
STAGE4B2_EXECUTION_CONSENT=confirmed-5usd-arxiv2304 \
  node --env-file=.env.local scripts/stage-4b2-local-live-probe.mjs --execute
```

Capture the JSON result **without including secrets**. `BLOCKED` is an acceptable fail-closed result if Exa does not return the exact approved source, extracted highlights are not independently present in the source text, costs cannot be determined or a provider fails. No automatic retry is permitted.

The resulting Preview is a synthetic example only; it is not applied to the saved Thynel project.

## Post-run verification

Record the provider call counts, Exa-reported cost (if provided), source-document and verified-passage SHA-256, elapsed times and result classification. The OpenAI API may report tokens without an exact USD bill; estimated reservations are not a financial guarantee. Then check the existing Thynel project and production deployment read-only, verifying 5 script sections, 36 scene references and unchanged checksums.

Do **not** merge draft PR #13/#14/#15/#16 or enable production whole-script refinement on the basis of this smoke test.
