import { adminCookie, checkPassword, clearAdminCookie, clientKey, error, handler, isAdmin, json, readJson } from '../_lib/http.js';
import { getStore } from '../_lib/store.js';

const MAX_FAILURES = 10;

/** GET /api/admin/login — am I logged in? */
export const GET = handler(async (req) => json({ admin: isAdmin(req) }));

/** POST /api/admin/login {password} — sets an HttpOnly session cookie (12 h). */
export const POST = handler(async (req) => {
  const { password } = await readJson<{ password?: string }>(req, 1024);
  const store = getStore();
  const who = clientKey(req);
  if ((await store.loginFailures(who)) >= MAX_FAILURES) {
    return error(429, 'Too many attempts. Try again in 15 minutes.', { code: 'locked' });
  }
  if (!checkPassword(String(password ?? ''))) {
    await store.recordLoginFailure(who);
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return error(401, 'Wrong password', { code: 'wrong_password' });
  }
  return json({ admin: true }, { headers: { 'Set-Cookie': adminCookie(req) } });
});

/** DELETE /api/admin/login — log out. */
export const DELETE = handler(async () => json({ admin: false }, { headers: { 'Set-Cookie': clearAdminCookie } }));
