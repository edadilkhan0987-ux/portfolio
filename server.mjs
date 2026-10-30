import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4173;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = resolve(join(root, normalize(pathname)));
    if (!filePath.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }

    const headers = {
      'Content-Type': mime[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    };

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        let start = match[1] === '' ? null : Number(match[1]);
        let end = match[2] === '' ? null : Number(match[2]);
        if (start === null) {
          start = Math.max(0, info.size - (end ?? 0));
          end = info.size - 1;
        } else {
          end = end === null ? info.size - 1 : Math.min(end, info.size - 1);
        }
        if (start > end || start >= info.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
          return;
        }
        res.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${info.size}`,
          'Content-Length': end - start + 1,
        });
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).pipe(res);
  } catch (err) {
    const status = err?.code === 'ENOENT' ? 404 : 500;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not found' : 'Server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  Local preview: http://127.0.0.1:${port}\n  Press Ctrl+C to stop.\n`);
});
