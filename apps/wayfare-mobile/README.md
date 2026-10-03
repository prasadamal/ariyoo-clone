# Wayfare Mobile

**Your journey, journaled. Your people, found.** — Phase 1 MVP inside the ariyoo monorepo (separate product).

## What ships (v1.1 — Play Store ready)

- **Onboarding** + polished journeys home with trip stats synopsis
- Offline-first journal (SQLite) with **mood chips**, place tags, **live weather** (Open-Meteo)
- **Photos** per entry + cloud sync (Supabase Storage)
- Budget (INR categories) + packing progress
- **Route map** (polyline), GPS recording, GeoJSON share
- **PDF travel journal** export (share sheet)
- **Explore** — 5 Himalayan trek guides → one-tap trip wizard
- **Biometric app lock** (optional), auto-sync on foreground
- Full cloud sync when Supabase is configured
- Bundle id: `com.wayfare.app`

## Later phases

- Social feed, place chat, Year Wrapped
- Server verification tiers, Mapbox offline tiles
- Voice notes and on-device AI summaries

## Setup

```bash
cd apps/wayfare-mobile
npm ci
npm run assets:generate
cp .env.example .env.local   # optional
```

### Supabase (recommended)

1. Create a free Supabase project.
2. Run migrations (in order):
   - `supabase/migrations/20261003000000_wayfare_mvp.sql`
   - `supabase/migrations/20261003120000_wayfare_media_storage.sql`
3. Set in `.env.local` or EAS secrets:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Without Supabase, the app runs in **offline journal mode** (local only).

## Run

```bash
npm start
# Android: press a or npm run android
# iOS (Mac or EAS): npm run ios / eas build --platform ios
```

## Store builds

```bash
eas login && eas init
npm run build:all
```

See `store/SUBMISSION_CHECKLIST.md`.
