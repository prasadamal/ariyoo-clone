# App Review notes — Wayfare

## Demo account

Create in Supabase Auth (or app sign-up) before review:

| Field | Value |
| --- | --- |
| Email | wayfare.reviewer@example.com |
| Password | *(choose a strong password; store in 1Password)* |

After sign-in, use **Profile → Sync now** with sample trip data (see `supabase/scripts/reviewer_demo_seed.sql`).

## Steps for reviewer

1. Sign in with demo account
2. **Journal** → open or create a trip
3. Add journal entry; attach **photo**; **Sync now**
4. **Route** tab → start/stop GPS recording (grant location when prompted)
5. Optional: enable airplane mode → create offline entry → sync when online

## Offline mode

App works without account when Supabase env is unset; production builds **include** Supabase — reviewer should use demo login above.

## Privacy policy URL

https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html
