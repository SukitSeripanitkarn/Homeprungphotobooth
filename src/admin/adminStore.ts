import { PRINT_DIAMETER_MM, SHEET_DEFAULTS } from '../config';
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

export interface SheetSettings {
  paper: PaperId;
  marginMm: number;
  gapMm: number;
  bleedMm: number;
  /** Size of the students' stickers. */
  classDiameterMm: number;
  copiesPerPerson: number;
  /** Draw a thin cut line when printing from the browser (for scissors). */
  cutGuide: boolean;
}

export const DEFAULT_SETTINGS: SheetSettings = {
  paper: SHEET_DEFAULTS.paper,
  marginMm: SHEET_DEFAULTS.marginMm,
  gapMm: SHEET_DEFAULTS.gapMm,
  bleedMm: SHEET_DEFAULTS.bleedMm,
  classDiameterMm: PRINT_DIAMETER_MM,
  copiesPerPerson: SHEET_DEFAULTS.copiesPerPerson,
  cutGuide: false,
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

export const loadSettings = () => readJson<SheetSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
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
