# Stage 5E1G-B R1 — Container Provisioning Gate

Status: `BLOCKED_UNPROVISIONED` / `MOCK_ONLY` / `LIVE_NO_GO`

## Observed host state

- Host architecture: Apple Silicon `arm64`.
- Docker CLI: `29.6.2`, resolved executable
  `/Applications/Docker.app/Contents/Resources/bin/docker`, SHA-256
  `31201b50f14101c2a2bd8a1fdc49055f985d5007d5ba86c177ad2dedfa309b9b`.
- Docker daemon: unavailable on 2026-10-27. No image inventory or container
  isolation test could be performed.
- Podman and Colima: not installed.

These facts do not establish a trusted container runtime. The repository manifest
therefore contains no image reference, image ID, dependency version, or claimed
container execution authority.

## Required owner-authorized provisioning

1. Start an already installed container daemon. Do not change host security
   settings as part of this stage.
2. Approve either an offline image archive with an independently supplied
   SHA-256, or explicit acquisition of one version-pinned `linux/arm64` base
   image and an offline wheelhouse for one exact Python, NumPy, and SciPy set.
3. Build the worker image without credentials. The image must contain only the
   pinned interpreter, pinned wheels, their license metadata, and
   `scientific_compute_v1.py`. No package installation occurs at run time.
4. Record all of the following from the local daemon:
   - content-addressed `repo@sha256:...` reference;
   - local `sha256:...` image ID;
   - resolved Python, NumPy, and SciPy versions, interpreter byte hash, and
     installed-distribution RECORD/wheel identities;
   - worker SHA-256 inside the image;
   - target platform `linux/arm64`.
5. Update `scientificComputeContainerRuntime.v1.json` to `READY` only when those
   identities are independently verified, then update its pinned manifest hash
   in `containerRuntime.ts`.

Mutable tags are never execution authority. `--pull never` prevents an admitted
calculation from silently acquiring or replacing an image.

## Required executed acceptance

The following must execute against the digest-pinned image before R1 can pass:

1. Student-t reference fixtures for multiple confidence levels and degrees of
   freedom, including boundary and invalid inputs, checked against independent
   expected values and declared numerical tolerances.
2. Container identity drift, missing image, missing daemon, and dependency drift
   rejection.
3. Negative outbound network probes under `--network none`.
4. Read-only-root and filesystem escape probes; the only writable path is the
   bounded `/tmp` tmpfs. No host mount is allowed.
5. Non-root identity, `no-new-privileges`, all Linux capabilities dropped,
   memory/CPU/PID/tmpfs limits, output limits, and timeout termination.
6. Crash/timeout ambiguity with the pre-dispatch durable attempt marker, terminal
   failure record, and replay rejection.

Container controls are an execution boundary, not proof of host-level or
multi-host isolation. Host hardening, daemon privilege boundaries, shared-store
admission, and independent security assessment remain separate gates.
