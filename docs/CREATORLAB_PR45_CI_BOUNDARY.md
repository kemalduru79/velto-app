# CreatorLab / Scientific Runtime CI boundary (PR #45)

## Verified scope
The standard CreatorLab script and research HTTP routes depend on TypeScript editorial research/claim/evidence modules and script-generation providers. The standalone Stage 5E1G-B numerical calculation engine is an independent scientificReview adapter, invoked by its offline acceptance suite rather than these production route paths. The regression `scripts/creator-pr45-scientific-boundary-test.mjs` walks local import/re-export/dynamic-import edges for eight CreatorLab routes and fails if a reachable scientificReview module or unresolved local import is found.

This is a **static dependency boundary**, not evidence that scientific research workflows could never be integrated into CreatorLab in a future commit. Any future import will fail the gate until its security implications are reassessed.

## Exactly what changed
- `Velto CI` continues to run existing CreatorLab critical regressions, TypeScript, lint, build and the CI contract. The sole native-Darwin-pinned scientific calculation test is moved out of its critical script list; all other scientific/mock/metadata/integrity tests remain inside the CreatorLab lane.
- `Velto Scientific Runtime CI` runs the original unmodified Stage 5E1G-B scientific calculation test on Ubuntu in a separate REQUIRED-TO-RESOLVE check. It deliberately fails closed when the fixed Darwin Python executable digest is not available. There is **no** `continue-on-error`, waiver, mock replacement or changed runtime manifest.
- CI contract assertions ensure the scientific test is still connected to a workflow and package command.
- The static import-boundary test is part of standard critical regressions and also CI contract checks. Its failure means the scientific engine can no longer be treated as independent.

## Interpretation
Green CreatorLab CI is not equivalent to all-tests-green or full scientific acceptance. Scientific Runtime CI remains red until separately qualified Linux runtime provisioning and authentic container execution acceptance. Both workflow conclusions are visible. Branch-protection rules must require the appropriate checks for each release; they are not modified here.

## Release status
PR #45 remains **DRAFT / NO-GO**. Affected owner-project count unknown; authorized read-only audit not performed; authenticated disposable-project canary not performed. No production, Supabase or media changes. Scientific integrity policy unchanged. This split is a diagnostic and maintenance improvement, not permission to deploy.
