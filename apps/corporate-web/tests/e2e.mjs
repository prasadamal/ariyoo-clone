// End-to-end checks in a real browser, against the site and the Java API.
//   SITE_URL=http://localhost:4000 API_URL=http://localhost:8080/api ADMIN_KEY=... node tests/e2e.mjs [screenshot-dir]
// Needs Playwright with Chromium, the preview server (node tools/serve.mjs) and the API running.
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:4000';
const API = process.env.API_URL || 'http://localhost:8080/api';
const KEY = process.env.ADMIN_KEY || '';
const shots = process.argv[2];
const results = [];
const errors = [];
const check = (name, ok) => results.push([ok ? 'PASS' : 'FAIL', name]);
const admin = (path, body) => fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'X-Admin-Key': KEY, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(r => r.json());
const shot = async (page, name, full = true) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full }); };

const browser = await chromium.launch();
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && !/\/nope$|does-not-exist/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
};
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await desk.newPage();
watch(page);

// Every page renders a heading and the shared header and footer.
for (const p of ['index', 'apps', 'company', 'trust', 'careers', 'press', 'contact', 'legal']) {
  await page.goto(`${SITE}/${p}.html`);
  await page.waitForTimeout(700);
  check(`${p}: one h1, header and footer`, (await page.locator('h1').count()) === 1 && (await page.locator('header.site-header').count()) === 1 && (await page.locator('footer.site-footer').count()) === 1);
  await shot(page, `desk-${p}`);
}
await page.goto(`${SITE}/nope`);
check('unknown address shows the 404 page', (await page.getByText("We couldn't find that page.").count()) === 1);

// Moving parts.
await page.goto(`${SITE}/`);
await page.waitForTimeout(800);
const heroScreens = () => page.$$eval('.hero-phones img.on', imgs => imgs.map(i => i.src).join('|'));
const stripX = () => page.$eval('.marquee .track', t => new DOMMatrix(getComputedStyle(t).transform).m41);
const selectedTab = () => page.$eval('[role=tab][aria-selected=true] .tab-name', e => e.textContent);
const h1 = await heroScreens(); const x1 = await stripX(); const t1 = await selectedTab();
await page.waitForTimeout(7600);
check('hero phones change screens', h1 !== (await heroScreens()));
check('screen strip moves', (await stripX()) < x1 - 5);
check('showcase advances by itself', t1 !== (await selectedTab()));
await page.getByRole('button', { name: 'Pause animations' }).click();
const p1 = await heroScreens(); const px = await stripX(); const pt = await selectedTab();
await page.waitForTimeout(7600);
check('pause stops hero, strip and showcase', p1 === (await heroScreens()) && Math.abs(px - (await stripX())) < 1 && pt === (await selectedTab()));
check('pause button now offers Play', (await page.getByRole('button', { name: 'Play animations' }).count()) === 1);
await page.getByRole('tab', { name: /Wayfare/ }).click();
await page.keyboard.press('ArrowRight');
check('arrow keys move through the app tabs', (await selectedTab()) === 'ReelMates' && (await page.evaluate(() => document.activeElement?.id)) === 'tab-reelmates');
check('only the selected app panel is visible', (await page.locator('[role=tabpanel]:visible').count()) === 1);

const reduced = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
watch(reduced);
await reduced.goto(`${SITE}/`);
await reduced.waitForTimeout(500);
const r1 = await reduced.$$eval('.hero-phones img.on', i => i.map(x => x.src).join('|'));
await reduced.waitForTimeout(5500);
check('reduced motion: nothing moves', r1 === (await reduced.$$eval('.hero-phones img.on', i => i.map(x => x.src).join('|'))) && (await reduced.$eval('.marquee .track', t => getComputedStyle(t).animationName)) === 'none');
await shot(reduced, 'desk-home-hero', false);

// Contact form: checks first, then a real message into the database.
await page.goto(`${SITE}/contact.html?topic=investor`);
check('contact.html?topic= preselects the topic', (await page.$eval('#c-topic', s => s.value)) === 'investor');
await page.getByRole('button', { name: 'Send message' }).click();
check('empty contact form shows field messages and sends nothing', (await page.getByText('Please tell us your name.').count()) === 1 && (await page.evaluate(() => document.activeElement?.id)) === 'c-name');
await shot(page, 'desk-contact-errors');
await page.fill('#c-name', 'Priya Nair');
await page.fill('#c-email', 'priya@example.com');
await page.fill('#c-org', 'Acme Ventures');
await page.fill('#c-message', 'We would like to learn more about Ariyoo and its three apps.');
await page.getByRole('button', { name: 'Send message' }).click();
await page.waitForTimeout(1200);
check('contact form thanks the sender by email address', (await page.getByText('will reply to priya@example.com').count()) === 1);
if (KEY) {
  const inbox = await admin('/admin/inbox');
  check('contact message stored with topic and organisation', inbox.contacts.some(c => c.email === 'priya@example.com' && c.topic === 'investor' && c.organisation === 'Acme Ventures'));
}

