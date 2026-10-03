# Wayfare Mobile

**Your journey, journaled. Your people, found.** — Phase 1 MVP inside the ariyoo monorepo (separate product).

## What ships in this MVP

- Offline-first trip journal (SQLite on device)
- Trip wizard, timeline entries, mood & place tags
- **Journal photos** (local + Supabase Storage when synced)
- Budget log (INR) and packing checklists by trip type
- GPS route recording (foreground/background task) + **GeoJSON export**
- Trek utility cards (Himalayan beachhead content)
- **Full cloud sync** (trips, entries, expenses, packing, track points, media) via Profile → Sync now
- Supabase auth (when configured)
- Production bundle id: `com.wayfare.app`

## Not in this MVP (later phases)

- Place chat rooms, public feed, Year Wrapped
- Server-side tier verification pipeline
- Mapbox route playback, offline tiles, PDF travel books
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
