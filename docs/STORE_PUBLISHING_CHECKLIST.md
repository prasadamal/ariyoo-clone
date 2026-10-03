# Store publishing checklist — Ariyoo & Wayfare

> **Start here:** [`STORE_START_HERE.md`](STORE_START_HERE.md) lists what is already done in the repo vs what you must do (accounts, EAS init, deploy).

Both apps live in this monorepo, ship with **Expo EAS**, and can be built **without a Mac** (iOS via EAS cloud + TestFlight).

## Already completed in repository

- [x] App configs, permissions, EAS profiles, submit templates
- [x] Store listing copy + Play icon 512 + feature graphics
- [x] Privacy HTML + GitHub Pages workflow (`docs/privacy/`)
- [x] Data safety / App Privacy answer sheets + App Review note templates
- [x] Ariyoo API Dockerfile + deploy guide + demo seed users
- [x] Wayfare Supabase migrations + setup README
- [x] CI typecheck (+ optional EAS when `EXPO_TOKEN` is set)

| App | Folder | Android package / iOS bundle | Backend |
| --- | --- | --- | --- |
| **Ariyoo** | `apps/mobile` | `com.ariyoo.mobile` | `services/api` (HTTPS + PostgreSQL) |
| **Wayfare** | `apps/wayfare-mobile` | `com.wayfare.app` | Supabase (Auth + DB + Storage) |

---

## Costs (plan once)

| Item | Cost | Needed for |
| --- | --- | --- |
| Google Play Console | $25 one-time | Android (both apps, one account) |
| Apple Developer Program | $99/year | iOS TestFlight + App Store (both apps) |
| Expo EAS | Free tier (limited builds/month) | Cloud builds & submit |
| Hosting | $0–low | API (Ariyoo), Supabase free tier (Wayfare), privacy policy HTTPS |

---

## Phase A — Accounts & legal (both apps)

- [ ] **Google Play Console** developer account created and verified
- [ ] **Apple Developer** enrollment complete (Team ID noted for EAS)
- [ ] **Expo account** + `eas login` on your machine or CI
- [ ] **Privacy policy** on a **public HTTPS URL** (not a raw GitHub markdown link)
  - Ariyoo draft: `apps/mobile/store/PRIVACY_POLICY.md`
  - Wayfare draft: `apps/wayfare-mobile/store/PRIVACY_POLICY.md`
- [ ] **Support email** active and monitored (used in both store consoles)
- [ ] **Marketing site or landing page** (optional but helps review trust)

---

## Phase B — Production backend (per app)

### Ariyoo (`services/api`)

- [ ] API deployed with **HTTPS** only in production (`EXPO_PUBLIC_API_URL`)
- [ ] PostgreSQL provisioned; Prisma migrations applied
- [ ] `JWT_SECRET` set to a strong production value
- [ ] Upload directory / static files for chat images reachable via HTTPS
- [ ] Smoke test: register, login, ask question, chat, image upload
- [ ] Demo accounts for store reviewers (seeker + solver) documented in App Review notes

### Wayfare (Supabase)

- [ ] Supabase project created (production, not dev keys in the app)
- [ ] Migrations applied **in order**:
  1. `supabase/migrations/20261003000000_wayfare_mvp.sql`
  2. `supabase/migrations/20261003120000_wayfare_media_storage.sql`
- [ ] Auth email provider enabled; confirm sign-up flow works on device
- [ ] Storage bucket `entry-media` policies verified (private, user-scoped paths)
- [ ] EAS secrets set: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Demo reviewer account with a sample trek trip + synced photos

---

## Phase C — EAS project setup (repeat per app)

Run from the app directory (`apps/mobile` or `apps/wayfare-mobile`):

```bash
npm ci
npm i -g eas-cli   # if needed
eas login
eas init           # links project; set real projectId in app.config.ts
```

- [ ] `app.config.ts` → `extra.eas.projectId` is the real Expo project UUID
- [ ] `eas.json` production profile env vars point to **production** endpoints
- [ ] `eas.json` submit block filled (Apple IDs; Android service account path)
- [ ] Optional: `EXPO_TOKEN` in GitHub for CI (see `.github/workflows/` if present)

**Build commands (each app):**

```bash
npm run typecheck
npm run build:android    # AAB, production
npm run build:ios        # IPA, production
# or: npm run build:all
```

**Submit commands (Ariyoo has npm scripts; Wayfare: same via eas submit):**

```bash
npm run submit:android   # Ariyoo
npm run submit:ios       # Ariyoo
eas submit --platform android --profile production   # either app
eas submit --platform ios --profile production
```

---

## Phase D — Pre-submission QA (physical devices)

### Ariyoo QA

