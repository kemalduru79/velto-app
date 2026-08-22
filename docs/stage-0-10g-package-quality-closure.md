# Stage 0.10G — package, quality, and Stage 0.10 closure

Status: **internal beta candidate; not billing truth**

Contract: `creator-package-validation-2026-08-22`

As of: 2026-08-22

## Decision

Stage 0.10 is ready to close for **beta product/economic design**, not GA accounting validation. Standard and Pro are conditional-go external-beta packages. Cinematic is conditional-go, invitation-only until perceptual samples and observed infrastructure cost support wider availability. Candidate prices remain $59 / $199 / $399. Credits stay the sole hard customer capacity unit; finished minutes remain indicative. No rollover, top-up, overage, checkout, or public pricing behavior is introduced.

## Facts, supplied references, and assumptions

Repository facts:

- Credits are entitlement units, never dollars or COGS. Current operation values are unchanged.
- Provider costs are versioned and measured separately. Stock search/import provider COGS is non-billable; infrastructure USD remains unknown.
- Standard automatic paid video is zero. Pro and Cinematic use scene-level, value-driven routing without percentage quotas.
- Current video profiles and exact billed-duration rules are reused. Candidate Lite and Seedance profiles remain disabled; hero video remains explicitly gated.

Product-owner supplied market snapshot:

- InVideo illustrates the large gap between stock-first Basic (2 credits/min) and fully generative Pro/Ultra (80/160 credits/min).
- VidRush Creator is approximately $239 for 109–110 minutes, or $2.19/min, and its 55 credits/min covers a wider production pipeline.
- HeyGen is an adjacent, not direct, comparison at $29/600 credits and $49/1,000 credits; Video Agent is 20 credits/min.

Simulation assumptions—not observed production distributions:

- Comparable workload uses configurable 8 scenes/min; stress uses 10. This is not a runtime rule.
- Narration uses 900 characters/finished minute. Intelligence uses 3,000 input and 1,000 output tokens/min with 20% cached input.
- One generated image uses 250 text-input and 3,000 image-output tokens.
- Retry rate multiplies provider COGS. It does not charge extra customer credits in these package manifests.
- The four deterministic scenarios are stock-rich, typical, generation-heavy P90, and retry stress. They are design hypotheses to calibrate with beta telemetry.

## Economic ceilings

| Tier | Price | Workload | Sale $/min | P50 ceiling (65% GM) | P90 ceiling (60% GM) | Stress ceiling (50% GM) |
|---|---:|---:|---:|---:|---:|---:|
| Standard | $59 | 60 min | $0.98 | $20.65 | $23.60 | $29.50 |
| Pro | $199 | 90 min | $2.21 | $69.65 | $79.60 | $99.50 |
| Cinematic | $399 | 60 min | $6.65 | $139.65 | $159.60 | $199.50 |

The modeled GM below uses known provider COGS only. It is not accounting gross margin.

## Package recommendation

| Tier | Decision | Candidate credits | Indicative minutes | Typical provider COGS / GM | P90 provider COGS / GM | Stress provider COGS / GM | P90 unknown-cost headroom |
|---|---|---:|---:|---:|---:|---:|---:|
| Standard | CONDITIONAL GO | 700 | ~60 | $14.46 / 75.5% | $19.36 / 67.2% | $27.48 / 53.4% | $4.24 |
| Pro | CONDITIONAL GO | 2,600 | ~90 | $50.47 / 74.6% | $67.39 / 66.1% | $99.23 / 50.1% | $12.21 |
| Cinematic | CONDITIONAL GO, invitation-only | 3,200 | ~60 | $70.67 / 82.3% | $108.21 / 72.9% | $148.89 / 62.7% | $51.39 |

Pools are derived as the typical manifest plus 15%, rounded upward to 100 credits: 574 → 700, 2,192 → 2,600, and 2,752 → 3,200. The Cinematic P90 manifest needs 3,241 credits and therefore naturally pauses at the included entitlement instead of creating hidden spend. The pool represents typical capacity, not a promise that every generation-heavy mix reaches the indicative minutes.

