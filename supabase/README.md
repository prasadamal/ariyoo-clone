# Wayfare — Supabase setup

## 1. Create project

Create a project at [supabase.com](https://supabase.com). Note **Project URL** and **anon public** key.

## 2. Apply migrations (SQL editor or CLI)

Run in order:

1. `migrations/20261003000000_wayfare_mvp.sql`
2. `migrations/20261003120000_wayfare_media_storage.sql`
3. `migrations/20261003180000_wayfare_share_links.sql`

CLI example:

```bash
supabase link --project-ref YOUR_REF
supabase db push
```

## 3. Auth

- Enable **Email** provider
- For store review, disable email confirm **or** use a fixed reviewer account you control

## 4. Mobile / EAS secrets

```bash
cd apps/wayfare-mobile
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ... --scope project
```

## 5. Reviewer demo

After creating a user in Auth, optionally run `scripts/reviewer_demo_seed.sql` (edit UUIDs/emails) to attach sample trip data.

## 6. Verify storage

Bucket `entry-media` should be **private** with policies from migration `20261003120000_wayfare_media_storage.sql`.
