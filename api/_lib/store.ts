import { Redis } from '@upstash/redis';
import type { ClassSession, SubmissionMeta } from '../../shared/classSession.js';

/**
 * Storage for the running class. Every key expires at the class end time,
 * so photos disappear automatically even if nobody presses "end class".
 *
 * Production uses Upstash Redis (Vercel → Storage → Upstash for Redis sets
 * KV_REST_API_URL / KV_REST_API_TOKEN). Without it, local development falls
 * back to an in-memory store.
 */
export interface Store {
  getSession(): Promise<ClassSession | null>;
  /** Replaces any running class (its photos are deleted). */
  startSession(session: ClassSession): Promise<void>;
  endSession(): Promise<void>;
  listSubmissions(sessionId: string): Promise<SubmissionMeta[]>;
  countSubmissions(sessionId: string): Promise<number>;
  getSubmission(sessionId: string, id: string): Promise<SubmissionMeta | null>;
  putSubmission(sessionId: string, meta: SubmissionMeta, base64: string, expiresAt: number): Promise<void>;
  getImage(sessionId: string, id: string): Promise<string | null>;
  deleteSubmission(sessionId: string, id: string): Promise<void>;
  /** Counts failed admin logins for `key` over a 15-minute window. */
  recordLoginFailure(key: string): Promise<number>;
  loginFailures(key: string): Promise<number>;
}

const K = {
  session: 'hp:session',
  subs: (sid: string) => `hp:subs:${sid}`,
  img: (sid: string, id: string) => `hp:img:${sid}:${id}`,
  login: (key: string) => `hp:login:${key}`,
};
const LOGIN_WINDOW_MS = 15 * 60_000;

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async getSession() {
    const raw = await this.redis.get<string>(K.session);
    if (!raw) return null;
    const s = JSON.parse(raw) as ClassSession;
    return s.expiresAt > Date.now() ? s : null;
  }

  async startSession(session: ClassSession) {
    await this.endSession();
    await this.redis.set(K.session, JSON.stringify(session), { pxat: session.expiresAt });
  }

  async endSession() {
    const raw = await this.redis.get<string>(K.session);
    if (!raw) return;
    const { id } = JSON.parse(raw) as ClassSession;
    const ids = await this.redis.hkeys(K.subs(id));
    await this.redis.del(K.session, K.subs(id), ...ids.map((sub) => K.img(id, sub)));
  }

  async listSubmissions(sessionId: string) {
    const all = await this.redis.hgetall<Record<string, string>>(K.subs(sessionId));
    return Object.values(all ?? {})
      .map((v) => JSON.parse(v) as SubmissionMeta)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  countSubmissions(sessionId: string) {
    return this.redis.hlen(K.subs(sessionId));
  }

  async getSubmission(sessionId: string, id: string) {
    const raw = await this.redis.hget<string>(K.subs(sessionId), id);
    return raw ? (JSON.parse(raw) as SubmissionMeta) : null;
  }

  async putSubmission(sessionId: string, meta: SubmissionMeta, base64: string, expiresAt: number) {
    const tx = this.redis.multi();
    tx.set(K.img(sessionId, meta.id), base64, { pxat: expiresAt });
    tx.hset(K.subs(sessionId), { [meta.id]: JSON.stringify(meta) });
    tx.pexpireat(K.subs(sessionId), expiresAt);
    await tx.exec();
  }

  getImage(sessionId: string, id: string) {
    return this.redis.get<string>(K.img(sessionId, id));
  }

  async deleteSubmission(sessionId: string, id: string) {
    const tx = this.redis.multi();
    tx.hdel(K.subs(sessionId), id);
    tx.del(K.img(sessionId, id));
    await tx.exec();
  }

  async recordLoginFailure(key: string) {
    const n = await this.redis.incr(K.login(key));
    if (n === 1) await this.redis.pexpire(K.login(key), LOGIN_WINDOW_MS);
    return n;
  }

  async loginFailures(key: string) {
    return Number((await this.redis.get<string>(K.login(key))) ?? 0);
  }
}

/** Single-process store for `npm run dev`. Data is lost on restart. */
class MemoryStore implements Store {
  private data = new Map<string, { value: unknown; expiresAt: number }>();

  private get<T>(key: string): T | null {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return e.value as T;
  }
  private set(key: string, value: unknown, expiresAt: number) {
    this.data.set(key, { value, expiresAt });
  }

  async getSession() {
    return this.get<ClassSession>(K.session);
  }
  async startSession(session: ClassSession) {
    await this.endSession();
    this.set(K.session, session, session.expiresAt);
  }
  async endSession() {
    const s = this.get<ClassSession>(K.session);
    if (!s) return;
    for (const key of [...this.data.keys()]) {
      if (key === K.session || key === K.subs(s.id) || key.startsWith(`hp:img:${s.id}:`)) this.data.delete(key);
    }
  }
  private subs(sid: string) {
    return this.get<Map<string, SubmissionMeta>>(K.subs(sid));
  }
  async listSubmissions(sid: string) {
    return [...(this.subs(sid)?.values() ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  }
  async countSubmissions(sid: string) {
    return this.subs(sid)?.size ?? 0;
  }
  async getSubmission(sid: string, id: string) {
    return this.subs(sid)?.get(id) ?? null;
  }
  async putSubmission(sid: string, meta: SubmissionMeta, base64: string, expiresAt: number) {
    const subs = this.subs(sid) ?? new Map<string, SubmissionMeta>();
    subs.set(meta.id, meta);
    this.set(K.subs(sid), subs, expiresAt);
    this.set(K.img(sid, meta.id), base64, expiresAt);
  }
  async getImage(sid: string, id: string) {
    return this.get<string>(K.img(sid, id));
  }
  async deleteSubmission(sid: string, id: string) {
    this.subs(sid)?.delete(id);
    this.data.delete(K.img(sid, id));
  }
  async recordLoginFailure(key: string) {
    const n = (this.get<number>(K.login(key)) ?? 0) + 1;
    const prev = this.data.get(K.login(key));
    this.set(K.login(key), n, prev && prev.expiresAt > Date.now() ? prev.expiresAt : Date.now() + LOGIN_WINDOW_MS);
    return n;
  }
  async loginFailures(key: string) {
    return this.get<number>(K.login(key)) ?? 0;
  }
}

export class StoreNotConfiguredError extends Error {}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // Values are stored as plain strings; JSON is handled here, not by the client.
    store = new RedisStore(new Redis({ url, token, automaticDeserialization: false }));
  } else if (process.env.VERCEL) {
    throw new StoreNotConfiguredError(
      'Storage is not set up. In Vercel, add "Upstash for Redis" under Storage and connect it to this project.',
    );
  } else {
    // Shared across module reloads in the dev server.
    const g = globalThis as { __hpMemoryStore?: Store };
    store = g.__hpMemoryStore ??= new MemoryStore();
  }
  return store;
}