### Standard — professional stock-first production

Standard's typical 574-credit mix is dominated by scene narration, then generated images and exports. It uses reuse, safe stock, imagery, and image motion, with zero automatic paid generative video. P90 known-provider COGS passes the 60% target but leaves only $4.24 for unpriced infrastructure, so infrastructure measurement is the primary risk. Stress remains above the 50% red line. This is not a low-quality tier: publishability, semantic fit, narration, attribution, and export completeness remain mandatory.

### Pro — selective professional generative motion

Pro aligns closely with VidRush Creator's approximate price/min while representing a different product contract. Typical video COGS is $21.02; P90 video COGS is $32.30, below the $40.50 working video envelope. Efficient motion is the baseline and higher-quality motion is selective, so viability does not depend on premium generation for every scene. The $12.21 P90 unknown-cost buffer and near-red-line retry-stress result require beta monitoring.

### Cinematic — premium scene-level motion and continuity

Cinematic combines premium controlled motion, fixed-duration fast motion where it fits, and fewer than two expected hero uses in the typical 60-minute workload. Authentic stock can still win. Typical video COGS is $47.59 and P90 is $76.64, below the $105 working video envelope. Economics have substantial P90 infrastructure headroom; the launch constraint is perceptual proof and tail retry behavior, not a need to raise price or lower quality.

## Credit and COGS semantics

Credits bound customer entitlement. Provider COGS measures economic exposure. Intelligence currently contributes provider COGS but has no separate customer credit operation; exports consume credits while their infrastructure USD remains unknown. Those facts are intentionally visible rather than forced into a false conversion rate. At exhaustion, beta generation should pause and present the existing entitlement path; paid overages and top-ups remain deferred.

## Sensitivity

The strongest known COGS parameters are premium-video density/profile mix and retry rate; image density is next. Scene density strongly affects credit demand through narration/visual operations even where stock COGS is zero. Stress at 10 scenes/min and 25–30% retries raises Standard/Pro/Cinematic known-provider COGS to $27.48/$99.23/$148.89 and credits to 784/2,964/4,038. Pro reaches the stress red line, making retry control the clearest beta alert. No result is converted into a fixed generated-second or scene-percentage quota.

## Quality floor

All tiers require semantic scene fit, publishable source resolution, appropriate and attributable stock, clear narration, audio synchronization, coherent visuals, complete exports, and no placeholder media. Pro additionally requires motion relevance and noticeable production value above Standard. Cinematic additionally requires premium motion control, continuity when needed, hero fidelity, and noticeable value above Pro. Script and intelligence quality are not deliberately degraded by tier.

## Deterministic quality matrix

| Content | Expected behavior | Suitability | Profile class | Quality/cost rationale |
|---|---|---|---|---|
| Documentary/explainer | Authentic stock-first | All | Stock/selective motion | Real footage is often both stronger and cheaper. |
| Product/business | Stock, interface, custom visuals | All | Selective professional motion | Clarity first; motion on demos/hooks. |
| Abstract concept | Custom visuals and selective motion | Pro/Cinematic | Professional/premium | Purpose-built visuals justify selective spend. |
| Recurring character story | Reference continuity | Cinematic | Premium continuity | Capability requirement justifies premium routing. |
| Motion-heavy hook | Concentrated high-value motion | Pro/Cinematic | High motion | Spend affects a short, valuable opening. |
| Low-motion education | Reuse, stock, image motion | All | Efficient | Dense paid video adds little value. |
| Stock-rich travel | Authentic stock | All | Stock | Authenticity wins; provider stock COGS is non-billable. |
| Data/interface | Capture/custom graphic | All | Static/controlled | Legibility and fidelity outrank generation. |
| Transformation hero | Explicit hero gate | Cinematic | Exceptional hero | Highest treatment stays exceptional. |
| Long-form mixed | Per-scene mixed treatment | All | Mixed | No project-wide generation percentage. |

