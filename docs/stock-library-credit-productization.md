# Stock Library productization and credit metering

Status: internal product contract, 2026-08-23.

CreatorLab presents the feature as **Stock Library / Stok Kütüphanesi**. Pexels remains the internal provider and audit identity, but is not the primary product brand. A readable, linked “Media provided by Pexels” compliance line remains in the panel, creator attribution links remain on every card, and stored source page, provider, license, creator, and attribution metadata are unchanged.

Search, pagination, opening the panel, and preview playback cost zero credits. First acquisition into a project costs one credit for a stock photo and two credits for a stock video across Draft, Standard, Pro, and Cinematic. These credits represent discovery, secure acquisition, project integration, source/license metadata, storage, and workflow convenience. They do not represent provider dollars: Pexels COGS remains `not_billable` and `$0`, while infrastructure USD remains unpriced.

The commercial acquisition identity is the owner/project-scoped hash of provider, media type, and provider media ID; rendition is deliberately excluded. An active ready asset returns before storage admission, reservation, provider lookup, download, or upload, with `reused=true` and `creditsCharged=0`. A new import must win the existing unique database claim before reserving canonical credits. The server owns the reservation identity and rejects client economic overrides. Insufficient credits stop before provider access. Successful acquisition settles once; failures release the reservation. Concurrent losers never reserve and receive the existing in-progress response.

## Package revalidation

Stock and reuse are now separate assumptions. Only new stock photos/videos burn credits; reuse is explicitly zero. Candidate prices and provider COGS/margins are unchanged.

| Tier | Previous pool | Revalidated pool | Indicative minutes | Typical credits | P90 credits | Retry-stress credits | Typical stock photo/video credits |
|---|---:|---:|---:|---:|---:|---:|---:|
| Standard | 700 | 800 | ~60 | 652 | 673 | 856 | 48 / 30 |
| Pro | 2,600 | 2,700 | ~90 | 2,273 | 2,428 | 3,036 | 45 / 36 |
| Cinematic | 3,200 | 3,300 | ~60 | 2,795 | 3,269 | 4,071 | 21 / 22 |

The internal package contract is versioned `creator-package-validation-2026-08-23`, remains `beta_candidate`, and is not billing truth. Source/license compliance and the server-only API key, trusted-host download checks, project ownership, storage admission, secure registration, and RLS remain required.
