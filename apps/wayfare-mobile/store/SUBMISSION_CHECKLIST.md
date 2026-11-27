# Wayfare — Play Store & App Store checklist

Package / bundle: **`com.wayfare.app`** · App path: **`apps/wayfare-mobile`**

Full dual-app guide: **[`docs/STORE_PUBLISHING_CHECKLIST.md`](../../../docs/STORE_PUBLISHING_CHECKLIST.md)** · **Your next steps:** [`docs/STORE_START_HERE.md`](../../../docs/STORE_START_HERE.md).

### Repo-ready

- [x] `eas.json`, listings, Play assets, privacy HTML, data safety + review notes
- [x] Supabase migrations + `supabase/README.md`

## 1. Expo / EAS

```bash
cd apps/wayfare-mobile
npm ci
npm i -g eas-cli
eas login
eas init
```

- [ ] Paste the project id `eas init` prints into `easProjectId` in `app.config.ts` and commit
- [ ] EAS environment variables (`production`, and `preview` for test builds), plain text or sensitive:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Push: accept the iOS push key during the first build; Android `google-services.json` + FCM V1 key
- Details for all three: [`EAS_SECRETS.md`](EAS_SECRETS.md)

```bash
npm run verify            # typecheck + unit tests
eas env:pull --environment production   # writes .env.local with the production values
npm run preflight         # stops if the build would ship without its backend or web viewers
npm run build:android
npm run build:ios
npm run submit:android   # after service account configured
npm run submit:ios
```

## 2. Supabase (production)

- [ ] Apply **all** migrations in `supabase/migrations` in order (see `supabase/README.md`)
- [ ] Buckets: `entry-media` + `chat-media` private, `avatars` + `post-media` public
- [ ] Realtime publication includes `messages` and `notifications`
- [ ] Deploy the `push` Edge Function + two Database Webhooks (notifications, messages)
- [ ] Fill `docs/wayfare-config.js` (URL + anon key) so share and live links work on the web
- [ ] Reviewer + buddy demo accounts and `supabase/scripts/reviewer_demo_seed.sql`
- [ ] Someone owns the daily moderation review (`supabase/MODERATION.md`)
- [ ] Email auth tested on a physical device (confirmation link opens the app)

## 3. Google Play

- [ ] App created with package `com.wayfare.app`
- [ ] Listing: `store/play-store-listing.md`
- [ ] Privacy policy HTTPS URL (draft: `store/PRIVACY_POLICY.md`)
- [ ] Data safety + foreground-service (location) declaration: `store/DATA_SAFETY_AND_PRIVACY.md`
  (no background-location or photo-permission declarations: those permissions are not requested)
- [ ] Target API: Expo SDK 57 builds target Android 16 / API 36, which Play requires for new apps
  and updates since 31 Aug 2026; iOS builds use Xcode 26 on EAS (required since 28 Apr 2026)
- [ ] Content rating questionnaire (users interact / share location)
- [ ] AAB from EAS production → Internal → Production
- [ ] `store/google-play-service-account.json` for `eas submit` (gitignored; copy from Ariyoo `.example` pattern)

## 4. Apple App Store (no Mac for compile)

- [ ] Developer Program + App ID `com.wayfare.app`
- [ ] App Store Connect app record
- [ ] `eas.json` submit.ios: `appleId`, `ascAppId`, `appleTeamId`
- [ ] Listing: `store/app-store-listing.md`
- [ ] App Privacy labels per `store/APP_STORE_PRIVACY.md`
- [ ] Custom EULA = Terms of Use URL; age rating questionnaire per `store/app-store-listing.md` (journal-only build: expect 13+ or 16+)
- [ ] TestFlight → App Review with demo credentials and `store/APP_STORE_REVIEW_NOTES.md`

## 5. Device QA

- [ ] Offline trip + journal + budget + packing
- [ ] Sign in + Sync now (all entity types)
- [ ] Photo attach + sync
- [ ] GPS record + GeoJSON export

## Costs

| Item | Cost |
| --- | --- |
| Google Play | $25 once |
| Apple Developer | $99/year |
| Supabase / EAS | Free tier for MVP |
