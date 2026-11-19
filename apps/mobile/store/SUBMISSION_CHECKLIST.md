# App Store & Play Store submission checklist — Ariyoo

Package / bundle: **`com.ariyoo.mobile`** · App path: **`apps/mobile`**

Full dual-app guide: **[`docs/STORE_PUBLISHING_CHECKLIST.md`](../../../docs/STORE_PUBLISHING_CHECKLIST.md)** · **Your next steps:** [`docs/STORE_START_HERE.md`](../../../docs/STORE_START_HERE.md).

### Repo-ready (no account needed)

- [x] `eas.json`, `app.config.ts`, listing markdown, `play-icon-512.png`, `feature-graphic.png`
- [x] `PRIVACY_POLICY.md` + hosted HTML (`docs/privacy/ariyoo.html`)
- [x] `DATA_SAFETY_AND_PRIVACY.md`, `APP_REVIEW_NOTES.md`, `EAS_SECRETS.md`
- [x] API `Dockerfile` + `DEPLOY_PRODUCTION.md`

Complete these steps once before your first store upload.

## 1. Expo / EAS project

Follow [`EAS_SECRETS.md`](EAS_SECRETS.md): link the project, paste the project id into
`app.config.ts`, set `EXPO_PUBLIC_API_URL`, set up push. Deploy the API first
(`services/api/DEPLOY_PRODUCTION.md`) and set `ADMIN_API_KEY` on it.

```bash
cd apps/mobile
npm ci
npm run verify                         # typecheck + unit tests
eas env:pull --environment production
npm run preflight                      # must end with "Ready for a store build."
```

## 2. Apple (iOS)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create an App ID: `com.ariyoo.mobile` in Certificates, Identifiers & Profiles.
3. Create an app record in [App Store Connect](https://appstoreconnect.apple.com/) with bundle ID `com.ariyoo.mobile`.
4. Update `eas.json` → `submit.production.ios` with `appleId`, `ascAppId`, `appleTeamId`.
5. Build: `npm run build:ios` (or `eas build --platform ios --profile production`).
6. Submit: `npm run submit:ios` or upload the `.ipa` from the EAS build page.
7. Complete the App Privacy questionnaire from `DATA_SAFETY_AND_PRIVACY.md`. Set the age rating to 17+.
8. Add screenshots (6.7", 6.5", 5.5" iPhone) — see `store/app-store-listing.md`.

## 3. Google Play (Android)

1. Create a [Google Play Console](https://play.google.com/console) developer account ($25 one-time).
2. Create app with package `com.ariyoo.mobile`.
3. Create a service account with Play Console API access; download JSON key to  
   `apps/mobile/store/google-play-service-account.json` (gitignored).
4. Build: `npm run build:android` (AAB for production profile).
5. Submit: `npm run submit:android` or upload AAB manually to Internal testing track first.
6. Complete the Data safety form from `DATA_SAFETY_AND_PRIVACY.md`, and enter the account deletion URL from `APP_REVIEW_NOTES.md`.
7. Upload feature graphic and phone screenshots.

## 4. Legal & compliance

- [x] Privacy policy, terms and account-deletion pages are live on https://ariyoo-docs.onrender.com (checked 19 Nov 2026; `APP_REVIEW_NOTES.md` lists the URLs).
- [ ] `support@ariyoo.app` and `privacy@ariyoo.app` reach a real inbox, or change them in `src/config.ts` and the three pages in `docs/privacy/`.
- [ ] Someone checks the report queue every day (`services/api/MODERATION.md`). The stores and the Terms require action within 24 hours.
- [ ] Two reviewer accounts exist on production (`APP_REVIEW_NOTES.md`).
- [ ] Age rating and content questionnaires completed on both stores (18+, user-generated content with moderation).

## 5. Device test (one Android phone and one iPhone, real builds)

```bash
eas build --platform all --profile preview
```

| # | Do | Expect |
| --- | --- | --- |
| 1 | Register without ticking the terms box | Button stays disabled |
| 2 | Register account A (asker) and, on the other phone, B (expert) with topic `goa` | Both land on Ask |
| 3 | A asks "… #goa" | Conversation opens; B gets a notification and sees it under Chats |
| 4 | B replies; A replies with a photo | Both see messages live; A's photo opens for B; no permission prompt for photos |
| 5 | A asks a question with no topic | A sees "Waiting for an expert"; B sees it under "Open questions" and taps Answer |
| 6 | Tap a notification with the app closed | Opens that conversation |
| 7 | A reports B from the ⋮ menu | Conversation disappears for both; report appears in `/admin/reports` |
| 8 | A unblocks B in Profile | B is listed, then removed |
| 9 | Airplane mode, send a message | Error shown, draft kept; works again when back online |
| 10 | Kill and reopen the app | Still signed in |
| 11 | Suspend B from the admin API | B is signed out on the next action and cannot sign in |
| 12 | A deletes the account in Profile | Returns to sign-in; signing in again fails; B no longer sees A's conversations |
| 13 | Sign out on one phone, sign in as someone else | No notifications for the previous account |

## 6. CI

`.github/workflows/mobile-eas-build.yml` runs typecheck, unit tests, both bundles and native
project generation on every pull request. With the `EXPO_TOKEN` secret set, running it by hand
(Actions → Mobile EAS Build → Run workflow) also starts a production EAS build.
