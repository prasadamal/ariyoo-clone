# Ariyoo corporate website

Plain HTML, CSS and JavaScript. No framework and no build step: every file here is what the browser
gets. Forms, open roles and news use the Java API in `services/corporate-api`.

## Files

| | |
|---|---|
| `index.html`, `apps.html`, `company.html`, `trust.html`, `careers.html`, `press.html`, `article.html`, `contact.html`, `legal.html`, `404.html` | One file per page |
| `css/tokens.css` | Colours (purple and peach from the logo), type, spacing |
| `css/base.css`, `css/layout.css`, `css/components.css` | Shared: elements and forms; header, footer, page hero; phones, screen strip, showcase |
| `css/home.css`, `apps.css`, `company.css`, `contact.css`, `careers.css`, `press.css`, `trust.css` | One per page that needs its own styles |
| `js/config.js` | **The API address.** Change this one line when the API is deployed. |
| `js/site.js` | Every page: mobile menu, current page, newsletter |
| `js/home.js`, `contact.js`, `careers.js`, `press.js`, `article.js` | One per page |
| `js/api.js`, `forms.js`, `motion.js` | Shared: API calls, form handling, the pause control |
| `js/lib/` | Pure logic (validation, error messages, animation timing), unit tested |
| `assets/` | Logo and app screenshots |

The header and footer are repeated in each page. If you change a menu link, change it in all ten files.

## Preview

```bash
node tools/serve.mjs          # http://localhost:4000 (pages use JavaScript modules, which do not run from file://)
```

## Checks

```bash
node --test tests/unit.test.mjs      # validation, error messages, animation timing
node tools/check-links.mjs           # every local link, image, stylesheet and script exists
# Full browser test (needs Playwright, the preview server and the API running):
SITE_URL=http://localhost:4000 API_URL=http://localhost:8080/api ADMIN_KEY=... node tests/e2e.mjs
```

## Hosting

Any static host works (Render static site, Netlify, GitHub Pages, S3). A static site never sleeps,
so pages are instant; only the forms depend on the API. Before going live:

1. Set `API_BASE` in `js/config.js` to the deployed API, and the API's `CORS_ORIGINS` to the site's address.
2. Replace `Ariyoo@test.com` with the real address (it appears in the footer of every page and on several pages).
3. Re-take the app screenshots without the demo account's name, add founder photos and titles, and have the privacy policy and terms reviewed.

Moving content (hero phones, screen strip, showcase) pauses with the on-page control and stays still for
visitors who ask for reduced motion.
