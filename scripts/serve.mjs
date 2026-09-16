import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webm', 'video/webm']
]);

createServer(async (request, response) => {
  const rawPath = decodeURIComponent((request.url || '/').split('?')[0] || '/');
  const requested = rawPath === '/' ? '/index.html' : rawPath;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Sushi Libre preview: http://127.0.0.1:${port}`);
});
