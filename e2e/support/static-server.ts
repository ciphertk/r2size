import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

/**
 * A minimal static server for dist/, used only by update-flow.spec.ts. Playwright's routing
 * doesn't see the browser's own service-worker update check, so this server simulates a deploy
 * instead: after `publishNextVersion()`, /sw.js gains a few bytes, which is what makes the
 * browser treat it as a new version. Unknown paths serve index.html, like Cloudflare Pages.
 */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export interface TestServer {
  readonly url: string;
  readonly publishNextVersion: () => void;
  readonly close: () => Promise<void>;
}

export const startStaticServer = async (root = 'dist'): Promise<TestServer> => {
  let nextVersion = false;
  const server: Server = createServer((request, response) => {
    void (async () => {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
      const file = normalize(join(root, path === '/' ? 'index.html' : path));
      let body: Buffer;
      let type = TYPES[extname(file)] ?? 'application/octet-stream';
      try {
        if (!file.startsWith(normalize(root))) throw new Error('outside root');
        body = await readFile(file);
      } catch {
        body = await readFile(join(root, 'index.html'));
        type = TYPES['.html'] ?? 'text/html';
      }
      if (path === '/sw.js' && nextVersion) {
        body = Buffer.concat([body, Buffer.from('\n// next version\n')]);
      }
      response.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
      response.end(body);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    publishNextVersion: () => {
      nextVersion = true;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};
