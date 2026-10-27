import type { PublicClassSession } from '../shared/classSession.js';
import { error, handler, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/session?code=XXXXXX — is this class open? (students) */
export const GET = handler(async (req) => {
  const code = new URL(req.url).searchParams.get('code')?.toUpperCase() ?? '';
  const session = await getStore().getSession();
  if (!session || session.code !== code) return error(404, 'No open class for this code', { code: 'no_session' });
  const body: PublicClassSession = { workshop: session.workshop, expiresAt: session.expiresAt, now: Date.now() };
  return json(body);
});
