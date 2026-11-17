# EAS project + environment variables — Ariyoo

## 1. Link the Expo project (once)

```bash
cd apps/mobile
npm ci
npx eas-cli login
npx eas-cli init
```

`app.config.ts` is a dynamic config, so `eas init` cannot write the project id itself: it prints
the id and asks you to add it. Paste it into `app.config.ts` and commit:

```ts
const easProjectId = process.env.EAS_PROJECT_ID || 'PASTE-THE-PROJECT-ID-HERE';
```

EAS builds need it, and so do push notifications.

## 2. Server address (required)

The app has no built-in server address. Set it as an EAS environment variable for both the
`production` and the `preview` environment, **after** the API is deployed (`services/api/DEPLOY_PRODUCTION.md`):

```bash
eas env:create --environment production --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_API_URL --value https://YOUR-API-HOST
```

No trailing slash, no `/api`. It must be `https`.

## 3. Check before every store build

```bash
eas env:pull --environment production   # writes .env.local
npm run preflight                       # must end with "Ready for a store build."
```

A build made without the address opens on an "Ariyoo is not connected" screen; the preflight
catches that before you spend a build.

## 4. Push notifications

Experts are told about new questions by push, so set this up before inviting any.

- **iOS:** when `eas build` sets up credentials it offers to create an Apple Push Notifications key — accept.
- **Android (FCM V1):**
  1. Create a Firebase project and add an Android app with package `com.ariyoo.mobile`.
  2. Download `google-services.json` and save it as `apps/mobile/google-services.json`
     (it holds only public identifiers and may be committed), or upload it as an EAS *file*
     variable named `GOOGLE_SERVICES_JSON`.
  3. Firebase → Project settings → Service accounts → *Generate new private key*, then
     `eas credentials` → Android → production → Google Service Account → *Manage your Google
     Service Account Key for Push Notifications (FCM V1)* → upload it. Never commit this key.

## 5. CI

Add the repository secret `EXPO_TOKEN` (expo.dev → Access tokens) to let the
"Mobile EAS Build" workflow start builds when you run it by hand.
