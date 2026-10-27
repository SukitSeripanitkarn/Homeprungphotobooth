import { randomUUID } from 'node:crypto';
import {
  CLASS_SESSION_MINUTES,
  MAX_WORKSHOP_LENGTH,
  type AdminSessionResponse,
  type ClassSession,
} from '../_lib/classSession.js';
import { error, handler, isAdmin, json, randomCode, readJson } from '../_lib/http.js';
import { getStore } from '../_lib/store.js';

const unauthorized = () => error(401, 'Not logged in', { code: 'unauthorized' });

async function current(): Promise<AdminSessionResponse> {
  const store = getStore();
  const session = await store.getSession();
  const submissions = session ? await store.listSubmissions(session.id) : [];
  return { session, submissions, now: Date.now() };
}

/** GET /api/admin/session — the running class and its photos (metadata only). */
export const GET = handler(async (req) => (isAdmin(req) ? json(await current()) : unauthorized()));

/** POST /api/admin/session {workshop} — start a new 1-hour class (ends any running one). */
export const POST = handler(async (req) => {
  if (!isAdmin(req)) return unauthorized();
  const { workshop } = await readJson<{ workshop?: string }>(req, 4096);
  const startedAt = Date.now();
  const session: ClassSession = {
    id: randomUUID(),
    code: randomCode(6),
    workshop: String(workshop ?? '').trim().slice(0, MAX_WORKSHOP_LENGTH),
    startedAt,
    expiresAt: startedAt + CLASS_SESSION_MINUTES * 60_000,
  };
  await getStore().startSession(session);
  return json(await current());
});

/** DELETE /api/admin/session — end the class now and delete every photo. */
export const DELETE = handler(async (req) => {
  if (!isAdmin(req)) return unauthorized();
  await getStore().endSession();
  return json(await current());
});
