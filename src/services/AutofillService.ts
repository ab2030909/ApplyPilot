import type { DetectedField, FieldType, FillRequestItem, FillResultItem, Profile, ScanResult, UploadResult } from '../shared/types';
import { splitName } from '../shared/util';
import type { PageInfo } from './FieldDetectionService';

/** Map a detected field type to the value stored in the user's profile. Pure function, bundled in the content script too. */
export function resolveValue(type: FieldType, p: Profile, coverLetter = ''): string | null {
  const { first, last } = splitName(p.fullName);
  const edu = p.education.find((e) => e.university.trim()) ?? p.education[0];
  const exp = p.experience[0];
  const year = (edu?.graduation.match(/(19|20)\d{2}/) ?? [''])[0];
  const v: Record<FieldType, string> = {
    firstName: first,
    lastName: last,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    address: p.address || p.location,
    city: p.city || p.location.split(',')[0] || '',
    country: p.country,
    linkedin: p.linkedin,
    github: p.github,
    portfolio: p.portfolio || p.website,
    website: p.website || p.portfolio,
    university: edu?.university ?? '',
    degree: edu?.degree ?? '',
    major: edu?.field ?? '',
    graduationYear: year,
    education: edu ? [edu.degree, edu.field, edu.university].filter(Boolean).join(', ') : '',
    skills: p.skills.join(', '),
    yearsExperience: p.yearsOfExperience,
    experience: p.experience
      .map((e) => `${e.position} at ${e.company} (${e.startDate}${e.startDate || e.endDate ? ' - ' : ''}${e.current ? 'Present' : e.endDate})${e.description ? `: ${e.description}` : ''}`)
      .join('\n'),
    company: p.currentCompany || exp?.company || '',
    jobTitle: p.currentTitle || exp?.position || '',
    coverLetter,
    summary: p.summary,
  };
  const out = (v[type] ?? '').trim();
  return out || null;
}

// ---------------------------------------------------------------- tab orchestration (popup side)
type AP = {
  scan(p: Profile, letter: string): ScanResult;
  fill(items: FillRequestItem[]): FillResultItem[];
  highlight(ids: string[], kind: 'unmatched' | 'filled' | null): void;
  clear(): void;
  upload(b64: string, name: string, type: string): UploadResult;
  pageInfo(): PageInfo;
};
declare global {
  interface Window {
    __applypilot?: AP;
  }
}

async function ensureInjected(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
}

async function callAll<T>(tabId: number, func: (...a: any[]) => T, args: unknown[]) {
  const res = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args });
  return res.filter((r) => r.result != null).map((r) => ({ frameId: r.frameId, result: r.result as T }));
}

export const AutofillService = {
  async scan(tabId: number, profile: Profile, coverLetter: string): Promise<ScanResult> {
    await ensureInjected(tabId);
    const frames = await callAll<ScanResult | null>(
      tabId,
      (p: Profile, c: string) => window.__applypilot?.scan(p, c) ?? null,
      [profile, coverLetter],
    );
    const fields: DetectedField[] = [];
    let fileInputs = 0;
    for (const f of frames) {
      if (!f.result) continue;
      fileInputs += f.result.fileInputs;
      for (const fld of f.result.fields) fields.push({ ...fld, frameId: f.frameId });
    }
    return { fields, fileInputs };
  },

  async fill(tabId: number, items: (FillRequestItem & { frameId?: number })[]): Promise<FillResultItem[]> {
    const byFrame = new Map<number, FillRequestItem[]>();
    for (const it of items) {
      const fid = it.frameId ?? 0;
      byFrame.set(fid, [...(byFrame.get(fid) ?? []), { id: it.id, value: it.value, overwrite: it.overwrite }]);
    }
    const results: FillResultItem[] = [];
    for (const [frameId, list] of byFrame) {
      const res = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: (l: FillRequestItem[]) => window.__applypilot?.fill(l) ?? [],
        args: [list],
      });
      results.push(...((res[0]?.result as FillResultItem[] | undefined) ?? []));
    }
    return results;
  },

  async highlight(tabId: number, targets: { id: string; frameId?: number }[], kind: 'unmatched' | 'filled' | null) {
    const byFrame = new Map<number, string[]>();
    for (const t of targets) byFrame.set(t.frameId ?? 0, [...(byFrame.get(t.frameId ?? 0) ?? []), t.id]);
    for (const [frameId, ids] of byFrame) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: (i: string[], k: 'unmatched' | 'filled' | null) => window.__applypilot?.highlight(i, k),
        args: [ids, kind],
      });
    }
  },

  async clear(tabId: number) {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: () => window.__applypilot?.clear() });
  },

  /** Try each frame until a file input accepts the resume. */
  async upload(tabId: number, b64: string, name: string, type: string): Promise<UploadResult> {
    const frames = await callAll<UploadResult | null>(tabId, (b: string, n: string, t: string) => window.__applypilot?.upload(b, n, t) ?? null, [b64, name, type]);
    const ok = frames.find((f) => f.result?.ok);
    if (ok?.result) return ok.result;
    const withInputs = frames.find((f) => f.result && f.result.fileInputs > 0);
    return withInputs?.result ?? { ok: false, fileInputs: 0, attached: 0, message: 'No file upload field found on this page.' };
  },

  async pageInfo(tabId: number): Promise<PageInfo | null> {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const res = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__applypilot?.pageInfo() ?? null });
    return (res[0]?.result as PageInfo | null) ?? null;
  },
};
