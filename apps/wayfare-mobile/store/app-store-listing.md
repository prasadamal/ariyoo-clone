# App Store Connect listing: Wayfare first release (en-US)

Only what this release does. The community features (trip matching, travel board, nearby,
follows, chats, place rooms) are switched off in this build (`src/lib/features.ts`), so they must
not appear in the listing, screenshots or preview video. Apple rejects listings that describe
features the app doesn't have (guideline 2.3.1). Keep this in step with `play-store-listing.md`.

Lines marked **GUESS** are first-draft choices to confirm before submitting.

## Name (30 characters max)
Wayfare: Travel Journal

(23 characters, same as Play.)

## Subtitle (30 characters max)
Private, offline trip diary

(27 characters.) **GUESS**: alternative "Offline journal for every trip" (30).

## Promotional text (170 characters max, can change without a new build)
Journal every trip, even with no signal. Moments, photos, voice notes, plans and shared costs, private by default and backed up when you want.

(142 characters.)

## Description
Wayfare is a private travel journal for treks, road trips and holidays, built for places where
the signal disappears. Everything works offline and stays on your iPhone; a free account backs it
up so you can restore it on a new phone. You can start without an account.

YOUR JOURNEY, DAY BY DAY
• Moments with photos, voice notes (optionally written out as text), mood, weather and a place name
• Swipe between days; a pre-trip page for the plans and photos before you leave
• An everyday diary with a mood calendar, for the days between trips
• Recap, photo book PDF and your year in travel when a journey ends

PLAN, PACK AND SPLIT COSTS
• Day plans with forecasts, packing lists and packing reminders
• Expenses in any currency, split with your companions; Settle up shows who owes whom

RECORD THE ROUTE
• Record a journey's route while you travel, and export it as GPX

SHARE ONLY WHAT YOU CHOOSE
• Add people to a journey by username or invite link
• A story link for family: moments and photos, never money, routes or voice notes; turn it off any time

STAY SAFE
• SOS opens Messages with your location for your emergency contacts
• Check-in reminders, local emergency numbers and general altitude-sickness guidance
• Live-location links that end within 72 hours

Private by default. No ads, no selling data, no third-party tracking. Lock the app with Face ID
or your passcode. Delete your account and its data from the app at any time.

For adults (18+).

Notes on what changed from the Android text:
- "Pay or request with your own UPI app" is left out. **GUESS**: UPI hand-off has not been
  checked on an iPhone (iOS needs the UPI app's URL scheme to open), and an en-US listing
  shouldn't lead with an India-only feature. Add it back for an en-IN localization once it is
  tested on a device.
- "Notification shown the whole time" (an Android foreground-service rule) becomes plain
  "while you travel"; on iOS the blue location indicator plays that role.

## Keywords (100 characters max, comma-separated, no spaces)
journal,diary,trip,trek,hiking,offline,itinerary,packing,expenses,road trip,backpacking,GPX,route

(97 characters.) Don't repeat words already in the name or subtitle ("travel", "private"); Apple
indexes those anyway.

## Category
Primary: Travel · Secondary: Lifestyle

**GUESS**: the old secondary category was Social Networking, which no longer fits. Lifestyle
is the closest for a journal; Productivity is the alternative.

## Support URL
https://github.com/prasadamal/ariyoo-clone

**GUESS**: Apple wants a page where users can actually get help. A GitHub repo works but a
simple support page on ariyoo-docs.onrender.com with the contact email would be safer.

## Marketing URL (optional)
Leave empty.

## Privacy policy URL
https://ariyoo-docs.onrender.com/privacy/wayfare.html

## License agreement
Custom EULA: paste https://ariyoo-docs.onrender.com/privacy/wayfare-terms.html. It contains the
objectionable-content clause, which still matters because story links publish user content on
the web.

## Age rating
Answer the questionnaire as follows (Apple's 2025 rating questions):
- Violence, sexual content, profanity, horror, drugs/alcohol, gambling, contests: **None**.
- Medical or treatment information: **Infrequent/Mild** (the general altitude-sickness guidance).
  **GUESS**: "None" is defensible since it's general safety text; "Infrequent" is the safer answer.
- User-generated content: **Yes** (story links show the user's moments to anyone with the link).
- Messaging and chat: **No** (chat is switched off in this build).
- Unrestricted web access: **No**.
- Age assurance / parental controls: **No**.

Expected result: **13+ or 16+**, not 17+/18+. The app's own Terms still require 18+ for an
account. **GUESS**: if you'd rather the store rating match the Terms, use "Override to higher
age rating" and pick 18+.

## App Review information
See `APP_STORE_REVIEW_NOTES.md`.

## App Privacy
See `APP_STORE_PRIVACY.md`.

## Screenshots (6.9" required; 6.5" optional; iPad 13" required because `supportsTablet: true`)
Same set as Play, taken on iOS. Use the demo account. Don't show other people's real names or
numbers, and don't show any social screen.
- [ ] Journeys home with "Next up" countdown
- [ ] A journey's Journal with photos and weather
- [ ] Plan / Pack
- [ ] Budget with Settle up
- [ ] Route tab with map and elevation profile
- [ ] Story page in Safari
- [ ] Safety (SOS, check-in, live location)
- [ ] iPad: Journeys home and a Journal page

**GUESS**: if no iPad screenshots are wanted, set `supportsTablet: false` in `app.config.ts`
before the first upload. Apple won't let you drop iPad support in a later version.
