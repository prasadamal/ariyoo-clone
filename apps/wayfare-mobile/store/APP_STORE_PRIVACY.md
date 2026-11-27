# App Store App Privacy answers: Wayfare first release (iOS)

The iOS twin of `DATA_SAFETY_AND_PRIVACY.md` (Play). Enter these in App Store Connect → App
Privacy. Answers mirror the privacy policy (`docs/privacy/wayfare.html`, effective 24 November
2026) and the code on `main`. Community features are switched off in this release, so they are not
declared. Re-check whenever a feature changes. Lines marked **GUESS** need a decision.

## Top-level questions

- **Do you or your third-party partners collect data from this app?** Yes.
- **Tracking** (linking data with other companies' data for ads, or sharing with data brokers):
  **No** for every data type. No ads SDKs, no third-party analytics, so no App Tracking
  Transparency prompt is needed.
- Supabase, Expo (push), Open-Meteo (weather) and OpenFreeMap (maps) process data on our behalf.
  Apple counts service providers as "collection" by us, not as tracking.

## Data types

"Linked to you" means the data is tied to the account. Anything stored under the signed-in
account is linked.

| Apple data type | Collect? | Linked to user | Used for tracking | Purposes | What it is |
| --- | --- | --- | --- | --- | --- |
| Contact Info → Name | Yes | Yes | No | App Functionality | Display name |
| Contact Info → Email Address | Yes | Yes | No | App Functionality | Sign-in; never shown to others |
| Location → Precise Location | Yes | Yes | No | App Functionality | Location on a moment, recorded routes, live-location links |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality | Photos on moments, trip covers, profile photo |
| User Content → Audio Data | Yes | Yes | No | App Functionality | Voice notes |
| User Content → Other User Content | Yes | Yes | No | App Functionality | Journal text, plans, packing lists, expenses, bio, home region |
| Identifiers → User ID | Yes | Yes | No | App Functionality | Account id and username (used to add people to a journey) |
| Identifiers → Device ID | Yes | Yes | No | App Functionality, Analytics | Push token (if notifications are on); random install id for usage counts |
| Usage Data → Product Interaction | Yes | Yes | No | Analytics | Usage counts like "app opened", "moment added" |
| Diagnostics → Crash Data | Yes | Yes | No | App Functionality, Analytics | Crash reports with personal details removed |

Not collected: Health & Fitness, Financial Info (expenses are notes the user types, not payment
data), Contacts (emergency contacts stay on the device), Sensitive Info, Browsing History,
Search History, Purchases, Gameplay Content, Customer Support, Other Data, Coarse Location,
Physical Address, Phone Number, Other Contact Info, Emails or Text Messages, Advertising Data,
Performance Data, Other Diagnostic Data, Other Usage Data.

## Why usage and crash data are marked "Linked to you" (decision needed)

The Play docs and the in-app setting call these counts "anonymous", but the `app_events`
table stores `user_id default auth.uid()`
(`supabase/migrations/20261124090000_app_events_feedback_invites.sql`), so a signed-in user's
events carry their account id. Apple's definition makes that "Linked to you".

Two ways to settle it:
1. **Keep the code, declare "Linked"** (what this file does now). Then also stop calling the
   counts "anonymous" in `DATA_SAFETY_AND_PRIVACY.md`, the privacy policy and the Settings label.
2. **Drop `user_id` from `app_events`** (a small migration, `default null`) so events carry only
   the random install id. Then usage and crash rows can be "Not linked to you", and "anonymous"
   becomes true on both stores. **GUESS**: this is the better fit for a "private by default"
   journal.

## Points to check

- **GUESS (speech):** voice-note transcripts use iOS speech recognition without
  `requiresOnDeviceRecognition`, so iOS may send the audio to Apple to transcribe it. That is
  Apple processing it under its own terms, not Wayfare collecting it, so it doesn't add a row
  here, but the privacy policy should say so. Setting `requiresOnDeviceRecognition: true` in
  `src/lib/voiceTranscribe.ts` avoids the question on devices that support it.
- **Privacy manifest:** "required reason" API declarations are already merged in
  `app.config.ts` (`ios.privacyManifests`). Collected data types in the manifest are filled
  from the SDKs' own manifests; App Store Connect answers above are what reviewers compare.
- **Crash data purpose:** if crash reports are only used to fix bugs, "App Functionality" alone
  is also acceptable. Listing Analytics too is the safer over-declaration.