Automated tests can verify policy, routing eligibility, continuity capability, resolution, fallback, economics, and disabled candidates. They cannot prove subjective visual quality. Beta sample acceptance must review: scene-to-script fit; artifacts; identity/wardrobe/object continuity; camera and motion intent; stock authenticity; source resolution; narration naturalness; music/dialogue balance; lip/audio timing where relevant; transitions; attribution; placeholder absence; and end-to-end export integrity. No paid generation was triggered by this stage, and no claim of market-best quality is made.

## Competitive interpretation

| Product | Pricing/capacity approach | Stock/generative strategy | Pipeline context |
|---|---|---|---|
| CreatorLab Standard | $59 candidate; 700 credits; ~60 typical min | Stock/reuse-first, zero automatic paid video | Integrated Production Intelligence and publishing workflow |
| CreatorLab Pro | $199 candidate; 2,600 credits; ~90 typical min | Selective professional motion | Scene-level routing, continuity-aware workflow, export |
| CreatorLab Cinematic | $399 candidate; 3,200 credits; ~60 typical min | Selective premium/hero treatment | Premium scene-level quality, not maximum clip count |
| InVideo | Plan credits; supplied modes span 2–160 credits/min | Stock-only through fully generative | Demonstrates the economic spread between modes |
| VidRush | Credits mapped to broad finished-minute pipeline | High-quality pipeline comparator | ~$2.19/min Creator reference; broad production charge |
| HeyGen | Lower-priced credit plans | Adjacent AI-video model | Useful adjacent reference, not equivalent long-form intelligence |

Provider names are intentionally absent from candidate customer wording. Differentiation is Production Intelligence and outcomes, not model access.

## Beta launch and enforcement

Recommendation: **launch Standard + Pro in external beta; keep Cinematic invitation-only**. Keep credits as the hard entitlement and retain economic enforcement in `monitor` initially. The current guard is safe as catastrophic protection, but unknown infrastructure COGS and uncalibrated workload distributions make automatic package-level denial premature. Beta operations should alert on committed exposure, retry rate, video COGS/min, aggregation completeness, credit burn/min, and residual P90 headroom. Move to guard only after fallback UX is sample-tested and beta telemetry calibrates thresholds.

Always-on integrity failures remain closed: invalid/unknown dispatch cost, unsupported profiles, false exact pricing, duplicate dispatch, and incomplete aggregation in guard mode.

## Stage 0.10 closure review

- 0.10A: price/workload benchmarks and margin targets established.
- 0.10B: credits and real provider COGS are separate, metered contracts.
- 0.10C: safe stock/reuse foundation exists.
- 0.10D: scene-level Production Intelligence selects treatments without fixed percentages.
- 0.10E: premium routing and provider billed-duration truth exist; disabled candidates remain disabled.
- 0.10F: actual plus pending exposure, complete pagination, entitlement, and margin controls exist.
- 0.10G: packages, quality floors, scenarios, sensitivities, beta launch, and enforcement posture are explicitly validated.

Standard automatic paid video remains zero. No Pro 45% or Cinematic 75% quota exists. Credits remain distinct from COGS. Stage 0.10 therefore closes as **beta package ready**, conditional on observed infrastructure economics and perceptual sample validation—not GA-ready.

## Stage 0.11 handoff

Performance & Scale Readiness must validate aggregation latency/cardinality beyond 5,000 operations, API and worker throughput under concurrent production, provider backpressure and retry amplification, export latency/memory/temp-storage pressure, observability cardinality, credit reservation contention/idempotency, safe guard/fallback UX under load, and cost telemetry completeness. It must capture real infrastructure cost per finished minute and segment actual P50/P90 distributions by tier, scene density, video profile mix, retries, project length, and storage/export usage. It must not reinterpret this candidate contract as billing truth.

## Genuine open risks

- Infrastructure/storage/export USD is not priced, especially material for Standard's narrow P90 headroom.
- Scenario mixes and token/image assumptions are design hypotheses until external-beta telemetry exists.
- Subjective output quality and willingness-to-pay require operator-reviewed samples and customer evidence.
- Pro retry stress nearly reaches the 50% red line.
- Cinematic hero quality and continuity have not been proven through paid representative generation in this stage.
