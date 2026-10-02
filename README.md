# ariyoo-clone

Private monorepo combining the Ariyoo / YourFriend expert Q&A app.

Initial import of the code from:
- [amalpras/AriyooApp](https://github.com/amalpras/AriyooApp) (full history preserved; only real code)
- [amalpras/Ariyoo](https://github.com/amalpras/Ariyoo) (React mockup → `archive/ariyoo-mockup`)
- [amalpras/AriyooAppBackend](https://github.com/amalpras/AriyooAppBackend) (empty; nothing imported)

Layout: `apps/web` (Angular), `apps/mobile` (Expo), `services/api` (Node/Express/Prisma).
Committed `node_modules` and `rn-platform/server/.env` were stripped from history on import.

## Mobile (iOS & Android)

The Expo app in `apps/mobile` is configured for production builds via EAS (`com.ariyoo.mobile`). See `apps/mobile/README.md` and `apps/mobile/store/SUBMISSION_CHECKLIST.md` for build and store submission steps.
