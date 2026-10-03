# App Review notes — Wayfare (Apple & Google)

## Demo account

1. Supabase dashboard → Authentication → Users → **Add user** → email `reviewer@wayfare.app`, a strong password, tick **Auto Confirm User**.
2. SQL editor → run `supabase/scripts/reviewer_demo_seed.sql` (sample trip with entries, budget, packing).
3. Paste into App Store Connect "Sign-in required" / Play "App access":

| Field | Value |
| --- | --- |
| Email | reviewer@wayfare.app |
| Password | *(the one you set; keep it in a password manager)* |

The app also works **without an account**: on the sign-in screen tap **Continue without an account**.

## What to try

1. Sign in → **Journeys** shows the demo trip.
2. Open the trip → **Journal**: add an entry, **Save and add photos**, or **Record voice note**.
3. **Budget** → add an expense; **Pack** → tick items, add one; **Route** → **Start recording route** (allow location *While Using the App*), walk or simulate movement, **Stop recording**.
4. Trip menu (⋮) → **Share read-only link** (shows the system share sheet), **Export PDF journal**, **Stop sharing**.
5. **Profile** → App lock, Appearance, **Sync now**.
6. **Delete account** (Profile → bottom): permanently erases the account. *Please use a throwaway account for this test, not the demo account.*

## Permission rationale

| Permission | Where it is requested | Why |
| --- | --- | --- |
| Location (While Using) | Route tab → Start recording; or "Attach weather" in a new entry | Records the GPS route the user starts; optional local weather |
| Microphone | Journal → Record voice note | Voice notes |
| Photos | Journal → Save and add photos | Attach photos to entries (system photo picker) |
| Face ID / biometrics | Profile → App lock | Optional lock for the private journal |

Background behaviour: route recording continues after the user starts it (iOS shows the blue location indicator; Android shows a persistent notification) and stops when the user taps **Stop recording**. The app never requests "Always" location.

## Privacy & deletion

- Privacy policy: https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html
- Account deletion (in-app and web): https://prasadamal.github.io/ariyoo-clone/privacy/wayfare-delete-account.html
- No ads, analytics, tracking or third-party login.
