# Wayfare Mobile

**Your journey, journaled.** Offline-first travel journal for Android and iOS (Expo SDK 57, React Native 0.86).

## Features

- Offline-first journal (SQLite): mood, place, optional weather, **photos**, **voice notes**; edit and delete entries
- Budget (₹, by category) and packing lists (templates + your own items)
- GPS route recording (foreground service on Android, location background mode on iOS), map, GeoJSON export
- PDF journal export; read-only share links you can switch off
- Cloud backup and multi-device sync (Supabase) with tombstoned deletes, incremental pulls and server-stamped timestamps
- Email sign-up with confirmation, password reset, **in-app account deletion**, guest mode (no account)
- App lock (biometrics / device passcode), dark mode, accessibility labels

## Develop

```bash
cd apps/wayfare-mobile
npm ci
cp .env.example .env.local     # optional: points at the hosted Supabase project
npm run assets:generate        # regenerate icons (needs Pillow)
npm start                      # needs a development build: expo-location/maps/etc. are native modules
npm test                       # 45 unit/integration tests (real SQLite, fake Supabase server)
npm run typecheck
```

Native-module note: Expo Go does not include every module used here (background location, Maps). Use `eas build --profile development` for a dev client.

## Architecture

| Layer | Where |
| --- | --- |
| Screens (Expo Router) | `app/` |
| Local database + migrations (`PRAGMA user_version`) | `src/lib/localDb.ts` |
| Sync engine | `src/lib/sync.ts` — push pending → tombstones → pull by server cursor; single-flight; local edits win |
| Account/data ownership | `claimLocalData()` — guest data is adopted on first sign-in; another account's data is never uploaded |
| Supabase schema, RLS, storage, edge function | `/supabase` |

Sync rules in one paragraph: the server stamps `updated_at`, so device clocks never matter; each table has a pull cursor with a 2-minute overlap; a row edited locally stays "pending" and is pushed over the server copy; deletes are tombstones (`deleted_at`) so other devices learn about them; deleting a trip hard-deletes its cloud children first, then tombstones the trip.

## Release

See `store/SUBMISSION_CHECKLIST.md`. CI (`wayfare-ci.yml`) runs typecheck, tests, a Metro bundle for both platforms, a native prebuild and `scripts/check-native-config.mjs` (permission guard). `wayfare-eas-build.yml` is a manual release trigger.
