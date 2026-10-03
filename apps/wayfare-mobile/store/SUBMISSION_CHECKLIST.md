# Wayfare — Play Store & App Store checklist

Package / bundle: **`com.wayfare.app`** · App path: **`apps/wayfare-mobile`**

Full dual-app guide: **[`docs/STORE_PUBLISHING_CHECKLIST.md`](../../../docs/STORE_PUBLISHING_CHECKLIST.md)** (Ariyoo + Wayfare).

## 1. Expo / EAS

```bash
cd apps/wayfare-mobile
npm ci
npm i -g eas-cli
eas login
eas init
```

- [ ] Real `extra.eas.projectId` in `app.config.ts`
- [ ] Production secrets in EAS (not placeholders in `eas.json`):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

```bash
npm run typecheck
npm run build:android
npm run build:ios
npm run submit:android   # after service account configured
npm run submit:ios
```

## 2. Supabase (production)

- [ ] Run migrations `20261003000000_wayfare_mvp.sql` then `20261003120000_wayfare_media_storage.sql`
- [ ] Reviewer demo user + sample trip with photo synced
- [ ] Email auth tested on physical device

## 3. Google Play

- [ ] App created with package `com.wayfare.app`
- [ ] Listing: `store/play-store-listing.md`
- [ ] Privacy policy HTTPS URL (draft: `store/PRIVACY_POLICY.md`)
- [ ] Data safety: account, photos, location, user content
- [ ] AAB from EAS production → Internal → Production
- [ ] `store/google-play-service-account.json` for `eas submit` (gitignored; copy from Ariyoo `.example` pattern)

## 4. Apple App Store (no Mac for compile)

- [ ] Developer Program + App ID `com.wayfare.app`
- [ ] App Store Connect app record
- [ ] `eas.json` submit.ios: `appleId`, `ascAppId`, `appleTeamId`
- [ ] Listing: `store/app-store-listing.md`
- [ ] App Privacy labels (account, content, location)
- [ ] TestFlight → App Review with demo credentials

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
