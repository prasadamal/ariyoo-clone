# Wayfare — Play Store & App Store (no Mac required for builds)

Wayfare is separate from Ariyoo (`com.wayfare.app`).

## Costs (minimize)

| Item | Cost | When |
| --- | --- | --- |
| Supabase | $0 free tier | Now |
| Google Play | $25 once | Before Android public listing |
| Apple Developer | $99/year | Only when you want TestFlight / App Store |
| EAS | Free tier builds/month | MVP testing |

Build **iOS on Expo EAS** from Linux/Windows — no Mac needed for compiling.

## Before submit

- [ ] Supabase project live with migration applied
- [ ] Privacy policy hosted at public HTTPS URL
- [ ] `eas init` + production env vars
- [ ] Physical device QA: offline entry, sync, GPS recording, budget/packing
- [ ] Screenshots from real app (Android phone; borrow iPhone for Apple sizes)

## Android

1. `npm run build:android` → AAB
2. Play Console → internal → closed test → production
3. Data safety: location, photos, account — no sale of data

## iOS (no Mac)

1. Apple Developer enrollment (browser)
2. `npm run build:ios` on EAS
3. `eas submit --platform ios`
4. TestFlight → App Store review

## Demo account for review

Create a reviewer login on production Supabase with a sample trek trip synced.
