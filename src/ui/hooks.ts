import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultSettings, emptyProfile, ProfileSchema, STORAGE_KEYS, type ActivityItem, type Application, type CoverLetter, type PendingJob, type Profile, type ResumeMeta, type Settings } from '../shared/types';
import { getItem, setItem, subscribe } from '../services/StorageService';

/** Live view of one storage key, kept in sync across popup / dashboard / background. */
export function useStored<T>(key: string, fallback: T, normalize?: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const fb = useRef(fallback);
  const norm = useRef(normalize);

  const load = useCallback(async () => {
    const raw = await getItem<unknown>(key, null);
    setValue(raw == null ? fb.current : norm.current ? norm.current(raw) : (raw as T));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    load();
    return subscribe(key, load);
  }, [key, load]);

  const save = useCallback(
    async (next: T) => {
      setValue(next);
      await setItem(key, next);
    },
    [key],
  );
  return [value, save, loaded] as const;
}

const profileNormalize = (raw: unknown): Profile => {
  const p = ProfileSchema.safeParse(raw);
  return p.success ? p.data : emptyProfile();
};
const settingsNormalize = (raw: unknown): Settings => ({ ...defaultSettings, ...(raw as Partial<Settings>) });

const EMPTY_PROFILE = emptyProfile();
export const useProfile = () => useStored<Profile>(STORAGE_KEYS.profile, EMPTY_PROFILE, profileNormalize);
export const useSettings = () => useStored<Settings>(STORAGE_KEYS.settings, defaultSettings, settingsNormalize);
export const useResumes = () => useStored<ResumeMeta[]>(STORAGE_KEYS.resumes, []);
export const useApplications = () => useStored<Application[]>(STORAGE_KEYS.applications, []);
export const useCoverLetters = () => useStored<CoverLetter[]>(STORAGE_KEYS.coverLetters, []);
export const useActivity = () => useStored<ActivityItem[]>(STORAGE_KEYS.activity, []);
export const usePendingJob = () => useStored<PendingJob | null>(STORAGE_KEYS.pendingJob, null);

export function useDebounced<T extends unknown[]>(fn: (...a: T) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(fn);
  const pending = useRef<T | null>(null);
  latest.current = fn;
  // Flush a pending call on unmount so the last edit is never lost when navigating away.
  useEffect(
    () => () => {
      clearTimeout(t.current);
      if (pending.current) latest.current(...pending.current);
    },
    [],
  );
  return useCallback(
    (...a: T) => {
      pending.current = a;
      clearTimeout(t.current);
      t.current = setTimeout(() => {
        pending.current = null;
        latest.current(...a);
      }, ms);
    },
    [ms],
  );
}

export function useRoute(): [string, (r: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'overview';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const h = () => setRoute(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return [route, (r) => (window.location.hash = `/${r}`)];
}

export const go = (r: string) => (window.location.hash = `/${r}`);
