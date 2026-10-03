# Wayfare — Play Store & App Store checklist

Package / bundle: **`com.wayfare.app`** · App path: **`apps/wayfare-mobile`** · Expo SDK 57 (Android target API 36, iOS 16.4+)

Cross-app overview: [`docs/STORE_START_HERE.md`](../../../docs/STORE_START_HERE.md)

## Already done in the repo (verified)

- [x] Production Supabase schema, RLS, private storage, share RPC, delete-account edge function (`supabase/`)
- [x] Hosted project `ujtylwimukufmbungnju` migrated and checked with the security/performance advisors
- [x] Expo SDK 57 / React Native 0.86 / React 19; Android target API 36; icons with no alpha channel
- [x] Minimal permissions (no background location, camera, storage); iOS background mode `location` only — enforced by `scripts/check-native-config.mjs` in CI
- [x] In-app account deletion + public deletion page; privacy policy; Data-safety answers (`DATA_SAFETY_AND_PRIVACY.md`)
- [x] 45 automated tests (sync engine, migrations, validation) + CI (`.github/workflows/wayfare-ci.yml`)

## 1. Accounts & EAS (you)

```bash
cd apps/wayfare-mobile
npm ci
npm i -g eas-cli
eas login
eas init                       # writes the real project id -> commit it, or export EAS_PROJECT_ID
```

- [ ] `EAS_PROJECT_ID` set (app.config.ts reads it; EAS prompts if missing)
- [ ] **Android map key** (required for the Route map on Android):
      `eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value <Maps SDK for Android key>` — restrict the key to package `com.wayfare.app` + your SHA-1s
- [ ] GitHub repo secret `EXPO_TOKEN` (for the manual release workflow)
- [ ] `eas.json` → `submit.production.ios` (Apple ID, ASC app id, team id)
- [ ] `store/google-play-service-account.json` (Play Console → API access; gitignored)

Supabase URL/key are already set in `eas.json` (public client values).

## 2. Supabase dashboard (you) — see `supabase/README.md`

- [ ] Auth → Providers → Email: **Confirm email ON**, min password length 8, leaked-password protection ON
- [ ] Auth → URL Configuration: add redirect `wayfare://auth/callback`
- [ ] Auth → SMTP: custom sender (built-in mailer is rate-limited)
- [ ] Approve/apply `20261004000100_wayfare_drop_legacy.sql` (drops the empty legacy tables)
- [ ] Reviewer user + `supabase/scripts/reviewer_demo_seed.sql`
- [ ] Upgrade off the free tier before launch if you want automated backups (Pro)

## 3. Build & test on real devices

```bash
npm run typecheck && npm test
eas build --platform android --profile preview     # installable APK
eas build --platform ios --profile preview         # needs Apple dev account / registered device
```

Device QA (use `docs/` of the repo-level checklist): airplane-mode journaling, sync after reconnect, photo + voice note round trip, route recording with screen off (Android notification / iOS indicator), app lock cold start, sign-up email link + password reset deep links, share link opens in browser, delete account.

## 4. Google Play

- [ ] App created, package `com.wayfare.app`
- [ ] Listing: `play-store-listing.md`; icon `play-icon-512.png`; feature graphic `feature-graphic.png`; screenshots from the real app
- [ ] Privacy policy URL + **Account deletion URL** (both in the listing file)
- [ ] Data safety: follow `DATA_SAFETY_AND_PRIVACY.md`
- [ ] Foreground-service (location) declaration + demo video (instructions in `DATA_SAFETY_AND_PRIVACY.md`)
- [ ] App access: reviewer credentials from `APP_REVIEW_NOTES.md`
- [ ] Internal testing → closed testing (new personal accounts need 12 testers for 14 days) → production

## 5. Apple App Store

- [ ] Developer Program, App ID `com.wayfare.app`, App Store Connect record
- [ ] Listing: `app-store-listing.md`; iPhone 6.7" screenshots (iPhone-only app)
- [ ] App Privacy answers: `DATA_SAFETY_AND_PRIVACY.md`
- [ ] Review notes + demo account: `APP_REVIEW_NOTES.md`
- [ ] TestFlight → submit for review
- [ ] Newer Xcode/iOS SDK requirement: when Apple mandates Xcode 27 builds, add `["expo-build-properties", { "ios": { "enableSceneSupport": true } }]` on SDK 57 (or upgrade to SDK 58+, which includes it).
