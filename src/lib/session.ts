import { SESSION_TTL_MINUTES } from '../config';
import type { EditState } from './types';

/**
 * Local-only session storage. Everything lives in this browser's IndexedDB
 * and is wiped once SESSION_TTL_MINUTES have passed since the photo was picked.
 * Nothing is ever sent over the network.
 */

export const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60_000;

export type SavedScreen = 'editor' | 'done';

export interface PhotoRecord {
  createdAt: number;
  blob: Blob;
}

export interface StateRecord {
  edit: EditState;
  frameId: string | null;
  /** Optional text the customer typed for the frame band. */
  frameText?: string;
  screen: SavedScreen;
}

const DB_NAME = 'homprung-photobooth';
const STORE = 'session';
const CREATED_AT_KEY = 'homprung-photobooth:createdAt';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function isExpired(createdAt: number, now = Date.now()) {
  return now - createdAt > SESSION_TTL_MS;
}

export function minutesLeft(createdAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((createdAt + SESSION_TTL_MS - now) / 60_000));
}

function readCreatedAtFallback(): number | null {
  try {
    const v = sessionStorage.getItem(CREATED_AT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export async function savePhoto(record: PhotoRecord) {
  try {
    sessionStorage.setItem(CREATED_AT_KEY, String(record.createdAt));
  } catch {
    /* storage unavailable (private mode) – memory only */
  }
  try {
    await tx('readwrite', (s) => s.put(record, 'photo'));
  } catch {
    /* IndexedDB unavailable – work continues in memory, refresh won't restore */
  }
}

export async function saveState(record: StateRecord) {
  try {
    await tx('readwrite', (s) => s.put(record, 'state'));
  } catch {
    /* ignore */
  }
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'active'; photo: PhotoRecord; state: StateRecord | null };

/** Loads the saved session, wiping it (and reporting 'expired') if it is too old. */
export async function loadSession(): Promise<LoadResult> {
  let photo: PhotoRecord | undefined;
  let state: StateRecord | undefined;
  try {
    photo = await tx<PhotoRecord>('readonly', (s) => s.get('photo'));
    state = await tx<StateRecord>('readonly', (s) => s.get('state'));
  } catch {
    /* ignore */
  }
  const createdAt = photo?.createdAt ?? readCreatedAtFallback();
  if (createdAt != null && isExpired(createdAt)) {
    await clearSession();
    return { kind: 'expired' };
  }
  if (!photo) return { kind: 'none' };
  return { kind: 'active', photo, state: state ?? null };
}

export async function clearSession() {
  try {
    sessionStorage.removeItem(CREATED_AT_KEY);
  } catch {
    /* ignore */
  }
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}
