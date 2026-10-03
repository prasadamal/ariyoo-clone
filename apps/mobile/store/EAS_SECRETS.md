# EAS secrets — Ariyoo

After `eas init` in `apps/mobile`:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://YOUR_PRODUCTION_API --scope project
```

Optional:

```bash
eas secret:create --name EAS_PROJECT_ID --value YOUR_EXPO_PROJECT_UUID --scope project
```

Remove placeholder URLs from `eas.json` production `env` once secrets are set (secrets override local env in EAS builds).

CI: add repository secret `EXPO_TOKEN` from expo.dev → Access Tokens.
