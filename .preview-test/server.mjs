import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
createServer((req, res) => {
  try {
    const path = (req.url || '/').split('?')[0];
    const js = /^\/([a-z]+\.js)$/.exec(path);
    if (js) {
      const body = readFileSync(join(dir, '..', 'packages', 'snippet', 'dist', js[1]));
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(body);
      return;
    }
    // Serve any named .html in this folder (local.html, abclose.html, …); default to index.html.
    const named = /^\/([a-z0-9-]+\.html)$/.exec(path)?.[1];
    const file = named && existsSync(join(dir, named)) ? named : 'index.html';
    const html = readFileSync(join(dir, file));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(4555, () => console.log('repro server on http://localhost:4555'));
