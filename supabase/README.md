# Wayfare — Supabase backend

Everything the Wayfare app needs server-side: schema + row-level security, RPCs for feeds,
chat, the travel board, trip matching and nearby travellers, storage buckets, realtime and a
push-notification Edge Function.

## 1. Create the project

Create a project at [supabase.com](https://supabase.com) and note the **Project URL** and **anon** key.
Enable the **Email** auth provider. For store review either disable email confirmation or confirm
the demo accounts yourself.

## 2. Apply migrations (in order)

| File | What it adds |
| --- | --- |
| `20261003000000_wayfare_mvp.sql` | Profiles, trips, entries, expenses, packing, track points |
| `20261003120000_wayfare_media_storage.sql` | Entry media table + private `entry-media` bucket |
| `20261003180000_wayfare_share_links.sql` | Read-only trip links |
| `20261006000000_wayfare_sync_v2.sql` | Place keys, open-to-meet, geotags, split expenses, itinerary, voice-note MIME types, verified route helpers, `delete_my_account()` |
| `20261006010000_wayfare_social.sql` | Public profiles (server-owned stats), follows, posts, likes, comments, blocks, reports (auto-hide), notifications, push tokens, `avatars` + `post-media` buckets, feed/search RPCs |
| `20261006020000_wayfare_connect.sql` | Direct / crew / destination chats (+ `chat-media` bucket, realtime), travel board + join requests, place tips, nearby presence, trip matching + notifications |
| `20261006030000_wayfare_safety_stats.sql` | Live-location links, verified tiers (`refresh_my_stats()`), safer shared-trip payload |

```bash
supabase link --project-ref YOUR_REF
supabase db push
```

or paste each file into the SQL editor in order. All migrations are idempotent (safe to re-run).

Check afterwards:

- Storage buckets `entry-media` and `chat-media` are **private**; `avatars` and `post-media` are **public**.
- Database → Publications → `supabase_realtime` includes `messages` and `notifications`.

## 3. Push notifications (optional but recommended)

```bash
supabase functions deploy push --no-verify-jwt
supabase secrets set PUSH_WEBHOOK_SECRET="$(openssl rand -hex 32)"
```

Then Dashboard → Database → Webhooks → create two webhooks, both **INSERT**, type *Supabase Edge
Functions* → `push`, with an HTTP header `x-wayfare-secret: <the same secret>`:

1. table `public.notifications`
2. table `public.messages`

The app registers Expo push tokens once the build has an EAS project id; Android also needs
`google-services.json` and an FCM V1 key — see `apps/wayfare-mobile/store/EAS_SECRETS.md`.

## 4. App / EAS configuration

See `apps/wayfare-mobile/store/EAS_SECRETS.md`. The web viewers (`docs/wayfare-share`,
`docs/wayfare-live`) read `docs/wayfare-config.js` — put the same URL and anon key there.

## 5. Reviewer demo data

Sign up `wayfare.reviewer@example.com` and `wayfare.buddy@example.com`, then run
`scripts/reviewer_demo_seed.sql` in the SQL editor.

## 6. Moderation

Review reports daily — see [`MODERATION.md`](MODERATION.md).

## 7. Tests

```bash
supabase/tests/run_local.sh                     # 140+ RLS / RPC checks on a local Postgres
POSTGREST_BIN=/path/to/postgrest supabase/tests/run_http.sh   # end-to-end API checks via PostgREST + JWTs
```

`run_local.sh` applies a small Supabase stub (`tests/supabase_stub.sql`: auth/storage schemas,
API roles, default grants) plus every migration twice (idempotency), then runs
`tests/test_social_connect.sql` as real API roles with RLS enforced. Set `PGHOST`/`PGUSER`
(and `PGPASSWORD`) to use a Postgres server other than the local `postgres` superuser.
