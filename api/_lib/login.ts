import { checkPassword, clientKey, error, handler, hasRole, json, loginCookie, logoutCookie, readJson, type Role } from './http.js';
import { getStore } from './store.js';

const MAX_FAILURES = 10;

/** GET (status) / POST {password} (log in, 12 h HttpOnly cookie) / DELETE (log out) for one role. */
export function loginEndpoints(role: Role) {
  return {
    GET: handler(async (req) => json({ [role]: hasRole(req, role) })),
    POST: handler(async (req) => {
      const { password } = await readJson<{ password?: string }>(req, 1024);
      const store = getStore();
      const who = `${role}:${clientKey(req)}`;
      if ((await store.loginFailures(who)) >= MAX_FAILURES) {
        return error(429, 'Too many attempts. Try again in 15 minutes.', { code: 'locked' });
      }
      if (!checkPassword(String(password ?? ''), role)) {
        await store.recordLoginFailure(who);
        await new Promise((r) => setTimeout(r, 600)); // slow down guessing
        return error(401, 'Wrong password', { code: 'wrong_password' });
      }
      return json({ [role]: true }, { headers: { 'Set-Cookie': loginCookie(req, role) } });
    }),
    DELETE: handler(async () => json({ [role]: false }, { headers: { 'Set-Cookie': logoutCookie(role) } })),
  };
}
