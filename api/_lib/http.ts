import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { StoreNotConfiguredError } from './store.js';

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const error = (status: number, message: string, extra: Record<string, unknown> = {}) =>
  json({ error: message, ...extra }, { status });

/** Wraps a handler so configuration problems and bad JSON become clean JSON errors. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof StoreNotConfiguredError || err instanceof AdminNotConfiguredError) {
        return error(503, err.message, { code: 'not_configured' });
      }
      if (err instanceof BadRequestError) return error(400, err.message);
      console.error(err);
      return error(500, 'Server error');
    }
  };
}

/** A problem with the client's request (as opposed to a server bug, which is a 500). */
export class BadRequestError extends Error {}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new BadRequestError('Expected JSON');
  const text = await req.text();
  if (text.length > maxBytes) throw new BadRequestError('Body too large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BadRequestError('Invalid JSON');
  }
}

// ---------------------------------------------------------------- auth

export class AdminNotConfiguredError extends Error {}

/** Two separate logins: admins run classes; the super admin edits workshop types. */
export type Role = 'admin' | 'super';
const ROLES = {
  admin: { env: 'ADMIN_PASSWORD', cookie: 'hp_admin' },
  super: { env: 'SUPERADMIN_PASSWORD', cookie: 'hp_super' },
} as const;

function rolePassword(role: Role): string {
  const password = process.env[ROLES[role].env];
  if (!password) {
    throw new AdminNotConfiguredError(`${ROLES[role].env} is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.`);
  }
  return password;
}

/** Signing key derived from the role's password: changing it logs that role out. */
function signingKey(role: Role): Buffer {
  return createHash('sha256').update(`homprung-photobooth:${role}:${rolePassword(role)}`).digest();
}

export const sign = (value: string, role: Role = 'admin') => createHmac('sha256', signingKey(role)).update(value).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(candidate: string, role: Role = 'admin'): boolean {
  // Compare digests so the comparison is constant-time regardless of length.
  const want = createHash('sha256').update(rolePassword(role)).digest('hex');
  const got = createHash('sha256').update(candidate).digest('hex');
  return safeEqual(want, got);
}

const LOGIN_TTL_S = 12 * 60 * 60;

export function loginCookie(req: Request, role: Role): string {
  const exp = Date.now() + LOGIN_TTL_S * 1000;
  const token = `${exp}.${sign(`${role}:${exp}`, role)}`;
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${ROLES[role].cookie}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${LOGIN_TTL_S}${secure}`;
}

export const logoutCookie = (role: Role) => `${ROLES[role].cookie}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`;

export function hasRole(req: Request, role: Role): boolean {
  const name = ROLES[role].cookie;
  const token = (req.headers.get('cookie') ?? '')
    .split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`${role}:${exp}`, role));
}

export const isAdmin = (req: Request) => hasRole(req, 'admin');

/** Lets a phone replace its own earlier photo without storing any secret. */
export const submissionToken = (sessionId: string, id: string) => sign(`sub:${sessionId}:${id}`);
export const checkSubmissionToken = (sessionId: string, id: string, token: string) =>
  safeEqual(token, submissionToken(sessionId, id));

// ---------------------------------------------------------------- ids

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const randomCode = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export function clientKey(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
}
