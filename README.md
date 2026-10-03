# ariyoo-clone

Private monorepo combining the Ariyoo / YourFriend expert Q&A app.

Initial import of the code from:
- [amalpras/AriyooApp](https://github.com/amalpras/AriyooApp) (full history preserved; only real code)
- [amalpras/Ariyoo](https://github.com/amalpras/Ariyoo) (React mockup → `archive/ariyoo-mockup`)
- [amalpras/AriyooAppBackend](https://github.com/amalpras/AriyooAppBackend) (empty; nothing imported)

Layout: `apps/web` (Angular), `apps/mobile` (Expo), `services/api` (Node/Express/Prisma).
Committed `node_modules` and `rn-platform/server/.env` were stripped from history on import.

## Mobile (iOS & Android)

| App | Path | Bundle ID |
| --- | --- | --- |
| **Ariyoo** (expert Q&A) | `apps/mobile` | `com.ariyoo.mobile` |
| **Wayfare** (travel journal + utility) | `apps/wayfare-mobile` | `com.wayfare.app` |

The Ariyoo Expo app is configured for production builds via EAS. See `apps/mobile/README.md` and `apps/mobile/store/SUBMISSION_CHECKLIST.md` for build and store submission steps.

Wayfare uses Supabase + offline SQLite; see `apps/wayfare-mobile/README.md` and `supabase/migrations/`.

**Publishing both apps:** see [`docs/STORE_PUBLISHING_CHECKLIST.md`](docs/STORE_PUBLISHING_CHECKLIST.md).
