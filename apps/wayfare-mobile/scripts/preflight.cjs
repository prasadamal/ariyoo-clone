#!/usr/bin/env node
// Release preflight: `npm run preflight` (reads the current shell environment, so run
// `eas env:pull --environment production` first, or export the EXPO_PUBLIC_* values).
// Exits 1 when a store build would ship broken; warnings do not fail it.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
const { checkRelease } = require('../src/lib/releaseChecks.ts');

const app = path.resolve(__dirname, '..');
for (const file of ['.env', '.env.local']) {
  const full = path.join(app, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const configSource = fs.readFileSync(path.join(app, 'app.config.ts'), 'utf8');
const pasted = /const easProjectId = process\.env\.EAS_PROJECT_ID \|\| '([^']*)'/.exec(configSource)?.[1] ?? '';

const problems = checkRelease({
  env: process.env,
  eas: JSON.parse(fs.readFileSync(path.join(app, 'eas.json'), 'utf8')),
  webConfig: fs.readFileSync(path.resolve(app, '../../docs/wayfare-config.js'), 'utf8'),
  hasGoogleServices: Boolean(process.env.GOOGLE_SERVICES_JSON) || fs.existsSync(path.join(app, 'google-services.json')),
  easProjectId: process.env.EAS_PROJECT_ID || pasted,
});

for (const p of problems) console.log(`${p.level === 'error' ? '✖' : '!'} ${p.message}`);
const errors = problems.filter(p => p.level === 'error').length;
console.log(errors ? `\n${errors} thing(s) to fix before a store build.` : '\nReady for a store build.');
process.exit(errors ? 1 : 0);