// Newsletter.
await page.fill('#nl-email', 'not-an-email');
await page.getByRole('button', { name: 'Subscribe' }).click();
check('newsletter refuses a bad address', await page.locator('.newsletter .err').isVisible());
await page.fill('#nl-email', 'reader@example.com');
await page.getByRole('button', { name: 'Subscribe' }).click();
await page.waitForTimeout(900);
check('newsletter confirms', await page.locator('.newsletter .ok').isVisible());

// Careers and press: empty first, then published through the admin API.
await page.goto(`${SITE}/careers.html`);
await page.waitForTimeout(900);
check('careers says plainly when no roles are open', await page.locator('#roles-empty').isVisible());
await page.goto(`${SITE}/press.html`);
await page.waitForTimeout(900);
check('press says plainly when there is no news', await page.locator('#press-empty').isVisible());
if (KEY) {
  await admin('/admin/jobs', { slug: 'mobile-engineer', title: 'Mobile Engineer', team: 'Engineering', location: 'Bengaluru', employment: 'Full-time', summary: 'Build Ariyoo, Wayfare and ReelMates in React Native and Expo. <b>bold?</b>' });
  await admin('/admin/press', { slug: 'three-apps', title: 'Ariyoo prepares three apps for launch', summary: 'Ariyoo, Wayfare and ReelMates are in final testing.', body: 'First paragraph.\n\nSecond paragraph with <script>alert(1)</script> as plain text.', publishedAt: '2026-11-18T09:00:00Z' });
  await page.goto(`${SITE}/careers.html`);
  await page.waitForTimeout(900);
  check('published role is listed, its text never treated as HTML', (await page.getByText('Mobile Engineer').count()) === 1 && (await page.locator('.role b').count()) === 0);
  await page.getByRole('button', { name: 'Apply for this role' }).click();
  check('choosing a role names it above the form', (await page.locator('#apply-heading').textContent()) === 'Apply: Mobile Engineer');
  await page.fill('#a-name', 'Ravi Kumar');
  await page.fill('#a-email', 'ravi@example.com');
  await page.fill('#a-link', 'https://linkedin.com/in/ravi');
  await page.fill('#a-message', 'Five years of React Native, and I love travel journaling.');
  await page.getByRole('button', { name: 'Send application' }).click();
  await page.waitForTimeout(1200);
  check('application accepted', await page.locator('#apply-thanks').isVisible());
  const inbox = await admin('/admin/inbox');
  check('application stored against the role', inbox.applications.some(a => a.email === 'ravi@example.com' && a.role === 'Mobile Engineer'));
  await shot(page, 'desk-careers-role');
  await page.goto(`${SITE}/press.html`);
  await page.waitForTimeout(900);
  await page.getByRole('link', { name: 'Ariyoo prepares three apps for launch' }).click();
  await page.waitForTimeout(1200);
  check('article opens with plain-text paragraphs', (await page.locator('#article [data-body] p').count()) === 2 && (await page.locator('#article script').count()) === 0);
  await shot(page, 'desk-article');
}
await page.goto(`${SITE}/article.html?slug=does-not-exist`);
await page.waitForTimeout(900);
check('missing article explains itself', await page.locator('#article-missing').isVisible());

// Phone.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
watch(phone);
for (const p of ['index', 'apps', 'company', 'trust', 'careers', 'press', 'contact', 'legal']) {
  await phone.goto(`${SITE}/${p}.html`);
  await phone.waitForTimeout(400);
  check(`phone: ${p} has no sideways scrolling`, !(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
}
await phone.goto(`${SITE}/`);
await phone.getByRole('button', { name: 'Menu' }).click();
check('phone: menu opens', await phone.locator('#primary-nav').isVisible());
await phone.keyboard.press('Escape');
check('phone: Escape closes the menu', !(await phone.locator('#primary-nav').isVisible()));
await shot(phone, 'phone-home', false);

check('no page errors or failed requests', errors.length === 0);
for (const [s, n] of results) console.log(s, n);
if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 8));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
