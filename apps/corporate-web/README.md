# Ariyoo corporate website

A showcase for the company and its apps: plain HTML, CSS and JavaScript. No framework, no build step
and no backend: every file here is exactly what the browser gets. Contact, careers and press use email
links with the subject filled in.

## Files

| | |
|---|---|
| `index.html`, `apps.html`, `company.html`, `trust.html`, `careers.html`, `press.html`, `contact.html`, `legal.html`, `404.html` | One file per page |
| `css/tokens.css` | Colours (purple and peach from the logo), type, spacing |
| `css/base.css`, `css/layout.css`, `css/components.css` | Shared: elements and buttons; header, footer, page hero; phones, screen strip, showcase |
| `css/home.css`, `apps.css`, `company.css`, `contact.css`, `press.css`, `trust.css` | One per page that needs its own styles |
| `js/site.js` | Every page: mobile menu, current page, footer year |
| `js/home.js`, `js/motion.js` | Home page: hero phones, app showcase, and the pause control for moving content |
| `js/lib/rotation.js` | Animation timing, unit tested |
| `assets/` | Logo and app screenshots |

The header and footer are repeated in each page. If you change a menu link or the email address,
change it in all nine pages (search and replace works well).

## Preview

```bash
node tools/serve.mjs          # http://localhost:4000 (the home page uses JavaScript modules, which do not run from file://)
```

## Checks

```bash
node --test tests/unit.test.mjs      # animation timing
node tools/check-links.mjs           # every local link, image, stylesheet and script exists
node tests/e2e.mjs                   # full browser test (needs Playwright and the preview server)
```

## Hosting

Upload the folder to any static host (Render static site, Netlify, GitHub Pages, S3). It never
sleeps, makes no requests to other sites, and sets no cookies. Before going live:

1. Replace `Ariyoo@test.com` with the real address (every page).
2. Re-take the app screenshots without the demo account's name, and add founder photos and titles.
3. Have the privacy policy and terms (linked from the Legal page) reviewed.

Moving content (hero phones, screen strip, showcase) pauses with the on-page control and stays still for
visitors who ask for reduced motion.
