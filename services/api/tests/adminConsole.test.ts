import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';
import { ADMIN_CONSOLE_JS } from '../src/adminConsole.js';

test('the moderation page is served without secrets, under a no-inline-script policy, and never renders user text as HTML', async () => {
  const { server, io } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const page = await fetch(`${base}/admin-console`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const csp = page.headers.get('content-security-policy') ?? '';
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline'[^;]*script|script-src[^;]*unsafe-inline/);
    const html = await page.text();
    assert.match(html, /<script src="\/admin-console.js"><\/script>/);
    assert.doesNotMatch(html, /<script>[^<]/);
    const script = await fetch(`${base}/admin-console.js`);
    assert.match(script.headers.get('content-type') ?? '', /javascript/);
    // The page holds no key of its own, and user-supplied text only ever goes through textContent.
    assert.doesNotMatch(ADMIN_CONSOLE_JS, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    assert.doesNotMatch(html + ADMIN_CONSOLE_JS, /ADMIN_API_KEY=|isolated-ci/);
    // Actions still require the key: the page alone grants nothing.
    assert.ok([401, 503].includes((await fetch(`${base}/admin/reports`)).status));
  } finally {
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
