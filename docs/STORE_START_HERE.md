# Store publishing — start here

This repo is prepared so **you** only need accounts, cloud projects, and EAS linking. Everything below marked **DONE** is already in the repository.

## Privacy policy URLs (after GitHub Pages)

1. In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (one-time).
2. Merge to `main` (or run workflow on this branch) so `Deploy privacy policies` runs.
3. Use these URLs in both stores (replace org/repo if you fork):

| App | URL |
| --- | --- |
| Ariyoo | `https://prasadamal.github.io/ariyoo-clone/privacy/ariyoo.html` |
| Wayfare | `https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html` |

Support email used in listings: **support@ariyoo.app** · Privacy: **privacy@ariyoo.app**

---

## DONE in repo (both apps)

- [x] Bundle IDs, permissions, encryption flags in `app.config.ts`
- [x] `eas.json` production/preview profiles + submit template
- [x] Store listing copy (Play + App Store) under each `apps/*/store/`
- [x] Privacy policy HTML + Pages workflow (`docs/privacy/`)
- [x] Data safety / App Privacy answer sheets (`store/DATA_SAFETY_AND_PRIVACY.md`)
- [x] App Review notes templates (`store/APP_REVIEW_NOTES.md`)
- [x] Play Console icon 512 + feature graphic 1024×500 (`store/play-icon-512.png`, `store/feature-graphic.png`)
- [x] Google Play service account JSON **example** (`store/google-play-service-account.json.example`)
- [x] `npm run typecheck` + submit scripts
- [x] CI: typecheck + optional EAS (`/.github/workflows/`)

## Ariyoo — DONE in repo

- [x] API smoke script: `services/api/scripts/smoke-flow.mjs`
- [x] Production deploy template: `services/api/DEPLOY_PRODUCTION.md` + `Dockerfile`
- [x] Demo seed users documented in `store/APP_REVIEW_NOTES.md`
- [x] `.env.example` for mobile + API

## Wayfare — DONE in repo

- [x] Supabase migrations (journal sync, traveller network, chat, board, safety) in `supabase/migrations/`
- [x] Setup guide: `supabase/README.md` · moderation runbook: `supabase/MODERATION.md`
- [x] Push-notification Edge Function: `supabase/functions/push`
- [x] Reviewer demo data: `supabase/scripts/reviewer_demo_seed.sql` (two accounts, matched trip, chat)
- [x] Web viewers for share links + live location: `docs/wayfare-share`, `docs/wayfare-live` (config in `docs/wayfare-config.js`)
- [x] Privacy policy v2 + Terms of Use (`docs/privacy/wayfare.html`, `docs/privacy/wayfare-terms.html`)
- [x] CI: `.github/workflows/wayfare-tests.yml` (typecheck, unit tests, bundles, database + API tests)

---

## YOUR turn (in order)

### 1. Accounts (once)

- [ ] Google Play Console ($25)
- [ ] Apple Developer ($99/year)
- [ ] [expo.dev](https://expo.dev) account

### 2. Ariyoo backend

- [ ] Deploy API per `services/api/DEPLOY_PRODUCTION.md` → note HTTPS URL
- [ ] Run `prisma migrate deploy` + `prisma:seed` on production DB
- [ ] Set `EXPO_PUBLIC_API_URL` in EAS secrets for `apps/mobile`

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
npm run build:all
npm run submit:android
npm run submit:ios
```

- [ ] Create **two** Play apps + **two** App Store Connect apps
- [ ] Paste listing text from `store/play-store-listing.md` & `app-store-listing.md`
- [ ] Upload screenshots from **preview/production builds on real devices**
- [ ] Complete Data safety + App Privacy using `store/DATA_SAFETY_AND_PRIVACY.md`

Full checklist: [`STORE_PUBLISHING_CHECKLIST.md`](STORE_PUBLISHING_CHECKLIST.md).
