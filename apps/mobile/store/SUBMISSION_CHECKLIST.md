# App Store & Play Store submission checklist — Ariyoo

Package / bundle: **`com.ariyoo.mobile`** · App path: **`apps/mobile`**

Full dual-app guide: **[`docs/STORE_PUBLISHING_CHECKLIST.md`](../../../docs/STORE_PUBLISHING_CHECKLIST.md)** (Ariyoo + Wayfare).

Complete these steps once before your first store upload.

## 1. Expo / EAS project

```bash
cd apps/mobile
npm ci
npm i -g eas-cli
eas login
eas init   # links project; updates app.config.ts extra.eas.projectId
```

Set secrets in Expo dashboard or locally:

- `EXPO_PUBLIC_API_URL` → your production API (HTTPS)
- Deploy `services/api` with PostgreSQL and set `JWT_SECRET`

## 2. Apple (iOS)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create an App ID: `com.ariyoo.mobile` in Certificates, Identifiers & Profiles.
3. Create an app record in [App Store Connect](https://appstoreconnect.apple.com/) with bundle ID `com.ariyoo.mobile`.
4. Update `eas.json` → `submit.production.ios` with `appleId`, `ascAppId`, `appleTeamId`.
5. Build: `npm run build:ios` (or `eas build --platform ios --profile production`).
6. Submit: `npm run submit:ios` or upload the `.ipa` from the EAS build page.
7. Complete App Privacy questionnaire (email, user content, diagnostics).
8. Add screenshots (6.7", 6.5", 5.5" iPhone) — see `store/app-store-listing.md`.

## 3. Google Play (Android)

1. Create a [Google Play Console](https://play.google.com/console) developer account ($25 one-time).
2. Create app with package `com.ariyoo.mobile`.
3. Create a service account with Play Console API access; download JSON key to  
   `apps/mobile/store/google-play-service-account.json` (gitignored).
4. Build: `npm run build:android` (AAB for production profile).
5. Submit: `npm run submit:android` or upload AAB manually to Internal testing track first.
6. Complete Data safety form (account info, messages, photos).
7. Upload feature graphic and phone screenshots.

## 4. Legal & compliance

- [ ] Host privacy policy at a public HTTPS URL (template: `store/PRIVACY_POLICY.md`).
- [ ] Support email active (`support@ariyoo.app` or your domain).
- [ ] Age rating / content questionnaire completed on both stores.

## 5. Pre-submission QA

```bash
npm run typecheck
eas build --platform all --profile preview   # internal APK/TestFlight
```

Test on physical devices:

- Register new user
- Ask question with tags → opens chat
- Send text + image
- Solver mode toggle on profile
- Sign out / sign in

## 6. CI (optional)

See `.github/workflows/mobile-eas-build.yml` — requires `EXPO_TOKEN` repository secret.
