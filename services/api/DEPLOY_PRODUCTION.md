# Deploy Ariyoo API (production)

The mobile app expects **`EXPO_PUBLIC_API_URL`** to point at this service over **HTTPS**.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random string (not `dev_secret_change_me`) |
| `PORT` | No | Default `3333` |
| `UPLOAD_DIR` | No | Default `./uploads` (use persistent volume in prod) |

Copy `services/api/env.production.example` when configuring your host.

## Docker (any VPS / Railway / Fly / Render)

```bash
cd services/api
docker build -t ariyoo-api .
docker run -p 3333:3333 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  ariyoo-api
```

Before first run, apply schema to the database:

```bash
cd services/api
DATABASE_URL="..." npx prisma db push
DATABASE_URL="..." npm run prisma:seed
```

## Seed demo users (store review)

```bash
cd services/api
DATABASE_URL="..." JWT_SECRET="..." npm run prisma:seed
```

Accounts (change passwords before public production):

- `solver@example.com` / `password` (solver + seeker)
- `seeker@example.com` / `password` (seeker only)

## Verify

```bash
API_URL=https://your-api.example.com node scripts/smoke-flow.mjs
```

Set `API_URL` in the environment when running the smoke script against production.

## Mobile EAS

```bash
cd apps/mobile
eas secret:create --name EXPO_PUBLIC_API_URL --value https://your-api.example.com --scope project
```

Or set in `eas.json` production `env` once URL is final.
