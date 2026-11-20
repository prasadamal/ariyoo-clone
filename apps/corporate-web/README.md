# Ariyoo corporate website

Angular 22 with server-side rendering. Pages are prerendered to static HTML (fast, readable by search
engines); careers, press and the forms use the Java API in `services/corporate-api` from the browser.
This is separate from `apps/web`, which is the Ariyoo product client.

## Run it

```bash
npm ci
npm start                 # http://localhost:4200, calls the API at http://localhost:8080
npm run verify            # unit tests + production build
```

## Build for production

```bash
CORPORATE_API_URL=https://<your-api-host> npm run set-api-url   # writes src/app/core/api-base.ts
npm run build
NG_ALLOWED_HOSTS=www.<your-domain> PORT=4000 node dist/corporate-web/server/server.mjs
```

`NG_ALLOWED_HOSTS` is required: Angular refuses requests whose Host header is not on the list (protection
against forged hosts). Also set the API's `CORS_ORIGINS` to the site's address.

## Where things are

- Company facts (address, email, founders, legal links): `src/app/core/company.ts`
- Design tokens (colours, type, spacing): `src/styles.scss`
- Pages: `src/app/pages/`, forms: `src/app/forms/`, routes and per-page titles and descriptions: `src/app/app.routes.ts`

## Before launch

- Replace `Ariyoo@test.com` in `company.ts` with the real address.
- Add real photos and roles for the founders, and company registration details, once available.
- Have the privacy policy and terms (linked from the Legal page) reviewed by a qualified person.
