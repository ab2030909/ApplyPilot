// StorageService: lightweight data in chrome.storage.local (falls back to localStorage when the
// dashboard runs as a plain web page), file blobs in IndexedDB.

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;
const LS_PREFIX = 'applypilot:';
const localListeners = new Map<string, Set<() => void>>();

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export async function getItem<T>(key: string, fallback: T): Promise<T> {
  if (hasChrome) {
    const res = await chrome.storage.local.get(key);
    return (res[key] as T | undefined) ?? fallback;
  }
  const raw = localStorage.getItem(LS_PREFIX + key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  localListeners.get(key)?.forEach((cb) => cb());
}

export async function removeItem(key: string): Promise<void> {
  if (hasChrome) await chrome.storage.local.remove(key);
  else {
    localStorage.removeItem(LS_PREFIX + key);
    localListeners.get(key)?.forEach((cb) => cb());
  }
}

/** Subscribe to changes of one key (including changes made by other extension pages). */
export function subscribe(key: string, cb: () => void): () => void {
  if (hasChrome) {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && key in changes) cb();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
  if (!localListeners.has(key)) localListeners.set(key, new Set());
  localListeners.get(key)!.add(cb);
  const onStorage = (e: StorageEvent) => e.key === LS_PREFIX + key && cb();
  window.addEventListener('storage', onStorage);
  return () => {
    localListeners.get(key)?.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

// ---------- IndexedDB (resume files) ----------
const DB_NAME = 'applypilot';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putFile = (id: string, blob: Blob) => withStore('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getFile = (id: string) => withStore<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => withStore('readwrite', (s) => s.delete(id)).then(() => undefined);
export const clearFiles = () => withStore('readwrite', (s) => s.clear()).then(() => undefined);

/** Remove everything ApplyPilot has stored locally. */
export async function clearAllData(): Promise<void> {
  if (hasChrome) await chrome.storage.local.clear();
  else Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
  await clearFiles();
  localListeners.forEach((set) => set.forEach((cb) => cb()));
}

export async function exportAllData(): Promise<Record<string, unknown>> {
  if (hasChrome) return await chrome.storage.local.get(null);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(localStorage)) if (k.startsWith(LS_PREFIX)) out[k.slice(LS_PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
  return out;
}

export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
