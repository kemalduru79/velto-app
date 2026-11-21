# Stage 5E1G-B-R4 — Targeted Runtime Selection

Status: `PREFERRED_TARGET_SELECTED` / `PROVISIONING_NO_GO` / `MOCK_ONLY` /
`LIVE_NO_GO`

Checked: 2026-10-27. This decision is limited to the two requested official
Python 3.11.18 slim candidates. It does not start another image search.

## Preferred target and provenance

The single preferred target is the Docker Official Image
`docker.io/library/python:3.11.18-slim-trixie`, addressed for execution only by
its `linux/arm64/v8` OCI platform manifest:

`docker.io/library/python@sha256:97ac71919bb9718e0706271fd45337d6fc9e42303e0b67c454ff8e90eed26329`

- Multi-architecture index:
  `sha256:82209229d3fda30d71e603ec95bb4bea0476635ba6df3df2e32284e036654f51`.
- Created annotation: `2026-10-26T22:54:46Z`.
- Docker Library source revision:
  `83054588043b3a7ac1ce8324c9242164b632beb9`, path `3.11/slim-trixie`.
- Debian trixie-slim base digest annotation:
  `sha256:a66b19aa552f595b4ab276c6b4f9b24fa4546632c5ecd88cccdced4a6866323a`.
- arm64 attestation manifest:
  `sha256:4dd04c8195ab81360189879ae260fb556d93f043d5b5f07db1279e59415375ab`.
- Attestation configuration:
  `sha256:6330867034f9e266630916734d41313f059dba5b68bea0b27ab129d288b5fcbf`.
- SPDX layer:
  `sha256:baa3a02ef28d32073ceb34941f56f919f717b579a36affd6e6756e0a84d6143e`.
- SLSA provenance v0.2 layer:
  `sha256:c8edaa6639242624cd9b35135e9512bbb5831155d314cd8bb846a28fc9695249`.

These identities establish publisher traceability, not runtime approval.

## Versioned vulnerability evidence

Docker Scout CLI `1.23.1`, git commit
`1f5f7a51d7dbbd427feccfa2e133aa51ec702c22`, queried its current service data
on 2026-10-27 for each exact arm64 digest. Only critical and high severities
were requested.

| Candidate | Packages | Critical | High | Disposition |
| --- | ---: | ---: | ---: | --- |
| Trixie `97ac7191...` | 143 | 0 | 3 | Preferred target, remediation required |
| Bookworm `dab50bc0...` | 171 | 0 | 10 | Rejected |

Trixie findings:

1. `CVE-2026-85091`, Debian `zlib1g`
   `1:1.3.dfsg+really1.3.1-1`: high, no fixed Trixie version recorded. The
   library exists at `/usr/lib/aarch64-linux-gnu/libz.so.1.3.1`; it is a real
   runtime library, not a removable build-only dependency. Debian currently
   classifies Trixie as vulnerable, and the Debian bug contains conflicting
   applicability analyses. This stage accepts neither a false-positive claim
   nor a reachability exception.
2. `CVE-2026-24049`, `wheel 0.45.1`: high, fixed in `0.46.2`. The affected
   files are vendored under `setuptools/_vendor` and are packaging/build tools.
3. `CVE-2026-23949`, `jaraco-context 5.3.0`: high, fixed in `6.1.0`. The
   affected files are also vendored under `setuptools/_vendor`.

Bookworm retains the same three findings plus six high findings in
`util-linux 2.38.1-5+deb12u3` and one in `perl 5.36.0-7+deb12u4`. Trixie
therefore resolves seven of the prior ten highs, but it does not satisfy the
acceptance gate.

## Acceptance gate

A runtime may advance only with zero critical findings and zero unresolved
applicable high findings. An exception requires independent written
justification for the exact CVE, package, reachability, and exploit path plus
explicit owner approval. No exception is granted here.

The Trixie target currently fails this gate because the zlib high remains an
unresolved runtime exposure. The two packaging findings are not accepted
merely because they are build-oriented; their packages must be absent from the
final derived image and that absence must be proven by its SBOM and scan.

## One narrowly scoped remediation path

Do not evaluate another base image. Use the preferred Trixie manifest only
after all of the following exact conditions can be met:

1. Obtain a Debian-signed Trixie `arm64` `zlib1g` security update that closes
   `CVE-2026-85091`. Its exact version, `.deb` filename, byte size, SHA-256,
   signed `InRelease` identity, and `Packages` entry must be recorded before
   authorization. No such fixed Trixie artifact is presently published in the
   reviewed authority, so no hash may be invented and provisioning remains
   blocked.
2. Install only the two already pinned wheels offline with dependency
   resolution disabled, then remove `pip`, `setuptools`, `wheel`, their
   vendored packages, and installation caches from the final runtime layer.
3. Produce a final SBOM and exact-digest scan proving the three current highs
   are absent and that no new critical or applicable high finding was added.
4. Only then execute the existing isolation and genuine SciPy acceptance
   probes against the derived content digest.

Mixing an unstable Debian binary into Trixie is not approved because it would
replace the stable runtime library outside its signed release authority and
would require a separate compatibility/dependency review.

## Artifact scope requiring later owner approval

No artifact is approved for acquisition now. A future authorization request
must list exactly:

- the preferred base manifest above (Scout reports a 46 MB image);
- NumPy wheel
  `numpy-2.1.3-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl`,
  13,896,715 bytes, SHA-256
  `762479be47a4863e261a840e8e01608d124ee1361e48b96916f38b119cfda04a`;
- SciPy wheel
  `scipy-1.13.1-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl`,
  33,694,638 bytes, SHA-256
  `e89369d27f9e7b0884ae559a3a956e77c02114cc60a6058b4e5011572eea9299`;
- the not-yet-published fixed Trixie `zlib1g arm64` artifact and signed metadata
  identities described above;
- the trusted worker SHA-256
  `0ba42e3aa5b02a8639551518a3152a88d57a354fc26ba6d1c12e0f5bc00054ce`.

The known wheel payload is 47,591,353 bytes. Base registry transfer and the
future zlib artifact size cannot be guaranteed until authorized acquisition.

## Tool acquisition disclosure

OCI manifest inspection downloaded registry metadata. Docker Scout reported
`Pulled`, `Storing image for indexing`, and cached SBOM/index content for the
Trixie digest; the Bookworm SBOM was already cached. This was not a
`docker pull`, build, or container execution, but Scout may retain artifact
content in its private index cache. No cache cleanup is attempted without
authorization.

## Compatibility and decision

Official PyPI metadata keeps NumPy 2.1.3 and SciPy 1.13.1 compatible with
CPython 3.11 and with one another. Wheel tags match CPython 3.11,
manylinux2014/aarch64. This is metadata compatibility only; import, ABI, BLAS,
and Student-t execution remain unverified until authorized provisioning.

Decision: `CONTROLLED_LOCAL_PROVISIONING_NO_GO`. Trixie is the only preferred
target, but acquisition/build authorization must wait for an exact fixed
Trixie zlib artifact and a complete remediation artifact list.
