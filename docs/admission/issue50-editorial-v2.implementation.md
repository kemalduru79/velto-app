# Inactive v2 subject verification

The immutable proposal remains byte-identical (SHA-256 5b77d33277e8a4d45f8c86986c5e9db068af54c0ae2a5bf13b160a0cfcf1ceec). The new additive verifier checks precisely its five subject hashes, base identities, regular files, staged bytes and unchanged original policy. It verifies the editorial subset only; it does not admit the entire PR or unrelated paths. No existing gate imports it. Caller-asserted approval cannot activate it. Content verification PASS is distinct from admission, which remains DENIED.

Run node scripts/issue50-admission-v2-test.mjs for 20 black-box positive/negative controls, independently invoked through subprocesses and isolated Git fixtures. This is implementation-independent test construction, not a claim of a non-author review or human sign-off. A non-author source review remains pending.

Owner decision required before activation: accept the exact immutable v2 proposal and five source hashes after review, then separately review the precise gate integration patch. No activation patch is applied here. Further subject edits require a new proposal version. Original 104 pins and scientific gates remain unchanged.

The separately authorized Stage 0.6A repair replaces only the mutable HEAD baseline with ba55a5bdc65d9016f88f65b6411de35c9acbff97. All 24 controls remain. package.json and package-lock.json remain identical to bc30a72440cfbeaafa5c3aac283bdaa5efd70656. This repair is NOT one of the five v2 subjects and is NOT implicitly admitted by v2. Its exact diff also needs explicit source-admission review; the historical frozen pin is preserved.
