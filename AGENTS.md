# Working on Ariyoo and Wayfare transitions

Read `docs/state-machines/README.md` and the relevant app inventory before modifying a flow. The source index is a reproducible candidate census, not proof of exhaustive semantic coverage.

- Ariyoo is `apps/mobile` + `apps/web` + `services/api`; Wayfare is `apps/wayfare-mobile` + `supabase`. Do not conflate their auth, chat protocols or databases.
- Keep independent form fields local. Use small typed states/pure reducers for coupled flags; keep effects, native APIs and navigation outside reducers.
- Scope async results to account/resource/attempt. Prevent duplicate mutation callbacks synchronously. Preserve failed drafts, provide retry/cancel outcomes and never advertise partial completion as success.
- Preserve privacy defaults, storage keys, schemas, HTTP/RPC contracts and Supabase authorization. Local UI permission is not server authorization. Do not automatically retry non-idempotent sends.
- Update the relevant inventory and regenerate `node scripts/state-index.mjs` after transition changes. Run `node scripts/state-index.mjs --check` before completion.
- Ariyoo mobile: `npm test && npm run typecheck` in `apps/mobile`. Wayfare: `npm run verify` in `apps/wayfare-mobile`; backend/native changes additionally need their integration/device checks.
- Read installed Expo package versions and matching official API docs before changing native behavior. The apps use different SDK generations; do not copy APIs between them.
- No secrets, private chat or precise coordinates in transition logs. Keep signing, staging, data-isolation and store-release gates explicit.
- Prioritize unresolved server socket membership/upload protection in Ariyoo and sync/wipe/account/native-service coordination in Wayfare. UI reducers do not solve those boundaries.
