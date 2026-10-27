import { error, handler, isAdmin, json } from '../_lib/http.js';
import { getStore } from '../_lib/store.js';

async function find(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const store = getStore();
  const session = await store.getSession();
  const meta = session && id ? await store.getSubmission(session.id, id) : null;
  return { store, session, meta };
}

/** GET /api/admin/photo?id= — one student's sticker image. */
export const GET = handler(async (req) => {
  if (!isAdmin(req)) return error(401, 'Not logged in', { code: 'unauthorized' });
  const { store, session, meta } = await find(req);
  const base64 = session && meta ? await store.getImage(session.id, meta.id) : null;
  if (!meta || !base64) return error(404, 'Not found');
  return new Response(Buffer.from(base64, 'base64'), {
    headers: {
      'Content-Type': meta.type,
      // Private to the admin's browser; the id changes nothing but updatedAt busts it.
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

/** DELETE /api/admin/photo?id= — remove a photo (e.g. sent by mistake). */
export const DELETE = handler(async (req) => {
  if (!isAdmin(req)) return error(401, 'Not logged in', { code: 'unauthorized' });
  const { store, session, meta } = await find(req);
  if (session && meta) await store.deleteSubmission(session.id, meta.id);
  return json({ ok: true });
});
