# P0 quality gate closure scope

This gate-only follow-up preserves the reviewed product patch
`ba0b7430337728746490b9d47188d15057b3272ef95678c51aeee9a0b9a2beee`
against `ba55a5bdc65d9016f88f65b6411de35c9acbff97`. It changes no product,
duration, research, scientific, persistence or media behavior.

## Fail-closed lint

Signals, process errors, timeouts and missing/malformed reports fail. Nonzero
exits fail except for the seven explicit Sprint 20 legacy records described below. A successful result must name the expected file, contain one complete
report, agree with its message counts and contain no errors/fatal/ignored-file
report. Empty output is never successful lint evidence. Per-file limits are
1536 MiB V8 heap, 120 seconds wall time and 32 MiB captured output. No retries,
rule overrides, function slicing or compiler skips are permitted. Exceeding a
budget is a failed gate, not qualified acceptance.

Changed-line ranges remain diagnostic context; they cannot convert an unapproved
nonzero exit into success. The strict successful-report validator is unchanged.
Only an exact reviewed legacy record may accept exit status 1.

## Exact reviewed P0 scope

The static admission JSON lists the 104 reviewed composed-candidate file hashes.
The helper pins the JSON's digest, and checks working-file and staged-file
content. Renames check both paths. Deleted files, symlinks, altered approved
files and unknown paths fail. There is no environment override, automatic
inventory generation at test time, wildcard or new allowed prefix.

The eleven exact gate-follow-up paths are listed separately in the helper.
Existing historical allowlists/prefixes retain their prior scope. The P0 content
check takes precedence even where a historical list already allowed the path.
The original mixed workspace intentionally remains blocked where shared files
contain unreviewed audit changes; those changes must remain preserved. The
focused candidate is the reviewed P0 patch plus this gate-only follow-up.

## Remaining lint investigation

Both the clean reviewed base and P0 page exhausted a 1536 MiB heap in prior full
configuration runs. Diagnostic tracing identifies shared React Compiler analysis
entered by `static-components` as the failing phase; this is not proof of a bug
specific to that one rule. The roughly 39,000-line page contains a very large
component. Parsing/non-compiler diagnostic runs are not lint acceptance.

This follow-up bounds actual full-file execution and makes any exhaustion fail
explicitly. It does not claim to repair the compiler's internal allocation
behavior. No rule or dependency is changed, and no product refactoring is
authorized here. A complete strict report or the exact bounded Sprint 20 legacy match is required
for controlled integration; neither establishes production release readiness.

The existing long-form control-string assertion is separate and remains intact.
PR #45/#46 remain Draft and production NO-GO until all independent release
requirements pass. No commit, push, merge or deployment is part of this task.


## Sprint 20 independent lint review — 2026-11-13

Authorized worktree: `/Users/duruhome/.codex/worktrees/p0-sprint20-controlled-integration/velto-app`.
Branch: `codex/p0-sprint20-controlled-integration`.
Unchanged base HEAD: `ba55a5bdc65d9016f88f65b6411de35c9acbff97`.

The submitted gate digest was
`162d202da70b7a6d05abc79ae4cda7115f2294a89f8a1e514b8417c48665fab8`.
The independently read diagnostic reference digest was
`5e2528eaf4eb80b892cad84219f3df27a123879a9242bfd5233bf12e2deea5da`.
Both matched the requested identities before edits. The reference is review
input only: runtime and CI never read it or any local baseline file.

### Findings and bounded correction

The submitted implementation failed portability: React Compiler diagnostic text
embeds the original absolute source path. Its page fingerprint would reject an
otherwise identical report from the integration worktree or a hosted runner.
It also introduced a dependency into `lintFile` that the existing VM-isolated
process-failure regression did not supply. Neither issue justified accepting
missing reports or relaxing the strict validator.

A second verified finding was Babel's exact informational stderr note for the
>500KB page. The gate now accepts only that full fixed note for that exact pinned
page (or empty stderr); any altered/additional stderr still fails.

The correction removes only the exact `\n\n<absolute-current-file>:` diagnostic
paragraph prefix, substituting `\n\n<repository-relative-file>:`. It changes no
other message text, rule, severity or location. Only the page diagnostic digest
changes after this canonicalization. Sorting now uses deterministic UTF-16
string comparison, independent of host locale. Source identity remains exact;
symlink inputs are rejected and record lookup requires an own property.

