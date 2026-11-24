# App review notes — Wayfare first release (Android)

Paste the "Notes for the reviewer" into Play Console → App content → App access. Put the demo
account's email and password in the credential fields there (never in this repository).

## Demo account

| Account | Email | Purpose |
| --- | --- | --- |
| Reviewer | `demo.traveller@example.com` | Twelve journeys with moments, photos, voice notes, plans, packing, expenses and routes |

## Notes for the reviewer

Wayfare is a private travel journal. It works offline; an account backs the journal up and lets
the user share a journey with people they choose.

1. **Journal:** Journeys → open "Ladakh road trip" → Journal: write a moment, add a photo
   (system photo picker), record a voice note. Swipe the moments sideways to change day.
2. **Plan / Pack / Budget:** the tabs beside Journal. All work offline.
3. **Route recording (foreground service, location):** Route tab → Start recording → allow
   location *While using the app* (the only location access Wayfare asks for). A notification
   shows while recording, with the screen off too. Tap Stop recording to end.
4. **Sharing:** the journey's ⋯ menu → Share story link (asks to confirm first; never includes
   money, routes or voice notes) and Stop sharing story. The person icon on the cover adds people
   to the journey by username or invite link.
5. **Account deletion:** You tab → gear (Settings) → Delete account → type DELETE. Deletes the
   account and its cloud data at once. Web: https://ariyoo-docs.onrender.com/privacy/wayfare-delete-account.html
6. **Safety:** Journeys → shield icon: SOS opens the SMS app pre-filled for the user's own
   emergency contacts; nothing is sent automatically. Live-location links are user-started and
   end within 72 hours.

Privacy policy: https://ariyoo-docs.onrender.com/privacy/wayfare.html
Terms of use: https://ariyoo-docs.onrender.com/privacy/wayfare-terms.html

## Why each permission is requested

| Permission | When it is requested |
| --- | --- |
| Location (while using the app) | Adding a location to a moment, Start recording route, Share live location, SOS. Never "all the time": recording continues through a foreground service the user starts. |
| Foreground service (location) | Only while route recording or a live-location link the user started is running |
| Camera | Taking a photo for a moment or trip cover |
| Photos | None: the system photo picker shares only the photos the user picks |
| Microphone | Recording a voice note |
| Notifications | Reminders the user turns on (daily diary, packing) and journey updates |
| Biometrics | Turning on App lock |
