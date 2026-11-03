# PR #45 historical project compatibility (draft; not deployed)

Historical loading must never be confused with current scientific approval.

- The exact pre-PR45 original-study work-reference qualification is recognized only by the historical script reader. Current source qualification, script generation, approval, verification, refinement, export and publish remain strict.
- A historical script and pending refinement may be loaded and reviewed with the original approval and evidence preserved. They cannot acquire new approval or qualify for provider dispatch without revalidation against current sources.
- For records requiring historical compatibility, unchanged project autosaves preserve the **original** exported JSON envelope, script, 36-scene media, timeline and final video; attempted script/production/asset changes return a 409. Owner read and CAS authority remain enforced.
- No database migrations or backfills. The owner-scoped audit script consumes an explicitly approved *offline* NDJSON export and prints aggregate counts only. It is **not** connected to Supabase and has not been run on live records.
- A real user can continue to view the historical project, but new production operations require qualifying present-day primary evidence. A later research-revalidation workflow must be separately reviewed rather than silently rewriting stored approval.

## Read-only audit procedure (NOT executed)
1. Owner authorizes a limited, read-only export of their own CreatorLab project metadata, including saved project state. Use existing RLS/owner-access path. Never query other users or export raw text to logs.
2. Run `node --experimental-transform-types scripts/creator-pr45-legacy-audit.mjs < authorized-owner-projects.ndjson` on the secured offline data.
3. Retain only `counts` and reason categories in the audit report; securely dispose of the export. A count of zero must be established with correct population and pagination, not assumed.
4. Do not migrate, approve, delete or overwrite legacy data in response to audit output.

Production release stays **NO-GO** until focused validation, compatibility results, CI triage, and an separately authorized disposable-project canary pass.

## Validated offline scope and unresolved release items

Focused workflow: [GitHub run 41674203437](https://github.com/kemalduru79/velto-app/actions/runs/41674203437) — SUCCESS on compatibility branch commit `74704aa`. Preview deployment `dpl_B1CN6oAmmBVDz4qkt2taBDRPz3Fx` — READY. Production remains `d44ab5d`.

The broader Ubuntu CI progresses beyond its previous renderer and publish guards but cannot execute the strictly digest-pinned Darwin Python binary required for stage 5E1G-B scientific calculations. This scientific runtime restriction is **not bypassed**; full CI is not green. Actual owner-scoped historical data audit and authenticated production tests have **not been run**. PR #45 remains draft and release NO-GO.
