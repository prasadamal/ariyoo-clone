# App Review notes — Ariyoo (paste into Apple / Google)

## Demo accounts (seed via `npm run prisma:seed` on production API)

| Role | Email | Password |
| --- | --- | --- |
| Solver (+ seeker) | solver@example.com | password |
| Seeker only | seeker@example.com | password |

**Change these passwords** before wide production; keep for review builds only.

## Steps for reviewer

1. Sign in with `seeker@example.com` / `password`
2. Open **Ask** tab → type a question with `#travel` → **Send to experts**
3. Open **Chats** → open the new session → send a text message
4. Tap **Photo** → pick an image → confirm it appears in chat
5. Optional: sign in as `solver@example.com` to see solver-side sessions

## Backend

Production API must match `EXPO_PUBLIC_API_URL` in the EAS build. Test with:

```bash
API_URL=https://your-api.example.com node services/api/scripts/smoke-flow.mjs
```

## Privacy policy URL

https://prasadamal.github.io/ariyoo-clone/privacy/ariyoo.html

(Enable GitHub Pages Actions deploy once; see `docs/STORE_START_HERE.md`.)
