# VELTO

VELTO is now a focused AI content creation platform with two active product paths:

1. **Storyverse** — child-safe AI story and content creation for ages 8-18.
2. **CreatorLab** — professional AI-powered social media content creation for 18+ creators.

All legacy experimental flows and future lab placeholders have been removed from the active project structure.

## Active routes

- `/` — focused two-product dashboard
- `/dashboard` — same focused dashboard surface
- `/create?flow=storyverse` — Storyverse production workspace
- `/create?flow=creator_lab` — CreatorLab production workspace
- `/episode/[projectId]` — project episode view
- `/episode/public/[shareId]` — public shared project view
- `/login` and `/signup` — authentication routes

## Product direction

### Storyverse

Storyverse remains the child-safe creative experience layer. The product direction is to support safe story, scene, image, voice, video and exportable content creation while enforcing strict content safety boundaries.

### CreatorLab

CreatorLab becomes the professional creator product. The target model is a credit-based content engine with provider-cost-aware pricing, AI image/video quality options, voice generation, thumbnail/caption/script support and future customer usage/credit management.

## Development

```bash
npm run dev
npm run build
npm run lint
```
