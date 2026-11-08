import { STORAGE_KEYS, type PendingJob } from '../shared/types';
import { getItem, removeItem, setItem } from './StorageService';

/** Job text comes from arbitrary web pages: strip control characters/markup and cap its size. */
export function sanitizeJobText(input: string, max = 15000): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const JobService = {
  async setPending(job: Omit<PendingJob, 'capturedAt'>) {
    await setItem(STORAGE_KEYS.pendingJob, {
      ...job,
      title: sanitizeJobText(job.title, 200),
      company: sanitizeJobText(job.company, 200),
      location: sanitizeJobText(job.location, 200),
      description: sanitizeJobText(job.description),
      capturedAt: Date.now(),
    } satisfies PendingJob);
  },
  getPending: () => getItem<PendingJob | null>(STORAGE_KEYS.pendingJob, null),
  clearPending: () => removeItem(STORAGE_KEYS.pendingJob),
};

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
