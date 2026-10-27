import type { EditState } from './types';

/**
 * Work in progress on the student's phone (photo + edits), kept in this
 * browser's IndexedDB so a refresh doesn't lose it. It belongs to one class
 * (its code) and is wiped when that class ends, at most 1 hour after the
 * admin started it.
 */

export type SavedScreen = 'editor' | 'done';

export interface PhotoRecord {
  /** Class code from the QR link. */
  code: string;
  /** Class end time (server clock). */
  expiresAt: number;
  blob: Blob;
}

export interface StateRecord {
  edit: EditState;
  frameId: string | null;
  /** Optional text the customer typed for the frame band. */
  frameText?: string;
  /** Name sent to the admin with the sticker. */
  name?: string;
  /** Lets this phone replace its earlier submission. */
  submission?: { id: string; token: string };
  screen: SavedScreen;
}

const DB_NAME = 'homprung-photobooth';
const STORE = 'session';
const CLASS_KEY = 'homprung-photobooth:class';

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

export function isExpired(expiresAt: number, now = Date.now()) {
  return now >= expiresAt;
}

export function minutesLeft(expiresAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((expiresAt - now) / 60_000));
}

function readClassFallback(): { code: string; expiresAt: number } | null {
  try {
    const v = sessionStorage.getItem(CLASS_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function savePhoto(record: PhotoRecord) {
  try {
    sessionStorage.setItem(CLASS_KEY, JSON.stringify({ code: record.code, expiresAt: record.expiresAt }));
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

/**
 * Loads saved work for class `code`. Work from another class is discarded;
 * work from this class is wiped (and reported 'expired') once it has ended.
 */
export async function loadSession(code: string, now = Date.now()): Promise<LoadResult> {
  let photo: PhotoRecord | undefined;
  let state: StateRecord | undefined;
  try {
    photo = await tx<PhotoRecord>('readonly', (s) => s.get('photo'));
    state = await tx<StateRecord>('readonly', (s) => s.get('state'));
  } catch {
    /* ignore */
  }
  const saved = photo ?? readClassFallback();
  if (saved && (saved.code !== code || isExpired(saved.expiresAt, now))) {
    await clearSession();
    return saved.code === code ? { kind: 'expired' } : { kind: 'none' };
  }
  if (!photo) return { kind: 'none' };
  return { kind: 'active', photo, state: state ?? null };
}

export async function clearSession() {
  try {
    sessionStorage.removeItem(CLASS_KEY);
  } catch {
    /* ignore */
  }
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}
