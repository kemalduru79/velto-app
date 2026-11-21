# Stage 0.10E — Smart Premium Routing

Production Intelligence decides whether a scene merits generative motion. Smart Premium Routing then chooses a trusted internal generation profile; the browser cannot choose providers, models, rates, or profile keys.

The immutable `creator-video-routing-2026-08-22` catalog uses Runway Gen-4 Turbo as the Pro baseline and selectively upgrades high-value Pro scenes to Gen-4.5. Cinematic defaults to Gen-4.5 for controlled 5/7/10-second timeline fit. Veo 3.1 Fast at 1080p becomes eligible only when `VELTO_VEO_SMART_ROUTING_ENABLED=true` and Google/Veo API configuration exists. Veo 3.1 Standard additionally requires `VELTO_VEO_HERO_STANDARD_ENABLED=true` and exceptional hook, climax, or demonstration intent. Both flags fail closed.

Seedance 2 and Veo 3.1 Lite have exact catalog pricing but remain candidate-only and are never auto-routed. `VEO_VIDEO_MODEL` remains a legacy compatibility default outside the smart CreatorLab path; smart routing uses the explicit Veo allowlist and passes the exact validated model per request.

Runway bills normalized 5/7/10-second clips. CreatorLab's Veo 1080p profiles generate and bill 8 seconds even when the requested timeline duration differs. Both values, resolution, generated-audio mode, pricing version, estimated cost, and exact profile are copied into the dispatch economics record and reconciliation queue payload so later policy/environment changes cannot rewrite attempt identity.

Veo 3.1 output is marked `generated_audio`. The native export pipeline strips visual-source audio (`-an`) and builds the authoritative soundtrack from CreatorLab narration/dialogue and selected music, preventing generated clip audio from competing with the controlled mix.

Fallback is allowed only before an accepted paid task (disabled/unconfigured provider or capability mismatch). After provider acceptance, polling and reconciliation only observe that persisted task and never dispatch a second paid attempt. A new paid attempt requires the existing explicit retry/new-generation flow.

To update routing, add a new immutable pricing snapshot, validate capabilities and output quality, and change centralized thresholds in `creatorSmartRouting.ts`. Do not overwrite historical rates or enable candidate profiles solely for cost savings.
