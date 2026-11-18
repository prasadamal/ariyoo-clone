# Deploy Ariyoo API (production)

The mobile app expects **`EXPO_PUBLIC_API_URL`** to point at this service over **HTTPS**.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random string (not `dev_secret_change_me`) |
| `CORS_ORIGINS` | Yes | Comma-separated web origins; wildcard rejected in production |
| `PORT` | No | Default `3333` |
| `ADMIN_API_KEY` | Yes, before launch | Random string, 24+ characters. Unlocks the moderation routes (`MODERATION.md`) |
| `CONTENT_BLOCKLIST` | No | Extra comma-separated words or phrases to refuse in messages, names and topics |
| `TRUST_PROXY` | Usually `1` | Number of reverse proxies in front of the API (Render, Railway and Fly use 1). Rate limits are per client only when this is right |

Copy `services/api/env.production.example` when configuring your host.

## Free hosting (current setup)

The repository's `render.yaml` deploys the API to Render's free plan in Singapore, with a free Neon
PostgreSQL database. Neither needs a card for the free tier. Trade-offs and the way up:

| Part | Free now | Limit | Upgrade |
| --- | --- | --- | --- |
| Render web service | $0 | Sleeps after 15 min idle; first request waits up to ~1 min (the app wakes it on open) | `plan: starter` (about $7/month) |
| Neon PostgreSQL | $0 | 1 GB storage (about 4,000 photos at ~200 KB); compute sleeps after 5 min idle | Neon paid plan, or move photos to object storage when the database passes ~500 MB |

Use Neon's **direct** (not pooled) connection string for `DATABASE_URL`, with `?sslmode=require`.
Migrations are applied from a checkout, not at start-up: see "Migrations" below.

## Docker (any VPS / Railway / Fly / Render)

```bash
cd services/api
docker build -t ariyoo-api .
docker run -p 3333:3333 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e CORS_ORIGINS="https://your-web-app.example.com" \
  ariyoo-api
```

Apply reviewed Prisma migrations from a development/tooling checkout with database access before starting the runtime container (`npx prisma migrate deploy`). For an existing database, reconcile and explicitly baseline its current schema before marking the initial migration applied. An initial migration is included for empty databases; do not use destructive schema synchronization on an existing production database.

## Migrations

`npx prisma migrate deploy` applies both migrations: the initial schema and
`20261117000000_launch_safety` (terms acceptance, suspension, open questions, blocks, reports, push tokens).
Run it before starting a new version of the API.

## Isolated demo data

Demo seeding refuses `NODE_ENV=production`. Use only a separate development/reviewer database:

```bash
DATABASE_URL="postgresql://reviewer-db/..." DEMO_PASSWORD="a-unique-long-password" npm run prisma:seed
```

The `solver@example.com` and `seeker@example.com` accounts receive that password. Never seed public-password accounts in production.

## Verify

```bash
API_URL=https://your-api.example.com node scripts/smoke-flow.mjs
```

Against a live server from a sandbox that needs a proxy, run it with `NODE_USE_ENV_PROXY=1`. It leaves one test topic behind (topics are shared, not per-account): remove it with `delete from "Tag" where name like 'smoketopic%'`.

The script registers four throwaway accounts, runs the whole flow (matching, the open queue, chat, photos,
blocking, reporting, deletion) and deletes them again. Add `ADMIN_API_KEY=...` to also check moderation.
It makes about a dozen sign-up and sign-in calls, so two runs within 15 minutes can hit the sign-in rate limit.

## Mobile EAS

Set the API's public HTTPS address as the `EXPO_PUBLIC_API_URL` EAS environment variable:
see `apps/mobile/store/EAS_SECRETS.md`. The app has no built-in server address.

Production readiness: `/health` checks process liveness; `/ready` checks database connectivity. Configure host readiness against `/ready`. Chat image downloads require a bearer token and session membership. The Angular view loads image blobs through its authenticated HTTP client. Chat photos are stored in the database (table `Upload`), so the server needs no disk and nothing is lost on redeploy; watch the database size. Run backend build and tests before packaging.

Set `TRUST_PROXY` to the exact number of trusted reverse proxies (default 0). Do not trust arbitrary forwarded headers. Auth endpoints allow 30 attempts per 15 minutes per client IP. Multi-instance hosting needs a shared rate-limit store before scaling.
