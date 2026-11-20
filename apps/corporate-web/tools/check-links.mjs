// Fails if any page links to a local file that does not exist, or to a missing #anchor on another page.
//   node tools/check-links.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pages = readdirSync(root).filter(f => f.endsWith('.html'));
const ids = Object.fromEntries(pages.map(p => [p, new Set([...readFileSync(join(root, p), 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));
const problems = [];

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const [, ref] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const [pathAndQuery, anchor] = ref.split('#');
    const path = pathAndQuery.split('?')[0];
    if (path && !existsSync(join(root, path))) problems.push(`${page}: missing file ${path}`);
    const target = path || page;
    if (anchor && ids[target] && !ids[target].has(anchor)) problems.push(`${page}: ${target} has no #${anchor}`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Links OK across ${pages.length} pages.`);
