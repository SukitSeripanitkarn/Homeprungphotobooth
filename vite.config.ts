import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves /api/* in `npm run dev` the way Vercel does in production: each
 * api/<path>.ts file exports GET/POST/DELETE handlers taking a Web Request.
 * Without Upstash env vars the API uses an in-memory store.
 */
function vercelApiDev(): Plugin {
  async function toRequest(req: IncomingMessage): Promise<Request> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    return new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
  }

  async function send(res: ServerResponse, response: Response) {
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        if (!path.startsWith('/api/')) return next();
        const file = resolve(import.meta.dirname, `.${path}.ts`);
        if (path.includes('..') || path.includes('/_') || !existsSync(file)) {
          res.statusCode = 404;
          return res.end('Not found');
        }
        try {
          const mod = await server.ssrLoadModule(file);
          const fn = mod[req.method ?? 'GET'];
          if (typeof fn !== 'function') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          await send(res, await fn(await toRequest(req)));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end('Server error');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vercelApiDev()],
  build: { outDir: 'dist', target: 'es2020' },
});
