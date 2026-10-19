# Stage 4B2 — Local-only approved trial runbook

## Why local execution?

Vercel's protected Preview Exa secret cannot be exported to a one-time sandbox via the available authorized integration. A branch-specific Preview token provisioning attempt was blocked by platform security controls; do not bypass them.

This opt-in CLI uses the **existing developer workstation's** `.env.local` file and never reads or writes production/Supabase data. It sends synthetic script content only, uses exactly the user-approved original source `https://arxiv.org/abs/2304.03442`, and has no Apply or media-generation path.

## Authorized envelope

- Max estimated spend: USD 5.00, **not** an absolute provider-billing ceiling.
- Exa Contents API: at most 1 request for the exact approved URL in `ids`; conservative pre-reservation USD 0.75. Stop if reported Exa cost exceeds the reservation.
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

## Consumed first execution

The first authorization, recorded as `stage4b2-20261019-search-1`, is consumed. It made one Exa ranked-search request, made zero OpenAI requests, reported USD 0.007 and stopped after 2,544 ms with `APPROVED_SOURCE_NOT_RETURNED`. That proves only that the ranked top-three response omitted the approved URL. It does not prove that the publication or its content is unavailable, and it does not establish evidence or claim acceptance.

The committed historical receipt prevents that execution ID from being reused. Runtime receipts are written atomically to the ignored `.stage4b2-receipts/` directory before any provider request. A started, blocked or completed receipt is terminal; an interrupted or ambiguous attempt is never replayed automatically.

## Future one-time execution (not currently authorized)

Do **not** run the following template until a new execution identifier and budget have been explicitly approved. The three execution values must match exactly; the old consent marker is invalid.

```bash
STAGE4B2_EXECUTION_ID=stage4b2-<new-approved-id> \
STAGE4B2_APPROVED_EXECUTION_ID=stage4b2-<new-approved-id> \
STAGE4B2_EXECUTION_CONSENT=confirmed:stage4b2-<new-approved-id> \
  node --env-file=.env.local scripts/stage-4b2-local-live-probe.mjs --execute
```

The probe makes one `POST https://api.exa.ai/contents` request with only `https://arxiv.org/abs/2304.03442` in `ids`. There is no ranked discovery query, fallback source, mirror acceptance or automatic retry. It separately downloads the approved HTTPS document and requires the returned passage to occur in that document before OpenAI can be called.

Capture the JSON result **without including secrets or raw provider content**. `BLOCKED` is an acceptable fail-closed result. Diagnostics distinguish malformed responses, `SOURCE_NOT_DISCOVERED`, `SOURCE_IDENTITY_MISMATCH`, `SOURCE_CONTENT_UNAVAILABLE` and `SOURCE_PASSAGE_NOT_VERIFIED`. Reports include request counts, per-stage elapsed time, estimated reservations and provider-reported Exa cost where available.

The resulting Preview is a synthetic example only; it is not applied to the saved Thynel project.

## Post-run verification

Record the provider call counts, Exa-reported cost (if provided), source-document and verified-passage SHA-256, elapsed times and result classification. The OpenAI API may report tokens without an exact USD bill; estimated reservations are not a financial guarantee. Then check the existing Thynel project and production deployment read-only, verifying 5 script sections, 36 scene references and unchanged checksums.

Do **not** merge draft PR #13/#14/#15/#16 or enable production whole-script refinement on the basis of this smoke test.
