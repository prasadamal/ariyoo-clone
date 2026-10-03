# EAS secrets — Wayfare

After `eas init` in `apps/wayfare-mobile`:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT.supabase.co --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --scope project
```

Replace placeholders in `eas.json` production `env` or rely on secrets only.

CI: repository secret `EXPO_TOKEN` for `.github/workflows/wayfare-eas-build.yml`.