The seven files retain 83 errors (56 no-explicit-any, 27 set-state-in-effect)
and 87 warnings; this task does not repair or suppress their rules. Acceptance
requires exit 1, empty stderr or the exact page-only Babel note, no process
error/signal/killed flag, exact source SHA-256,
one expected-path report, exact integer error/warning/fatal counts, and the
complete reviewed diagnostic fingerprint. Added, removed, relocated or changed
diagnostics reject the exception, including internally consistent partial
reports. Exit 2/configuration failures, malformed/truncated/empty JSON, fatal
reports and missing/altered embedded records fail. A missing or modified external
reference cannot grant acceptance; the approved inline records remain required.

Exit 0 always follows `validateLintProcessResult` without legacy acceptance.
Nonlegacy files retain the original strict policy and changed-line processing.
`lint-result.mjs`, scope policy, 104 pins and eleven gate exception memberships
are unchanged. Gate/test code is trusted reviewed policy; the focused contract
pins the final lint gate bytes to detect an unreviewed gate-only edit. A party
able to replace both trusted gate and tests is outside this local trust boundary;
independent review and branch protections remain required.

### New change inventory

No new candidate paths: the original 115 paths remain the exact inventory.
Only three existing gate-exception paths differ from the transfer manifest:

1. `scripts/stage-0-8a-changed-lint.mjs`: bounded legacy match portability and
   file-kind/lookup hardening and exact Babel-note handling; seven source hashes
   preserved.
2. `scripts/p0-quality-gate-test.mjs`: fix isolated wrapper fixture; preserve all
   original 72 contracts; add real seven-file lint and synthetic negative tests,
   relocation, strict clean-file and security-gate-integrity regressions.
3. `docs/P0_QUALITY_GATE_CLOSURE.md`: this evidence and integration procedure.

No product, dependency, lockfile, scientific scaffold, provider or Issue #47
behavior changes. The original candidate remains byte-for-byte unchanged across
all 115 manifest entries. No commit, push, merge, deploy or live service call.

### Hosted integration procedure (requires separate explicit authorization)

PR #45 is Draft at `ba55a5bdc65d9016f88f65b6411de35c9acbff97`, head branch
`codex/issue-44-counter-evidence-review`. PR #46 is Draft at
`82a027e0248484dda03c590582180076a225f253`, based on #45 and containing the
separate disabled Runtime v2 scaffold. Neither PR should be updated/rebased.

After all local gates pass and the owner explicitly authorizes commit/push,
first enter the authorized worktree with
`cd /Users/duruhome/.codex/worktrees/p0-sprint20-controlled-integration/velto-app`.
Run all following Git commands there:

1. Reconfirm HEAD, clean index, the 115-path manifest, all 104 pins and the three
   authorized gate deltas against the saved evidence. Recheck remote #45 head
   remains the exact base and target integration branch is absent or unchanged.
   If either moved, stop for reconciliation; never force-push.
2. Stage only the explicit 115 NUL-delimited manifest paths with
   `git add --pathspec-from-file=/private/tmp/velto-s20-final-paths.zlist --pathspec-file-nul`.
   Review `git diff --cached --stat`, `git diff --cached --check`, staged SHA-256
   inventory, and rerun the security contracts against matching staged bytes.
3. Create the first commit on the existing integration branch with message
   `P0 Sprint 20: validate pinned legacy lint and controlled integration`.
   Record its full SHA. For a previously absent remote branch, first seed that
   branch at the unchanged reviewed base with
   `git push origin ba55a5bdc65d9016f88f65b6411de35c9acbff97:refs/heads/codex/p0-sprint20-controlled-integration`.
   Confirm the remote is exactly that base, then push the candidate commit with
   `git push --set-upstream origin codex/p0-sprint20-controlled-integration`.
   Both pushes require authorization. Seeding is necessary because a new-branch
   push has an all-zero `before` and would use the gate's broader historical
   fallback, rather than the exact locally tested base. Do not change that
   fallback or treat the seed run as candidate acceptance.
   A push may trigger existing preview integrations; authorization must cover
   that existing behavior. No deployment command or production promotion.
4. Create a separate Draft stacked PR, head
   `codex/p0-sprint20-controlled-integration`, base
   `codex/issue-44-counter-evidence-review`. This makes the diff exactly this
   candidate. Do not target the PR #46 branch and do not combine its scaffold.
   Push triggers the `codex/**` hosted workflows even though this stacked PR's
   base is not `main` (the pull_request trigger itself only targets `main`).
5. Confirm hosted workflow `head_sha` equals the new commit, the Ubuntu runner is
   native x86_64/AMD64, and setup-node actually uses Node 22 x64. Require locked
   install, TypeScript, original 72 plus added lint contracts, all seven legacy
   matches and final lint PASS, full 121/121 critical regressions, build and CI
   contract. Save exact run/job URLs, architecture and complete step conclusions.
   An emulated AMD64 result is not native hosted acceptance.
