# App Review notes — Wayfare 2.0

Paste the "Notes" section into App Store Connect / Play Console review notes. Create the demo
accounts first (sign up in the app, then run `supabase/scripts/reviewer_demo_seed.sql`).

## Demo accounts

| Account | Email | Purpose |
| --- | --- | --- |
| Reviewer | wayfare.reviewer@example.com | Main account (password in your password manager) |
| Second traveller | wayfare.buddy@example.com | Has an overlapping trip, a board post and a chat so community features have content |

## Notes for the reviewer

Wayfare is a travel journal plus a traveller community.

1. **Journal (works offline):** Journeys → open "Hampta Pass (demo)" → Journal: write a moment, add a photo, record a voice note. Plan / Budget / Pack tabs work offline too.
2. **Route recording:** Route tab → *Start recording route* → allow location. Background location is used only while recording is on; Android shows a persistent notification. Tap *Stop recording* to end.
3. **Community:** accept the Community Guidelines when prompted (shown once before any community feature).
   - Discover → Feed: posts from the demo buddy.
   - Connect → Board: open the demo ride share → *Ask to join*.
   - Connect → My trips: the demo trip is "open to meet" and matches the buddy's trip.
   - Inbox → chat with the buddy.
4. **Moderation (Guideline 1.2):** every post, comment, message, tip, board post and profile has **Report** (… menu or long-press) and **Block**. Content reported by 3 travellers is hidden automatically; our team reviews reports within 24 hours (`supabase/MODERATION.md`). An on-device filter blocks slurs and payment-scam phrasing before posting. Users must accept the guidelines (with a zero-tolerance clause) before using community features.
5. **Account deletion (Guideline 5.1.1(v)):** You tab → Settings & privacy → *Delete account* (type DELETE). This deletes the account and all its data immediately.
6. **Safety:** Journeys → shield icon → Safety: SOS opens the SMS composer pre-filled with location for the user's own emergency contacts (nothing is sent automatically); live-location links are user-started and expire.

Privacy policy: https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html
Terms of use: https://prasadamal.github.io/ariyoo-clone/privacy/wayfare-terms.html

## Permission strings (why each is requested)

| Permission | When it is requested |
| --- | --- |
| Location (when in use) | Saving a moment with "Add location", Nearby, chat location, SOS |
| Location (always / background) | Only after *Start recording route* or *Share live* |
| Camera / Photos | Adding photos to entries, posts, chats, avatar |
| Microphone | Recording a voice note |
| Notifications | Turning on notifications (Inbox prompt or Settings), check-in reminders |
| Face ID | Turning on App lock |
