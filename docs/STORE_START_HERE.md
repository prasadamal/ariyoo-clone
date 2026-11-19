# Store publishing — start here

This repo is prepared so **you** only need accounts, cloud projects, and EAS linking. Everything below marked **DONE** is already in the repository.

## Privacy policy URLs (live)

The free Render static site `ariyoo-docs` publishes the `docs/` folder from `main` on every push
(GitHub Pages is not available for this private repository). Use these URLs in both stores:

| App | URL |
| --- | --- |
| Ariyoo | `https://ariyoo-docs.onrender.com/privacy/ariyoo.html` (terms: `ariyoo-terms.html`, deletion: `ariyoo-delete-account.html`) |
| Wayfare | `https://ariyoo-docs.onrender.com/privacy/wayfare.html` |

Support email used in listings: **support@ariyoo.app** · Privacy: **privacy@ariyoo.app**

---

## DONE in repo (both apps)

- [x] Bundle IDs, permissions, encryption flags in `app.config.ts`
- [x] `eas.json` production/preview profiles + submit template
- [x] Store listing copy (Play + App Store) under each `apps/*/store/`
- [x] Privacy policy HTML, served by the `ariyoo-docs` Render static site (`docs/privacy/`)
- [x] Data safety / App Privacy answer sheets (`store/DATA_SAFETY_AND_PRIVACY.md`)
- [x] App Review notes templates (`store/APP_REVIEW_NOTES.md`)
- [x] Play Console icon 512 + feature graphic 1024×500 (`store/play-icon-512.png`, `store/feature-graphic.png`)
- [x] Google Play service account JSON **example** (`store/google-play-service-account.json.example`)
- [x] `npm run typecheck` + submit scripts
- [x] CI: typecheck + optional EAS (`/.github/workflows/`)

## Ariyoo — DONE in repo

- [x] Expo SDK 57 app with terms acceptance, report + block, in-app account deletion, expert topics, open-question queue and push
- [x] Moderation API + runbook: `services/api/MODERATION.md`
- [x] Release preflight: `npm run preflight` in `apps/mobile`
- [x] Device test table: `apps/mobile/store/SUBMISSION_CHECKLIST.md` §5

- [x] API smoke script: `services/api/scripts/smoke-flow.mjs`
- [x] Production deploy template: `services/api/DEPLOY_PRODUCTION.md` + `Dockerfile`
- [x] Reviewer account steps in `store/APP_REVIEW_NOTES.md`
- [x] `.env.example` for mobile + API

## Wayfare — DONE in repo

- [x] Supabase migrations (journal sync, traveller network, chat, board, safety) in `supabase/migrations/`
- [x] Setup guide: `supabase/README.md` · moderation runbook: `supabase/MODERATION.md`
- [x] Push-notification Edge Function: `supabase/functions/push`
- [x] Reviewer demo data: `supabase/scripts/reviewer_demo_seed.sql` (two accounts, matched trip, chat)
- [x] Web viewers for share links + live location: `docs/wayfare-share`, `docs/wayfare-live` (config in `docs/wayfare-config.js`)
- [x] Privacy policy v2 + Terms of Use (`docs/privacy/wayfare.html`, `docs/privacy/wayfare-terms.html`)
- [x] CI: `.github/workflows/wayfare-tests.yml` (typecheck, unit tests, bundles, database + API tests)
- [x] Release preflight: `npm run preflight` in `apps/wayfare-mobile` lists every value still missing for a store build

---

## YOUR turn (in order)

### 1. Accounts (once)

- [ ] Google Play Console ($25)
- [ ] Apple Developer ($99/year)
- [ ] [expo.dev](https://expo.dev) account

### 2. Ariyoo backend

- [ ] Deploy API per `services/api/DEPLOY_PRODUCTION.md` → note HTTPS URL
- [ ] Run `npx prisma migrate deploy` on the production database (do **not** run the demo seed there)
- [ ] Set `ADMIN_API_KEY` on the host (photos are stored in the database, no disk needed); name who checks reports daily (`services/api/MODERATION.md`)
- [ ] Set `EXPO_PUBLIC_API_URL` as an EAS environment variable for `apps/mobile` (`apps/mobile/store/EAS_SECRETS.md`)
- [ ] Register the two reviewer accounts and add yourself as the first expert with real topics

### 3. Wayfare backend

- [ ] Create Supabase project; apply **all** migrations per `supabase/README.md`
- [ ] Deploy the `push` Edge Function + two Database Webhooks (`supabase/README.md` §3)
- [ ] Put the Supabase URL + anon key in `docs/wayfare-config.js` (web share / live-location pages)
- [ ] Sign up the two demo accounts, then run `supabase/scripts/reviewer_demo_seed.sql`
- [ ] Name a moderation owner who checks reports daily (`supabase/MODERATION.md`) — App Store 1.2
- [ ] EAS environment variables + project id + push credentials: `apps/wayfare-mobile/store/EAS_SECRETS.md`

### 4. EAS (per app)

```bash
cd apps/mobile          # repeat for apps/wayfare-mobile
npm ci
eas login
eas init
```

- [ ] Copy real `projectId` into `app.config.ts` (Wayfare: the `easProjectId` constant)
- [ ] Production environment variables on EAS (`eas env:set …`, see each app's `store/` docs)
- [ ] Fill `eas.json` → `submit.production.ios` (Apple ID, ASC app id, team id)
- [ ] Add `store/google-play-service-account.json` (from Play Console API access)

### 5. Builds & store consoles

```bash
npm run typecheck
npm run preflight        # Wayfare only: must end with "Ready for a store build"
npm run build:all
npm run submit:android
npm run submit:ios
```

- [ ] Create **two** Play apps + **two** App Store Connect apps
- [ ] Paste listing text from `store/play-store-listing.md` & `app-store-listing.md`
- [ ] Upload screenshots from **preview/production builds on real devices**
- [ ] Complete Data safety + App Privacy using `store/DATA_SAFETY_AND_PRIVACY.md`

Full checklist: [`STORE_PUBLISHING_CHECKLIST.md`](STORE_PUBLISHING_CHECKLIST.md).
