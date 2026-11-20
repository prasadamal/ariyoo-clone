// Local preview server with no dependencies: node tools/serve.mjs [port]
// Needed because browsers do not load JavaScript modules from file:// pages.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root) || file.includes(`${'/'}tools${'/'}`) || file.includes(`${'/'}tests${'/'}`)) file = '';
  const found = file && existsSync(file) && statSync(file).isFile();
  const target = found ? file : join(root, '404.html');
  res.writeHead(found ? 200 : 404, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  createReadStream(target).pipe(res);
}).listen(port, () => console.log(`Ariyoo site on http://localhost:${port}`));
