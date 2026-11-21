# Stage 5E1G-B-R2 — Immutable Runtime Provisioning Plan

Status: `PROVISIONING_APPROVAL_REQUIRED` / `MOCK_ONLY` / `LIVE_NO_GO`

Checked: 2026-10-27. No image layer or Python wheel was downloaded and no
container was executed while preparing this plan.

## Verified host capability

- Host: Apple Silicon `arm64`.
- Docker Desktop: `4.84.0 (234817)`.
- Docker client and engine: `29.6.2`, API `1.55`.
- Engine platform: `linux/arm64`, cgroup v2, default `runc`, built-in seccomp.
- CPU, memory, swap, and PID limits are reported available by the daemon.
- Docker CLI resolved executable SHA-256:
  `31201b50f14101c2a2bd8a1fdc49055f985d5007d5ba86c177ad2dedfa309b9b`.

The daemon capability report is not proof that the final scientific container
obeys the required isolation policy. Those controls must be tested against the
final derived image.

## Candidate provenance chain

### Base image

- Source: Docker Official Image `docker.io/library/python`.
- Human-readable tag used only for discovery: `3.11.10-slim-bookworm`.
- Multi-architecture index digest:
  `sha256:840e180ebcc6e5c8efab209c43f5e40fd2af98cb49db5c7103c90539c56bb30e`.
- Required `linux/arm64/v8` manifest digest:
  `sha256:bf70ea1bf26d58b99157ba600bf15425c852e5dfd37e4e8b2d0fa580302b344c`.
- Upstream source revision:
  `docker-library/python@37a6827e0b7a9ef099cfdec5de305e3d4cea7331`,
  path `3.11/slim-bookworm`.
- Underlying Debian base digest reported by the OCI annotations:
  `sha256:e7e7d7fa8fd16e9004b3ffea68e030a8ede97a747b3ebd77f9ea597bb6e7fc00`.
- Local cache status: `NOT_PRESENT`.

The build must use the arm64 manifest reference directly, never the mutable tag:

```text
docker.io/library/python@sha256:bf70ea1bf26d58b99157ba600bf15425c852e5dfd37e4e8b2d0fa580302b344c
```

### Python dependencies

The following CPython 3.11, manylinux2014/aarch64 wheels were identified from
official PyPI release JSON metadata. They have not been downloaded.

| Package | Exact artifact | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| NumPy 2.1.3 | `numpy-2.1.3-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl` | `762479be47a4863e261a840e8e01608d124ee1361e48b96916f38b119cfda04a` | 13,896,715 |
| SciPy 1.13.1 | `scipy-1.13.1-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl` | `e89369d27f9e7b0884ae559a3a956e77c02114cc60a6058b4e5011572eea9299` | 33,694,638 |

Compatibility metadata states NumPy 2.1.3 requires Python `>=3.10`; SciPy
1.13.1 requires Python `>=3.9` and NumPy `>=1.22.4,<2.3`. This establishes a
compatible version range, not installed-byte authority.

### Trusted worker

- Repository path: `scripts/scientific-review/scientific_compute_v1.py`.
- Required in-image path: `/opt/velto/scientific_compute_v1.py`.
- SHA-256:
  `0ba42e3aa5b02a8639551518a3152a88d57a354fc26ba6d1c12e0f5bc00054ce`.
- No arbitrary Python, shell, user-controlled imports, file access, or network
  operations are accepted by its structured operation dispatcher.

## Separately authorized acquisition and build

The owner must explicitly authorize these network-bearing steps:

1. Pull only the base image by the arm64 manifest digest above. Confirm the
   resulting local manifest and image ID before any build.
2. Download only the two exact wheel URLs recorded in the official PyPI JSON.
   Verify each byte SHA-256 before it enters the build context.
3. Prepare a private, minimal build context containing those two wheels, the
   trusted worker, a hash-locked requirements file, and license notices.
4. Build from the already-local digest-pinned base with build networking
   disabled. Install with `pip --no-index --no-deps --require-hashes`; no build
   script may contact a package index.
5. Make the worker root-owned and non-writable, remove wheel/build caches, and
   record the Python executable byte hash plus installed NumPy/SciPy
   distribution `RECORD` identities.
6. Record the final derived image ID and an OCI manifest digest. Execution must
   address this derived content identity, not a mutable local tag. If the local
   builder cannot produce a verifiable OCI manifest/repo digest without a
   registry push, the runtime contract must be reviewed before provisioning;
   a registry push is not authorized by this plan.
7. Only after those values are independently checked may the runtime manifest
   move from `BLOCKED_UNPROVISIONED` to `READY` and update its pinned manifest
   SHA-256.

## Mandatory execution profile

The final worker invocation remains shell-free and must include:

- `--pull never`, `--platform linux/arm64`, `--network none`;
- `--read-only`, numeric user `65532:65532`;
- `--security-opt no-new-privileges=true`, `--cap-drop ALL`;
- 1 CPU, 512 MiB memory and swap ceiling, 64 PID ceiling;
- 64 MiB `/tmp` tmpfs with `noexec,nosuid,nodev`;
- no bind mounts or volumes;
- 1 MB input/output ceilings and 5-second application timeout;
- deterministic locale, timezone, hash seed, and one-thread BLAS settings.

## Required executed verification

No item below is satisfied by manifest inspection alone:

1. Run independently computed Student-t fixtures across confidence levels,
   degrees of freedom, invalid inputs, and declared absolute/relative tolerances.
2. Confirm inside-container Python, NumPy, SciPy, interpreter, worker, image, and
   distribution identities exactly match the admitted manifest.
3. Prove outbound TCP, UDP, and DNS attempts fail under `--network none`.
4. Prove writes outside `/tmp` fail, host paths are absent, the root is
   read-only, and `/tmp` is bounded and `noexec`.
5. Prove effective UID/GID, capability set, no-new-privileges, PID/memory/CPU
   limits, and platform identity from inside the container and daemon inspect.
6. Exercise output overflow, timeout, forced kill, worker crash, missing daemon,
   missing image, and dependency/worker drift.
7. Verify durable request and attempt fsync precede dispatch; every ambiguous or
   failed attempt is terminal and replay of its run directory is rejected.
8. Rerun Stage 5E1G-B, Stage 5E1F, Stage 5E1G-A, manifest checks, TypeScript,
   lint, build, and—only after an authorized local commit—the clean-head
   107-test critical suite.

## Security boundary

Successful tests would demonstrate the listed Docker container controls on this
single Docker Desktop host. They would not establish VM-grade host isolation,
daemon-compromise resistance, multi-host exact-once admission, or scientific
authority. Source authenticity, interpretation, and qualified human approval
remain separate mandatory gates.
