import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePageRequest, splitLocalePath } from './localization.mjs';

const directory = fileURLToPath(new URL('../static-site/', import.meta.url));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  let pathname;
  const url = new URL(request.url, 'http://localhost');
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end(); return; }
  const page = resolvePageRequest(pathname, url.search, routes);
  if (page?.redirect) { response.writeHead(301, { Location: page.redirect }); response.end(); return; }
  const language = splitLocalePath(pathname).language || 'en';
  let file = resolve(directory, '.' + pathname);
  if (file !== directory.replace(/\/$/, '') && !file.startsWith(directory.replace(/\/$/, '') + sep)) { response.writeHead(403); response.end(); return; }
  let status = 200;
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    await stat(file);
  } catch { file = resolve(directory, language.toLowerCase(), '404.html'); status = 404; }
  try {
    const body = await readFile(file);
    response.writeHead(status, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': body.length, ...(file.endsWith('.html') ? { 'Content-Language': language } : {}) });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end(); }
});
const port = Number(process.env.PORT || 8011);
server.listen(port, '127.0.0.1', () => console.log(`Static language pages: http://127.0.0.1:${port}/`));
