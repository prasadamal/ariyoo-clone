# Wayfare Mobile

**Your journey, journaled. Your people, found.** A travel journal that works offline, plus a
traveller network for finding people heading where you are going — built with Expo (SDK 57),
React Native Paper and Supabase.

## What's in 2.0

**Journal (offline-first, SQLite)**
- Journeys with destination autocomplete (45-place catalog), dates, companions, currency, budget
- Moments with photos (camera or library, compressed), voice notes, mood, weather, geotag + altitude; edit/delete
- Day-by-day **plan** with times, check-off and live daily forecasts
- **Budget**: multi-currency expenses (cached FX rates, offline), category breakdown, budget progress,
  paid-by / split-between companions and minimal **settle-up** transfers
- **Packing** lists that adapt to trip type, altitude and season; add/remove/reset
- **Route**: background GPS recording (battery-saver or precise), map with entry pins, distance,
  elevation gain, high point, elevation profile, GPX/GeoJSON export
- PDF journal export, read-only web share links, “Next up” countdown, phase filters

**Community (Supabase)**
- Profiles with avatar, bio, travel styles, **GPS-verified** distance/altitude and traveller tiers
- Follow travellers; Following / Trending / Latest **feed**; posts with photos, places and verified route shapes; likes, comments
- **Trip matching**: see who is heading to the same place around your dates (opt-in, reciprocal)
- **Travel board**: trek buddies, meetups, ride shares, stay shares → join requests → crew chat
- **Nearby**: opt-in, ~1 km approximate presence for a few hours
- **Destination pages**: guide, best-months strip, forecast, who's heading there, room, upvoted tips, board, posts
- **Chat**: direct messages, crew groups with invite codes/deep links, destination rooms — realtime,
  photos, locations, unsend, mute, members
- Notifications centre + Expo push (Edge Function), unread badges

**Safety**
- One-tap SOS SMS with location (and live link) to emergency contacts stored on the device
- Expiring **live-location links** viewable on the web without the app
- Check-in timer with escalating local reminders, per-country emergency numbers, altitude guide

**Trust & compliance**
- Community guidelines gate, report + block on every kind of content, on-device text filter,
  server auto-hide after 3 reports, in-app account deletion, biometric app lock, guest mode

## Preview in a browser (for UI work)

```bash
npm install
npm run web        # opens http://localhost:8081
```

Changes you save appear in the browser straight away. The preview runs as a guest, so the offline
journal, planning, budget, packing and settings all work, and entries are kept in the browser. Not available in
the browser: the route map (a placeholder is shown), background location, voice notes, notifications and
cloud features, which need the phone app. To try cloud features, copy `.env.example` to `.env.local`
and fill in the Supabase values.

## Architecture

```
app/                    expo-router screens (5 tabs: Journeys, Discover, Connect, Inbox, You)
src/lib/                offline data (localDb, sync, media, location task) + pure logic (split, geo, tiers…)
src/social/             typed API over Supabase RPCs (feed, chat, board, places, connect…)
src/features/           larger screen sections (trip tabs, connect sections, tips)
src/ui/ · components/   design system + shared components
src/content/            destinations, packing templates, safety + guidelines copy
```

- The journal is local-first: every write lands in SQLite (`sync_status = 'pending'`); `syncAll`
  pushes deletes (tombstones) → upserts (batched, edit-safe) → pulls (paginated, last-writer-wins,
  cross-device delete reconciliation, keyset-paginated track points) → media uploads.
- One device holds one account's journal; signing in to a different account offers a clean start
  instead of mixing journals.
- Community features talk to Supabase directly; permissions live in Postgres RLS + RPCs
  (`supabase/migrations`), tested in `supabase/tests`.

## Setup

```bash
cd apps/wayfare-mobile
npm ci
cp .env.example .env.local   # optional — without it the app runs as an offline journal
npm start
```

Backend: follow [`supabase/README.md`](../../supabase/README.md).

## Checks

```bash
npm run typecheck        # TypeScript (run `npx expo start` once to generate typed routes)
npm test                 # unit tests for pure logic (split, currency, places, geo, badges, wrapped…)
npm run test:db          # SQL/RLS test-suite on a local Postgres (see supabase/README.md)
npm run preflight        # before a store build: lists missing or placeholder release values
npx expo export --platform android   # full Metro/Hermes bundle
```

## Store builds

```bash
eas login && eas init
npm run build:all
```

See `store/SUBMISSION_CHECKLIST.md`, `store/DATA_SAFETY_AND_PRIVACY.md` and `store/APP_REVIEW_NOTES.md`.
