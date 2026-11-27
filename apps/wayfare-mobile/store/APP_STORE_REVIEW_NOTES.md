# App Review notes: Wayfare first release (iOS)

The iOS twin of `APP_REVIEW_NOTES.md` (Android). Paste "Notes" into App Store Connect → the
version → App Review Information. Put the demo account's email and password in the Sign-in
fields there (never in this repository). Lines marked **GUESS** need checking on a real build.

## Contact
- Name: Amal Prasad
- Email: amalprasadappu@gmail.com
- Phone: (fill in App Store Connect; required)

## Demo account

| Account | Email | Purpose |
| --- | --- | --- |
| Reviewer | `demo.traveller@example.com` | Twelve journeys with moments, photos, voice notes, plans, packing, expenses and routes |

## Notes (paste this)

Wayfare is a private travel journal. It works offline. An account is optional: "Continue
without an account" on the sign-in screen keeps the journal on the phone; signing in backs it up
and lets the user share a journey with people they choose. A demo account with sample journeys
is provided in the sign-in fields.

1. Journal: Journeys → open "Ladakh road trip" → Journal: write a moment, add a photo (system
   photo picker), record a voice note. Swipe the moments sideways to change day.
2. Plan / Pack / Budget: the tabs beside Journal. All work offline.
3. Route recording (background location): Route tab → Start recording → allow location "While
   Using the App". This is the only location permission Wayfare asks for; it never asks for
   "Always". Recording continues when the screen is locked, with the blue location indicator in
   the status bar, until the user taps Stop recording. A live-location link the user starts
   works the same way and ends within 72 hours. This is the only reason for the "location"
   background mode.
4. Sharing: the journey's ⋯ menu → Share story link (asks to confirm first; never includes
   money, routes or voice notes) and Stop sharing story. The person icon on the cover adds people
   to the journey by username or invite link.
5. User-generated content: the only content other people can see is a journey shared with
   people the user chose, or a story link. Every public story page has "Report this page", which
   emails our Grievance Officer with the link's id; we can turn a story link off at once.
   Complaints are acknowledged within 24 hours. There is no public feed, chat or messaging in this
   version.
6. Account deletion: You tab → gear (Settings) → Delete account → type DELETE. Deletes the
   account and its cloud data at once. Web: https://ariyoo-docs.onrender.com/privacy/wayfare-delete-account.html
7. Safety: Journeys → shield icon. SOS opens Messages pre-filled for the user's own emergency
   contacts; nothing is sent automatically. Altitude guidance is fixed general information,
   labelled "not medical advice". No health data is collected.
8. Settle up: records who owes whom between travel companions. Wayfare never handles money,
   payments or payment data, and sells no digital goods (no in-app purchases).
9. Voice note transcripts are off by default; the user turns them on in Settings, and iOS asks
   for Speech Recognition permission.

Privacy policy: https://ariyoo-docs.onrender.com/privacy/wayfare.html
Terms of use (EULA): https://ariyoo-docs.onrender.com/privacy/wayfare-terms.html

## Why each permission is requested (matches `infoPlist` in `app.config.ts`)

| Permission | When it is requested |
| --- | --- |
| Location When In Use | Adding a location to a moment, Start recording route, Share live location, SOS |
| Location Always | Never requested. The string exists only because the location library links the API. |
| Background mode: location | Only while a route recording or live-location link the user started is running |
| Camera | Taking a photo for a moment or trip cover |
| Photos | The system photo picker shares only the photos the user picks |
| Microphone | Recording a voice note |
| Speech Recognition | Writing out voice notes, only if the user turns it on |
| Face ID | Turning on App lock |
| Motion | Never requested. The string exists only because the location library links CoreMotion. |
| Notifications | Reminders the user turns on (daily diary, packing) and journey updates |

## Things to check before submitting

- Item 9 is checked in code: `writeOutEnabled()` in `src/lib/voiceTranscribe.ts` is false until
  the user switches it on, and the permission is asked at that moment.
- **GUESS:** Item 3 assumes recording keeps going with the screen locked on iOS. The Android
  device checks cover this; no iPhone run has been recorded yet.
- If "Continue without an account" is ever removed, Apple guideline 5.1.1(v) still allows
  sign-in because the account adds backup and sharing, but say so in the notes.
- Wayfare signs in with email and password only, so Sign in with Apple is not required
  (guideline 4.8). Adding Google sign-in later would make it required.
- Export compliance: `ITSAppUsesNonExemptEncryption: false` is set, so no question at upload.
