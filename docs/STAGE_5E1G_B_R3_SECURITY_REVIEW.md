# Stage 5E1G-B-R3 — Scientific Runtime Security Review

Status: `BLOCKED_SECURITY_REVIEW` / `MOCK_ONLY` / `LIVE_NO_GO`

Checked: 2026-10-27. The prior Python 3.11.10 candidate is withdrawn and must
not be provisioned from the R2 plan.

## Newer official candidate

- Repository: Docker Official Image `docker.io/library/python`.
- Discovery tag only: `3.11.18-slim-bookworm`.
- Multi-architecture OCI index:
  `sha256:90d117a7f1ef6535dc75831e1a9184725757fede0d4d424d7977fb5429d50610`.
- Required `linux/arm64/v8` platform manifest:
  `sha256:dab50bc0667b58bb8fb8fb4402643a094140bab343a179a865733fee40fdcbcb`.
- Created annotation: `2026-10-26T22:56:18Z`.
- Docker Library source revision:
  `83054588043b3a7ac1ce8324c9242164b632beb9`, path
  `3.11/slim-bookworm`.
- Debian bookworm-slim base digest annotation:
  `sha256:991827bb788d78bbc130dcb851913beecff43296360f48838aca7cbdfae4375c`.
- arm64 attestation manifest:
  `sha256:344b23779c03a20e935ec75167885361d5ec6b0543e5a69997fff98ce6f8754c`.
- SPDX attestation layer:
  `sha256:bcd2cd61715721c7ee7ce5e2f80350cb66bb111915d203ebcaa74ccc050fc3cd`.
- SLSA provenance v0.2 layer:
  `sha256:2fe6980f294a3116e4c365e91d557aa129e1f4ee7104298c37ab8c771e46f94c`.

These immutable identities and attestations establish a traceable candidate,
not an approved or vulnerability-free runtime.

## Vulnerability result

Docker Scout CLI `1.23.1` analyzed the exact arm64 platform digest using its
current vulnerability data and indexed 171 packages. The result was:

- Critical: 0
- High: 10
- Medium/low were excluded by the requested severity filter
- Affected packages: 5

Observed high findings included six `util-linux 2.38.1-5+deb12u3` findings and
one `wheel 0.45.1` path-traversal finding. The remaining high findings were not
used to make an exception decision. No VEX or exploitability assumption is
accepted as a waiver by this stage.

Disposition: `REJECT_PENDING_SECURITY_REMEDIATION`. The image cannot become the
runtime base while high findings remain unresolved unless a separate qualified
security review documents package reachability, removability, fixed versions,
and an explicit owner risk decision. There are no critical findings in this
scan, but zero critical findings alone is insufficient for approval.

## Scout side effect

The `registry://` Scout scan was intended as a registry SBOM/CVE lookup. Scout
reported `Pulling`, `Storing image for indexing`, and `Indexed 171 packages`.
The exact image was subsequently confirmed absent from the Docker local image
store, but Scout may retain artifact content in its own indexing cache. No
Docker image pull command, wheel download, container execution, or build was
performed. No cache cleanup is attempted without explicit authorization.

## Dependency candidates retained

Official PyPI metadata still identifies a compatible CPython 3.11 aarch64 pair:

| Package | Artifact | SHA-256 |
| --- | --- | --- |
| NumPy 2.1.3 | `numpy-2.1.3-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl` | `762479be47a4863e261a840e8e01608d124ee1361e48b96916f38b119cfda04a` |
| SciPy 1.13.1 | `scipy-1.13.1-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl` | `e89369d27f9e7b0884ae559a3a956e77c02114cc60a6058b4e5011572eea9299` |

They remain metadata-only candidates. Their bytes were not acquired, and their
own transitive/bundled-library security review is not complete.

## External artifacts requiring future approval

No artifact is approved for acquisition at this checkpoint. A future request
must provide one of the following before any download:

1. A newer Docker Official Python 3.11 slim-bookworm arm64 manifest with a fresh
   exact digest and an independently reviewed scan with no unresolved critical
   exposure and an acceptable high-severity disposition; or
2. A documented, minimal derived-base remediation plan using exact `.deb`
   artifacts and hashes, offline package installation, removal of unnecessary
   vulnerable build tools, a post-build SBOM, and a clean/accepted derived-image
   scan; or
3. An explicitly approved alternate official base and a revised compatibility
   assessment. This is a scope decision and is not authorized here.

Once a base passes security review, the acquisition list must separately name:

- its exact arm64 OCI manifest digest and attestation identities;
- the two exact PyPI wheel URLs and SHA-256 values above;
- the trusted worker SHA-256
  `0ba42e3aa5b02a8639551518a3152a88d57a354fc26ba6d1c12e0f5bc00054ce`;
- any exact offline remediation packages and hashes;
- license/SBOM artifacts retained in the private build record.

## Acceptance impact

No scientific container exists, so no Student-t fixture or network, filesystem,
identity, capability, resource, timeout, crash, or replay isolation test can be
credited to R3. Static policy and standard-library calculation tests remain
useful but do not satisfy runtime acceptance. `LIVE_NO_GO` remains mandatory.