6. Preserve the separate scientific runtime workflow and report its result
   independently. Existing scientific runtime qualification/adapter blockers
   are not waived by a green CreatorLab workflow. Do not mark production GO,
   merge either existing Draft, or close P0 technical work from this validation.

This procedure is prepared only. Stop before staging/first commit/push.


### Final validation evidence

**Lint exception security review: PASS after the bounded corrections above.**
**Controlled integration: GO for separately authorized commit and hosted CI.**
**Production: NO-GO. P0 technical closure: OPEN.**

Final local environment: Linux ARM64, Node 22.23.4, existing
`velto-s20-node22-test:local` image, a fresh exact-lockfile `npm ci` installation
(389 platform-applicable packages), fixed lint budgets, no network in test/build
containers, no Docker socket, read-only Compose CLI for configuration tests only.
Only public localhost CI placeholders were supplied. All gates used the documented
push event `{"before":"ba55a5bdc65d9016f88f65b6411de35c9acbff97"}`.

| Gate | Final result | Local evidence |
| --- | --- | --- |
| Original P0 security contracts | PASS 72/72 | `/private/tmp/velto-s20-final-contracts-final.log` |
| Added legacy-lint contracts | PASS 265/265; seven actual lint positives plus all required negatives | same log |
| `npm run lint:changed` | PASS; 109 targets; exactly seven legacy matches | `/private/tmp/velto-s20-final-lint-final.log` |
| Critical regressions | PASS 121/121 against final gate/test code | `/private/tmp/velto-s20-final-critical-final.log` |
| TypeScript | PASS | `/private/tmp/velto-s20-final-core.log` |
| Production build | PASS | same log |
| CI contract | PASS | same log |
| `git diff --check` | PASS | final integrity audit |
| Native hosted AMD64 | PENDING; not inferred from emulation or local ARM64 | requires authorized push |

Earlier attempts failed closed for an absent reused ESLint installation, missing
Compose CLI, path-specific diagnostics, the exact Babel note, and a 120-second
lint timeout under concurrent local validation load. A temporary harness edit
also invalidated an earlier build log; the complete core gate was rerun and its
final log preserved. None of these attempts was counted as acceptance. The final
security run executed without the other validation jobs, with the original
120-second/1536-MiB limits. There are no automatic retries or skip paths in the
gate. The final full lint run independently passed with those same limits.

The exact sorted status inventory digest remains
`135cde5facdef2fb3b684f120fb20cd140c4e747f125cf5c21dbb77f912120db`.
All 115 original candidate files still match their transfer hashes. All 104
integration content pins match, the original eleven gate exceptions remain
unchanged, and only the three documented gate/test/report deltas exist. There
are no staged changes. Final per-path hashes, original hashes and gate results
are saved to `/private/tmp/velto-s20-final-integrity.json`; the exact staging
path list is `/private/tmp/velto-s20-final-paths.zlist`.

Final lint gate SHA-256:
`0b087c9669cd0940b2a5436ec40901ac528d7e96a6d5d50aa388d383638728bf`.
Final gate-test SHA-256:
`7d82fa8288eefa36bf72155dbf7a7801d9dd3587247485ec40ca08951ce19d60`.
The test statically pins the gate digest; it never generates acceptance policy
from current workspace bytes. The canonical page diagnostic fingerprint is
`14d0e70edef2e348c8963a2a11ad3b81ad9b847429bb900e1d5a8cb5785e0f33`;
its source hash remains unchanged, as do the other six diagnostic fingerprints.

Remaining limitations: native hosted AMD64 has not run; scientific Linux/runtime
qualification and production release conditions remain independent blockers;
Issue #47 script-generation reliability is unchanged. The earlier dependency
audit (0 critical, 0 high, 7 moderate) is carried-forward evidence, not a new audit
claim; the exact package and lockfile content is unchanged. No real provider,
production project, paid generation, production access or deployment occurred.

Prepared Draft PR title:
`P0 Sprint 20: validate pinned legacy lint and controlled integration`.
After the separately authorized base-seed and candidate pushes, the exact PR
creation command is:

```sh
gh pr create --draft --base codex/issue-44-counter-evidence-review --head codex/p0-sprint20-controlled-integration --title 'P0 Sprint 20: validate pinned legacy lint and controlled integration' --body-file /private/tmp/velto-s20-draft-pr-body.md
```

The prepared body records local evidence and explicitly requires native hosted
AMD64 acceptance. This command has not been executed. No commit, push, PR write,
merge or deployment was performed. The next owner action is to authorize the
bounded first-commit/base-seed/candidate-push procedure above; stop if the base,
remote branch, inventory or exact hashes no longer match.
