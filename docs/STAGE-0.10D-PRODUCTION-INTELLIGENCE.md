# Stage 0.10D — Scene-level Production Intelligence

CreatorLab now creates a deterministic decision for each scene: `reuse_existing`, `stock_photo`, `stock_video`, `ai_image`, `image_motion`, or `ai_video`. The policy normalizes optional signals from the existing Creator Production response and falls back to local classification of scene text, visual prompt, camera/motion hints, timeline guidance, continuity, and current asset state. It does not add an LLM request.

Candidate treatments are scored independently. Quality and semantic fit lead; cost only distinguishes quality-equivalent choices. Existing current assets and manual Image/Video choices are authoritative. Standard automatically assigns no paid generative video. Pro and Cinematic select `ai_video` only where motion and scene value warrant it. The deprecated `videoBlockRatio` and `getCreatorVideoBlockSceneIds` remain solely for persisted/test compatibility and are not imported by runtime CreatorLab production.

For stock decisions, the plan includes a normalized concrete query, media type, orientation, and resolution/duration floors. Batch production searches the existing cached Pexels service for a small candidate set, deterministically rejects unsuitable candidates, and imports the best acceptable result through the Stage 0.10C trusted server boundary. Unavailable or weak stock falls back to the planned image path; Standard never escalates to paid AI video.

Concurrent imports claim the project-scoped reuse identity before download. A competing request receives a controlled in-progress response instead of downloading a duplicate. Failed claims are released. Ready assets remain scoped by owner and project.

`/api/creator-production-intelligence` authenticates and optionally verifies project ownership, recomputes normalized decisions, and records non-billable Stage 0.10B telemetry without raw scripts/prompts. Existing image/video/voice credit prices and Cost Guard dispatch confirmation remain unchanged.

The CreatorLab scene overview displays outcome language and a short explanation without provider/model identities. Stage 0.10E can consume `videoIntent`: scene identity, quality tier, motion/visual/continuity importance, recommended seconds, reference count, fallback treatment, and production priority. No provider or model is selected in 0.10D.
