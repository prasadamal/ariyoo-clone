// Load TS test modules through the CJS hook: direct .ts entrypoints can be reported as
// passing files without registering their node:test cases in some Node/tsx combinations.
// Run this entrypoint directly; node:test automatically executes registered cases and sets failure exit status.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
function load(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) load(file);
    else if (entry.name.endsWith('.test.ts')) require(file);
  }
}
load(path.resolve(__dirname, '../src'));
