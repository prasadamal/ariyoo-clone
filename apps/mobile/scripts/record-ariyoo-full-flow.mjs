import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = '/opt/cursor/artifacts';
let APP = process.env.DEMO_APP_URL || 'http://localhost:4200';

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
const pause = ms => page.waitForTimeout(ms);

await page.addInitScript(() => {
  const removeOverlay = () => {
    document.getElementById('webpack-dev-server-client-overlay')?.remove();
    document.getElementById('error-overlay')?.remove();
  };
  removeOverlay();
  new MutationObserver(removeOverlay).observe(document.documentElement, { childList: true, subtree: true });
});

try {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle', timeout: 120000 });
  await pause(1000);

  await page.locator('#email').fill('solver@example.com');
  await page.locator('#password').fill('password');
  await page.locator('#password').press('Enter');
  await page.waitForURL('**/home**', { timeout: 30000 });
  await pause(2000);

  await page.getByRole('heading', { name: 'Welcome to Ariyoo' }).waitFor();
  const textarea = page.locator('textarea').first();
  await textarea.fill('What are the best quiet cafes in Mumbai for remote work? #mumbai');
  await pause(1200);

  await page.evaluate(() => document.getElementById('webpack-dev-server-client-overlay')?.remove());
  await page.locator('button.absolute.right-4.bottom-4').click({ force: true });
  await pause(3500);

  await page.evaluate(() => document.getElementById('webpack-dev-server-client-overlay')?.remove());
  await page.getByRole('link', { name: 'Chat' }).click({ force: true });
  await page.waitForURL('**/chat**', { timeout: 20000 });
  await pause(3000);

  await page.evaluate(() => document.getElementById('webpack-dev-server-client-overlay')?.remove());
  await page.getByRole('link', { name: 'Profile' }).click({ force: true });
  await page.waitForURL('**/profile**', { timeout: 20000 });
  await pause(2500);

  await page.evaluate(() => document.getElementById('webpack-dev-server-client-overlay')?.remove());
  await page.getByRole('link', { name: 'Home' }).click({ force: true });
  await page.waitForURL('**/home**', { timeout: 20000 });
  await pause(2000);
} catch (err) {
  await page.screenshot({ path: join(OUT_DIR, 'full-flow-error.png'), fullPage: true });
  console.error(err);
  process.exitCode = 1;
}

const video = page.video();
await context.close();
await browser.close();

if (video) {
  const src = await video.path();
  const dest = join(OUT_DIR, 'ariyoo-full-flow-demo.webm');
  copyFileSync(src, dest);
  console.log('Saved', dest);
}
