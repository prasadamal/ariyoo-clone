# Google Play Data safety — Wayfare first release (Android)

Answers mirror the privacy policy (`docs/privacy/wayfare.html`, effective 24 November 2026).
Re-check them whenever a feature changes. Community features (feed, chat, nearby, trip
matching) are switched off in this release, so they are not declared.

## Data safety form

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all user data encrypted in transit?** Yes (HTTPS only).
- **Do you provide a way for users to request that their data be deleted?** Yes: in the app
  (You → Settings → Delete account) and on the web.
- **Delete account URL:** `https://ariyoo-docs.onrender.com/privacy/wayfare-delete-account.html`
- **Is data shared with third parties?** No. Supabase, Expo, Open-Meteo and OpenFreeMap process
  data on our behalf (service providers), which Play does not count as sharing.

| Data type | Collected | Required or optional | Purposes | What it is |
| --- | --- | --- | --- | --- |
| Location → Precise location | Yes | Optional | App functionality | Location added to a moment, recorded routes, live-location links |
| Personal info → Name | Yes | Required for an account | App functionality, Account management | Display name |
| Personal info → Email address | Yes | Required for an account | Account management | Sign-in; never shown to others |
| Personal info → User IDs | Yes | Required for an account | App functionality | Username (used to add people to a journey) |
| Personal info → Other info | Yes | Optional | App functionality | Bio, home region |
| Photos and videos → Photos | Yes | Optional | App functionality | Photos added to moments, trip covers, profile photo |
| Audio → Voice or sound recordings | Yes | Optional | App functionality | Voice notes |
| App activity → Other user-generated content | Yes | Optional | App functionality | Journal text, plans, packing lists, expenses |
| App activity → App interactions | Yes | Optional (can be switched off) | Analytics | Anonymous usage counts ("app opened", "moment added") |
| App info and performance → Crash logs, Diagnostics | Yes | Optional (can be switched off) | Analytics | Crash reports with personal details removed |
| Device or other IDs | Yes | Optional | App functionality, Analytics | Push token (if notifications are on); random install ID for usage counts |
| Financial info | No | | | Expenses are notes the user types, not payment data; UPI payments happen in the user's own UPI app |
| Contacts, Messages, Calendar, Web history, Health | No | | | |

For every row: **collected, not shared; processed ephemerally: No; data is encrypted in transit: Yes.**

## Permissions declarations (Play Console → App content)

- **Photo and video permissions:** not needed. Photos come from the system photo picker, and
  every `READ_MEDIA_*` and storage permission is removed from the build.
- **Location permissions (background):** not needed. `ACCESS_BACKGROUND_LOCATION` is removed.
- **Precise location:** if Play asks why coarse location isn't enough: "Wayfare records the
  route of a journey the user starts and tags a moment with where it happened; both need
  precise location to be useful."
- **Foreground service — Location (`FOREGROUND_SERVICE_LOCATION`):** declare it.
  Use case: user-initiated route recording and live-location sharing.
  Description: "When the user taps Start recording on a journey's Route tab, or starts a
  live-location link, Wayfare keeps recording location with the screen off. A notification is
  shown the whole time and the user can stop it from the app at any time."
  Video (30–60 s, unlisted YouTube link): open a journey → Route → Start recording → lock the
  phone and show the notification → unlock → Stop recording.

## Content rating (IARC questionnaire)

- Category: Reference, News or Educational? No → choose **Utility, Productivity, Communication
  or Other**.
- Violence, sexuality, language, controlled substances, gambling: **No** to all.
- Users can interact or exchange content: **Yes** (journeys shared with chosen people, public
  story links). Shares location: **Yes** (live-location links the user starts).
- Expected result: rated for everyone or teens; the app itself is 18+ by its Terms.

## Target audience and content (Play Console)

- Target age groups: **18 and over** only. Not designed for children.
- Ads: **No ads.**
- News app: No. Government app: No. Financial features: No. Health: No.
- App access: give reviewers a demo account (see `APP_REVIEW_NOTES.md`).

## Export compliance

HTTPS only; `usesNonExemptEncryption: false` in `app.config.ts`.
