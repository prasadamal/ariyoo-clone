// Runs every *.test.ts / *.test.cjs in this folder through one node:test process.
// Loading TypeScript through the CJS hook makes sure the cases really register and run.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
for (const name of fs.readdirSync(__dirname).sort()) {
  if (/\.test\.(ts|cjs)$/.test(name)) require(path.join(__dirname, name));
}
