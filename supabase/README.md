# Wayfare — Supabase backend

Hosted project: **wayfare** (`ujtylwimukufmbungnju`, ap-south-1).
API URL: `https://ujtylwimukufmbungnju.supabase.co`

## What lives here

| Path | Purpose |
| --- | --- |
| `migrations/20260930015336_wayfare_core_schema.sql` | Baseline already applied to the hosted project (prototype tables + `treks` reference data). |
| `migrations/20261004000000_wayfare_production_schema.sql` | Production schema: tables, RLS, triggers, share RPC, private storage bucket. Renames the empty prototype tables to `legacy_*`. |
| `migrations/20261004000100_wayfare_drop_legacy.sql` | Drops the `legacy_*` tables (guarded: aborts if they hold rows). |
| `functions/delete-account/` | Edge function behind "Delete account" in the app (required by Apple and Google). |
| `scripts/reviewer_demo_seed.sql` | Sample trip for store reviewers. |

> The hosted project recorded the production migration as separate parts
> (`wayfare_prod_1_tables`, `_2a_triggers_policies`, `_2b_grants`, `_3_share_storage`).
> The SQL is identical to the single repo file. If you link the CLI, run
> `supabase migration repair` once, or apply the files to a fresh project.

## Fresh project

```bash
supabase link --project-ref <ref>
supabase db push                       # applies migrations in order
supabase functions deploy delete-account
```

## Data model

All user tables carry `user_id`, a server-stamped `updated_at` (trigger — client clocks are never trusted) and, except `track_points`, a `deleted_at` tombstone. Child rows have composite FKs `(parent_id, user_id)`, so a row can never reference another user's parent.

| Table | Notes |
| --- | --- |
| `profiles` | Created by trigger on signup. Users may edit only `display_name`, `home_region`, `privacy_default`; `tier` is server-controlled. |
| `trips` | `visibility` `private` \| `link`; `share_id` (≥ 20 chars) required when shared. |
| `entries`, `expenses`, `packing_items` | Soft-deleted via `deleted_at`. |
| `track_points` | Append-only GPS breadcrumbs, pulled by `created_at`. |
| `entry_media` | Metadata for photos / voice notes stored in the `entry-media` bucket. |
| `treks` | Public read-only reference data. |

Deleting a trip: the app hard-deletes its child rows over the API, then writes the trip tombstone; other devices drop the children when they pull the tombstone.

## Security model

* RLS on every table; policies are `to authenticated` and key on `(select auth.uid())`.
* `anon` can call exactly one thing: `get_shared_trip(share_id)`, which returns a fixed allow-list of fields (no user id, companions, media). The advisor warns about this `SECURITY DEFINER` function being public — that is intentional.
* Storage bucket `entry-media` is private, 25 MB per file, images + m4a/mp3/aac only; objects must live under `<user_id>/…`.

## Auth settings (dashboard → Authentication)

1. Email provider **on**. Turn **Confirm email** ON for production (the app handles the "check your inbox" state).
2. **URL Configuration**: add redirect URL `wayfare://auth/callback` for password-reset links.
3. Set a custom SMTP sender before launch (the built-in mailer is rate-limited).
4. Enable leaked-password protection (Auth → Providers → Email) and set minimum password length to 8.

## Store-review account

Create the user in Auth (Dashboard → Authentication → Users, auto-confirm), then run `scripts/reviewer_demo_seed.sql` after editing the email at the top.
