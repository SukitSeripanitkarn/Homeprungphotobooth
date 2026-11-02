import { DEFAULT_WORKSHOP_TYPES } from '../../api/_lib/classSession';
import { DEFAULT_PAPER } from '../config';
import type { PaperId } from '../lib/pack';

/**
 * Admin-only data kept in the admin's own browser:
 * - extra (batch) stickers in IndexedDB — never uploaded;
 * - sheet settings and per-photo copy counts in localStorage.
 */

export interface ExtraSticker {
  id: string;
  label: string;
  /** Finished sticker image (square PNG, transparent outside the circle). */
  blob: Blob;
  diameterMm: number;
  count: number;
  createdAt: number;
}

/**
 * The only printing choices the admin makes. Sticker size, margin and gap
 * come from the class's workshop type; bleed is always 0.
 */
export interface SheetSettings {
  paper: PaperId;
  copiesPerPerson: number;
  /** Workshop type id preselected when starting the next class (falls back to the first type). */
  nextType: string;
}

export const DEFAULT_SETTINGS: SheetSettings = {
  paper: DEFAULT_PAPER,
  copiesPerPerson: 1,
  nextType: DEFAULT_WORKSHOP_TYPES[0].id,
};

const SETTINGS_KEY = 'homprung-admin:settings';
const copiesKey = (sessionId: string) => `homprung-admin:copies:${sessionId}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadSettings(): SheetSettings {
  // Older saved settings also held size/margin/gap/bleed; only these survive.
  const saved = readJson<Partial<SheetSettings>>(SETTINGS_KEY, {});
  return {
    paper: saved.paper === 'A4' ? 'A4' : DEFAULT_SETTINGS.paper,
    copiesPerPerson: typeof saved.copiesPerPerson === 'number' ? saved.copiesPerPerson : DEFAULT_SETTINGS.copiesPerPerson,
    nextType: typeof saved.nextType === 'string' ? saved.nextType : DEFAULT_SETTINGS.nextType,
  };
}
export const saveSettings = (s: SheetSettings) => writeJson(SETTINGS_KEY, s);
export const loadCopies = (sessionId: string) => readJson<Record<string, number>>(copiesKey(sessionId), {});
export const saveCopies = (sessionId: string, copies: Record<string, number>) => writeJson(copiesKey(sessionId), copies);

// ---- extras (IndexedDB)

const DB_NAME = 'homprung-admin';
const STORE = 'extras';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

export async function listExtras(): Promise<ExtraSticker[]> {
  const all = await run<ExtraSticker[]>('readonly', (s) => s.getAll() as IDBRequest<ExtraSticker[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}
export const putExtra = (x: ExtraSticker) => run('readwrite', (s) => s.put(x));
export const deleteExtra = (id: string) => run('readwrite', (s) => s.delete(id));
