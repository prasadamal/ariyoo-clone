# EAS project + environment variables — Wayfare

## 1. Link the Expo project (once)

```bash
cd apps/wayfare-mobile
npx eas-cli login
npx eas-cli init
```

`app.config.ts` is a dynamic config, so `eas init` cannot write the project id itself: it prints
the id and asks you to add it. Paste it into `app.config.ts`:

```ts
const easProjectId = process.env.EAS_PROJECT_ID || 'PASTE-THE-PROJECT-ID-HERE';
```

and commit. EAS builds need it, and so does remote push (without it the app still schedules local
reminders, but cannot receive push notifications). EAS CLI does not read `.env` files, so an
`EAS_PROJECT_ID` in `.env.local` only affects `expo start`.

## 2. Environment variables (production builds)

`EXPO_PUBLIC_*` values are compiled into the app, so use **plain text** or **sensitive** visibility
(never *secret* — those are not available while the app config and bundle are prepared). Set them in
expo.dev → Project settings → Environment variables, or with EAS CLI:

```bash
eas env:set --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT.supabase.co
eas env:set --environment production --visibility sensitive --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY
# Optional (maps need no key: they use free OpenStreetMap tiles from OpenFreeMap)
eas env:set --environment production --visibility plaintext --name EXPO_PUBLIC_WAYFARE_SHARE_BASE --value https://YOUR_PAGES/wayfare-share/index.html
eas env:set --environment production --visibility plaintext --name EXPO_PUBLIC_WAYFARE_LIVE_BASE --value https://YOUR_PAGES/wayfare-live/index.html
```

Repeat with `--environment preview` for internal test builds (`eas build --profile preview`).
`eas env:list --environment production` shows what is set.

The production profile in `eas.json` picks the `production` environment automatically (store
distribution). A build without the Supabase variables still works — as an offline journal with
community features switched off — and placeholder values from the docs are treated the same way.

## 3. Push credentials

- **iOS:** when `eas build` sets up credentials it offers to create an Apple Push Notifications key — accept.
- **Android (FCM V1):**
  1. Create a Firebase project and add an Android app with package `com.wayfare.app`.
  2. Download `google-services.json` and save it as `apps/wayfare-mobile/google-services.json`
     (it only holds public identifiers and may be committed; `app.config.ts` picks it up
     automatically). Alternatively upload it as an EAS *file* variable named `GOOGLE_SERVICES_JSON`.
  3. Firebase → Project settings → Service accounts → *Generate new private key*, then
     `eas credentials` → Android → production → Google Service Account → *Manage your Google
     Service Account Key for Push Notifications (FCM V1)* → upload it. Never commit this key.

Without these the app still works; enabling notifications then keeps local reminders only.
Details: <https://docs.expo.dev/push-notifications/fcm-credentials/>.

## 4. CI

Repository secret `EXPO_TOKEN` (expo.dev → Access tokens) lets
`.github/workflows/wayfare-eas-build.yml` start builds after the tests pass.
