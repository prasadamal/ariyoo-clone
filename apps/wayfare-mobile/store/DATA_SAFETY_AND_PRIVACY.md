# Google Play Data safety & Apple App Privacy — Wayfare 2.0

Answers mirror the privacy policy (`docs/privacy/wayfare.html`). Re-check them if features change.

## Google Play — Data safety form

**Does your app collect or share any of the required user data types?** Yes.
**Is all user data encrypted in transit?** Yes (HTTPS only).
**Do you provide a way for users to request deletion?** Yes — in-app (Settings → Delete account) and privacy@ariyoo.app.
**Data shared with third parties?** No (service providers processing on our behalf are not "sharing" under Play's definition).

| Data type | Collected | Optional? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Location → Approximate | Yes | Optional | App functionality | "Nearby" (≈1 km grid, user-enabled, expires ≤24 h) |
| Location → Precise | Yes | Optional | App functionality | Route recording, entry geotags, live-location links, chat location messages |
| Personal info → Name | Yes | Required for account | App functionality, account management | Display name |
| Personal info → Email | Yes | Required for account | Account management | Not shown to other users |
| Personal info → User IDs | Yes | Required for account | App functionality | Username |
| Personal info → Other info | Yes | Optional | App functionality | Bio, home region, travel styles, languages |
| Photos and videos → Photos | Yes | Optional | App functionality | Journal, posts, avatar, chat photos |
| Audio → Voice or sound recordings | Yes | Optional | App functionality | Journal voice notes |
| Messages → Other in-app messages | Yes | Optional | App functionality | Direct, crew and destination chats |
| App activity → Other user-generated content | Yes | Optional | App functionality | Journal text, posts, comments, tips, board posts |
| App activity → Other actions | Yes | Optional | App functionality | Follows, likes, reports, blocks |
| Device or other IDs | Yes | Optional | App functionality | Expo push token (only if notifications enabled) |
| Financial info | No | — | — | Trip expenses are user-entered notes, not payment data |
| Contacts | No | — | — | Emergency contacts stay on the device |

**Background location declaration (Play Console → App content → Sensitive permissions):**
Wayfare records the route of a trip only after the user taps *Start recording route* (and keeps a live-location link updated only after *Share live*). Recording continues with the screen off so the full trek is captured; a persistent notification shows while it runs and the user stops it at any time. Record a short video of: trip → Route → Start recording → notification visible → Stop.

## Apple — App Privacy (nutrition label)

Tracking: **No** (no data used to track across apps/websites; no ATT prompt needed).

| Category | Data | Linked to user | Purposes |
| --- | --- | --- | --- |
| Contact Info | Email Address, Name | Yes | App Functionality |
| User Content | Photos, Audio Data, Other User Content (journal, posts, comments, tips) | Yes | App Functionality |
| User Content | Emails or Text Messages → *in-app messages* | Yes | App Functionality |
| Location | Precise Location, Coarse Location | Yes | App Functionality |
| Identifiers | User ID | Yes | App Functionality |
| Identifiers | Device ID (push token) | Yes | App Functionality |

## Age rating guidance

- **Apple:** answer *Unrestricted web access: No*, *User-generated content: Yes* — the questionnaire typically lands on **17+** for apps that let strangers chat and meet. Terms require 18+ for accounts.
- **Google Play (IARC):** declare user interaction / users can communicate and share location → expect **Teen–Mature 17+**.

## Export compliance

HTTPS only; `usesNonExemptEncryption: false` / `ITSAppUsesNonExemptEncryption: false` in `app.config.ts`.
