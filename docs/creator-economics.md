# Creator economics

Creator credits are product entitlement units; they are not dollars and do not change when provider rates change. The internal Creator economics ledger separately records provider attempts, measurable usage, estimated or actual COGS, and infrastructure quantities whose USD rate is not yet approved.

Pricing is versioned and copied onto every economic operation. Historical rows retain the catalog version and `pricingAsOf` used at calculation time. Future rate changes add a new catalog version rather than rewriting historical operations.

A provider generation attempt can create COGS. Status polling cannot. A genuinely new fallback or retry generation has a new attempt key and attempt number. Reused assets record `generated=false` and a reuse identity. Unknown provider or infrastructure pricing is stored as `unknown`, never as zero. Raw prompts, scripts, narration, dialogue, credentials, and access tokens must never be stored in economic metadata.
