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

- [x] Supabase SQL migrations in `supabase/migrations/`
- [x] Setup guide: `supabase/README.md`
- [x] Reviewer demo SQL template: `supabase/scripts/reviewer_demo_seed.sql`

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

- [ ] Create Supabase project; run migrations per `supabase/README.md`
- [ ] Run `supabase/scripts/reviewer_demo_seed.sql` (edit emails/passwords first)
- [ ] EAS secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4. EAS (per app)

```bash
cd apps/mobile          # repeat for apps/wayfare-mobile
npm ci
eas login
eas init
```

- [ ] Copy real `projectId` into `app.config.ts`
- [ ] `eas secret:create` for production env vars (preferred over committing secrets)
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
