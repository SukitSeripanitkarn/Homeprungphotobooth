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

/** Signing key derived from ADMIN_PASSWORD: changing the password logs everyone out. */
function signingKey(): Buffer {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new AdminNotConfiguredError('ADMIN_PASSWORD is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  return createHash('sha256').update(`homprung-photobooth:${password}`).digest();
}

export const sign = (value: string) => createHmac('sha256', signingKey()).update(value).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(candidate: string): boolean {
  // Compare digests so the comparison is constant-time regardless of length.
  const want = createHash('sha256').update(process.env.ADMIN_PASSWORD ?? '').digest('hex');
  const got = createHash('sha256').update(candidate).digest('hex');
  signingKey(); // throws if not configured
  return safeEqual(want, got);
}

export const ADMIN_COOKIE = 'hp_admin';
const ADMIN_TTL_S = 12 * 60 * 60;

export function adminCookie(req: Request): string {
  const exp = Date.now() + ADMIN_TTL_S * 1000;
  const token = `${exp}.${sign(`admin:${exp}`)}`;
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_TTL_S}${secure}`;
}

export const clearAdminCookie = `${ADMIN_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`;

export function isAdmin(req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? '';
  const token = cookie
    .split(/;\s*/)
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`admin:${exp}`));
}

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
