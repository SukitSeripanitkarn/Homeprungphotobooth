import { randomUUID } from 'node:crypto';
import {
  MAX_IMAGE_BYTES,
  MAX_NAME_LENGTH,
  MAX_SUBMISSIONS_PER_CLASS,
  type SubmissionMeta,
  type SubmitRequest,
  type SubmitResponse,
} from '../shared/classSession.js';
import { checkSubmissionToken, error, handler, json, readJson, submissionToken } from './_lib/http.js';
import { getStore } from './_lib/store.js';

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Checks the first bytes really are the image type the data URL claims. */
function looksLike(type: string, bytes: Buffer) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === 'image/png') return bytes.subarray(0, 4).toString('hex') === '89504e47';
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
}

/** POST /api/submit — a student sends (or replaces) their finished sticker. */
export const POST = handler(async (req) => {
  const body = await readJson<SubmitRequest>(req, Math.ceil(MAX_IMAGE_BYTES * 1.4) + 4096);
  const store = getStore();
  const session = await store.getSession();
  if (!session || String(body.code ?? '').toUpperCase() !== session.code) {
    return error(410, 'This class is closed', { code: 'no_session' });
  }

  const match = DATA_URL.exec(String(body.image ?? ''));
  if (!match) return error(400, 'Image must be a JPEG, PNG or WebP data URL');
  const [, type, base64] = match;
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) return error(413, 'Image too large');
  if (!looksLike(type, bytes)) return error(400, 'Image data does not match its type');

  const name = String(body.name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  const now = Date.now();

  let id: string;
  let createdAt = now;
  const replacing = body.id && body.token ? await store.getSubmission(session.id, body.id) : null;
  if (replacing && checkSubmissionToken(session.id, replacing.id, String(body.token))) {
    id = replacing.id;
    createdAt = replacing.createdAt;
  } else {
    if ((await store.countSubmissions(session.id)) >= MAX_SUBMISSIONS_PER_CLASS) {
      return error(429, 'This class has reached its photo limit', { code: 'full' });
    }
    id = randomUUID().replace(/-/g, '').slice(0, 16);
  }

  const meta: SubmissionMeta = { id, name, type, bytes: bytes.length, createdAt, updatedAt: now };
  await store.putSubmission(session.id, meta, base64, session.expiresAt);
  const res: SubmitResponse = { id, token: submissionToken(session.id, id), expiresAt: session.expiresAt };
  return json(res);
});
