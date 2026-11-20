// End-to-end checks in a real browser.
//   node tools/serve.mjs &   then   SITE_URL=http://localhost:4000 node tests/e2e.mjs [screenshot-dir]
// Needs Playwright with Chromium.
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:4000';
const EMAIL = 'Ariyoo@test.com';
const shots = process.argv[2];
const results = [];
const errors = [];
const check = (name, ok) => results.push([ok ? 'PASS' : 'FAIL', name]);
const shot = async (page, name, full = true) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full }); };
const PAGES = ['index', 'apps', 'company', 'trust', 'careers', 'press', 'contact', 'legal'];

const browser = await chromium.launch();
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/\/nope$/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => { if (!r.url().startsWith(SITE) && !r.url().startsWith('data:')) errors.push(`outside request: ${r.url()}`); });
};
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
watch(page);

// Every page: one heading, the shared header and footer, and nothing loaded from anywhere else.
for (const p of PAGES) {
  await page.goto(`${SITE}/${p}.html`);
  await page.waitForTimeout(600);
  check(`${p}: one h1, header and footer`, (await page.locator('h1').count()) === 1 && (await page.locator('header.site-header').count()) === 1 && (await page.locator('footer.site-footer').count()) === 1);
  check(`${p}: no forms`, (await page.locator('form').count()) === 0);
  await shot(page, `desk-${p}`);
}
await page.goto(`${SITE}/nope`);
check('unknown address shows the 404 page', (await page.getByText("We couldn't find that page.").count()) === 1);

// Contact and careers: email links with a subject already filled in.
await page.goto(`${SITE}/contact.html`);
const mailtos = await page.$$eval('main a[href^="mailto:"]', links => links.map(a => a.getAttribute('href')));
const cta = await page.$eval('.nav .btn', el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
check('contact: the header button stays white on purple on its own page', cta[0] === 'rgb(255, 255, 255)' && cta[1] === 'rgb(106, 0, 165)');
check('footer email is peach', (await page.$eval('.site-footer address a', el => getComputedStyle(el).color)) === 'rgb(252, 151, 69)');
check('contact: six topics, each emailing us with its own subject', mailtos.filter(h => h.includes('?subject=')).length === 6 && new Set(mailtos).size === 7 && mailtos.every(h => h.startsWith(`mailto:${EMAIL}`)));
await page.goto(`${SITE}/careers.html`);
check('careers: email link with a subject', (await page.locator(`a[href="mailto:${EMAIL}?subject=Careers%20at%20Ariyoo"]`).count()) === 1);
await page.goto(`${SITE}/press.html`);
check('press: media email link', (await page.locator(`a[href="mailto:${EMAIL}?subject=Media%20enquiry"]`).count()) === 1);

// Moving parts on the home page.
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
await page.goto(`${SITE}/apps.html#wayfare`);
await page.waitForTimeout(600);
check('apps.html#wayfare lands on Wayfare', await page.evaluate(() => Math.abs(document.getElementById('wayfare').getBoundingClientRect().top) < 120));

const reduced = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
watch(reduced);
await reduced.goto(`${SITE}/`);
await reduced.waitForTimeout(500);
const r1 = await reduced.$$eval('.hero-phones img.on', i => i.map(x => x.src).join('|'));
await reduced.waitForTimeout(5500);
check('reduced motion: nothing moves', r1 === (await reduced.$$eval('.hero-phones img.on', i => i.map(x => x.src).join('|'))) && (await reduced.$eval('.marquee .track', t => getComputedStyle(t).animationName)) === 'none');
await shot(reduced, 'desk-home-hero', false);

// Phone.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
watch(phone);
for (const p of PAGES) {
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
await phone.goto(`${SITE}/contact.html`);
await shot(phone, 'phone-contact');

check('no page errors, failed requests or requests to other sites', errors.length === 0);
for (const [s, n] of results) console.log(s, n);
if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 8));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
