import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = '/opt/cursor/artifacts';
const API = 'http://localhost:5296';
const APP = 'http://localhost:8081';

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
});
const page = await context.newPage();

const pause = ms => page.waitForTimeout(ms);

try {
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 120000 });
  await pause(1500);

  // Login
  const email = page.locator('input').first();
  await email.waitFor({ timeout: 30000 });
  await email.fill('solver@example.com');
  await page.locator('input').nth(1).fill('password');
  await pause(500);
  await page.getByText('Sign in', { exact: true }).click();
  await pause(2500);

  // Ask tab
  await page.getByText('Ask a question').waitFor({ timeout: 20000 });
  const question = page.locator('textarea, input').filter({ hasNotText: '' }).first();
  await question.click();
  await question.fill('Best quiet cafes in Mumbai for remote work? #mumbai #food');
  await pause(1000);
  await page.getByText('Send to experts', { exact: true }).click();
  await pause(3500);

  // Chat screen or stay on ask — try send message if conversation visible
  const msgInput = page.locator('input[placeholder="Type a message"]');
  if (await msgInput.isVisible().catch(() => false)) {
    await msgInput.fill('Thanks — need good wifi and coffee.');
    await pause(500);
    await page.getByText('Send', { exact: true }).last().click();
    await pause(2000);
  }

  // Chats tab
  await page.getByText('Chats', { exact: true }).click();
  await pause(2000);
  const session = page.getByText(/Mumbai|cafes|quiet/i).first();
  if (await session.isVisible().catch(() => false)) {
    await session.click();
    await pause(2000);
  }

  // Profile tab
  await page.getByText('Profile', { exact: true }).click();
  await pause(2500);

  // Sign out button visible
  await page.getByText('Sign out').waitFor({ timeout: 10000 });
  await pause(1500);
} catch (err) {
  await page.screenshot({ path: join(OUT_DIR, 'demo-flow-error.png'), fullPage: true });
  console.error('Demo flow error:', err);
  process.exitCode = 1;
}

await context.close();
await browser.close();

const videoPath = (await import('fs/promises'))
  .readdir(OUT_DIR)
  .then(files => files.find(f => f.endsWith('.webm')))
  .catch(() => null);

console.log('Video artifact:', videoPath ? join(OUT_DIR, videoPath) : 'pending rename');