- [ ] Register new user
- [ ] Ask question with `#tags` → opens chat session
- [ ] Send text message; receive via socket
- [ ] Attach and send **photo** in chat; image renders
- [ ] Toggle **Solver** on profile; save
- [ ] Sessions list shows seeker and/or solver threads
- [ ] Sign out / sign in; session persists
- [ ] Production API URL only (no cleartext HTTP in production build)

### Wayfare QA

- [ ] **Offline mode**: create trip, journal entry, budget, packing without Supabase env
- [ ] **Online mode**: sign up / sign in; Profile → **Sync now**
- [ ] Journal **photo** attach + sync; thumbnail after sync
- [ ] **GPS route** start/stop; points increment; **Export GeoJSON** shares
- [ ] Explore trek card → new trip with template packing list
- [ ] Sign out / sign in; local data + cloud sync behavior understood

---

## Phase E — Google Play (Android) — per app

Create **two separate apps** in Play Console (different package names).

### Listing assets

- [ ] App name, short (80 char) & full description  
  - Ariyoo: `apps/mobile/store/play-store-listing.md`  
  - Wayfare: `apps/wayfare-mobile/store/play-store-listing.md`
- [ ] App icon **512×512**
- [ ] Feature graphic **1024×500**
- [ ] Phone screenshots (min. 2; recommend 4–8) from **real builds**
- [ ] Category (both: **Travel & Local** or closest fit)

### Policy & compliance

- [ ] **Data safety** form completed accurately  
  - **Ariyoo:** account, messages, photos  
  - **Wayfare:** account, location, photos, user-generated journal content  
- [ ] Declare **no sale** of personal data (unless business model changes)
- [ ] **Target audience** & content rating (IARC)
- [ ] **Ads** declaration (none if no ads SDK)

### Release

- [ ] Upload **AAB** from EAS production build
- [ ] Track: **Internal testing** → closed → **Production**
- [ ] Service account JSON for automated submit:  
  `store/google-play-service-account.json` (gitignored; see `.example` in Ariyoo)

| App | Package |
| --- | --- |
| Ariyoo | `com.ariyoo.mobile` |
| Wayfare | `com.wayfare.app` |

---

## Phase F — Apple App Store (iOS) — per app

Create **two separate apps** in App Store Connect.

### Identifiers & EAS

- [ ] App ID / bundle ID registered in Apple Developer  
  - `com.ariyoo.mobile` / `com.wayfare.app`
- [ ] App record in App Store Connect with matching bundle ID
- [ ] `eas.json` → `submit.production.ios`: `appleId`, `ascAppId`, `appleTeamId`

### Listing assets

- [ ] App name, subtitle, description, keywords  
  - Ariyoo: `apps/mobile/store/app-store-listing.md`  
  - Wayfare: `apps/wayfare-mobile/store/app-store-listing.md`
- [ ] Screenshots for required iPhone sizes (and iPad if supporting tablet)
- [ ] App icon **1024×1024** (no transparency)
- [ ] **Age rating** questionnaire
- [ ] **App Privacy** nutrition labels (data types collected — see below)

### Privacy labels (summary)

| Data | Ariyoo | Wayfare |
| --- | --- | --- |
| Email / account | Yes | Yes (Supabase auth) |
| User content | Chat messages, photos | Journal, photos, expenses |
| Location | No (unless added later) | Yes (route recording) |
| Diagnostics | Only if you add analytics/crash SDK | Same |

- [ ] **Export compliance**: standard HTTPS encryption only → typically “No” custom encryption (matches `usesNonExemptEncryption: false` in configs)
- [ ] **App Review information**: demo login + steps to reach core flow
- [ ] Build uploaded via EAS → **TestFlight** → submit for review

---

## Phase G — After first approval

- [ ] Monitor crash reports (add Sentry later if needed)
- [ ] Plan version bumps: EAS `autoIncrement` (Wayfare) / versionCode & buildNumber
- [ ] Keep privacy policy updated when permissions or data use change
- [ ] Separate release notes per app in each store

---

## Quick reference paths

| Resource | Ariyoo | Wayfare |
| --- | --- | --- |
| Detailed steps | `apps/mobile/store/SUBMISSION_CHECKLIST.md` | `apps/wayfare-mobile/store/SUBMISSION_CHECKLIST.md` |
| Play listing copy | `apps/mobile/store/play-store-listing.md` | `apps/wayfare-mobile/store/play-store-listing.md` |
| App Store listing copy | `apps/mobile/store/app-store-listing.md` | `apps/wayfare-mobile/store/app-store-listing.md` |
| Privacy policy draft | `apps/mobile/store/PRIVACY_POLICY.md` | `apps/wayfare-mobile/store/PRIVACY_POLICY.md` |

**No Mac required:** use EAS for iOS builds and `eas submit`; use TestFlight for iOS testing before public release.
