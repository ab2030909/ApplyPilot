import { STORAGE_KEYS, type ActivityItem, type Application, type ApplicationStatus, type CoverLetter } from '../shared/types';
import { getItem, setItem, uid } from './StorageService';

export async function logActivity(text: string) {
  const list = await getItem<ActivityItem[]>(STORAGE_KEYS.activity, []);
  await setItem(STORAGE_KEYS.activity, [{ id: uid(), text, at: Date.now() }, ...list].slice(0, 40));
}

export const ApplicationService = {
  list: () => getItem<Application[]>(STORAGE_KEYS.applications, []),

  async add(data: Partial<Application>): Promise<Application> {
    const now = Date.now();
    const app: Application = {
      id: uid(),
      company: '',
      title: '',
      url: '',
      location: '',
      appliedDate: '',
      resumeId: '',
      description: '',
      matchScore: null,
      status: 'Saved',
      notes: '',
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const all = await this.list();
    await setItem(STORAGE_KEYS.applications, [app, ...all]);
    await logActivity(`Saved ${app.title || 'a job'}${app.company ? ` at ${app.company}` : ''}`);
    return app;
  },

  async update(id: string, patch: Partial<Application>) {
    const all = await this.list();
    const prev = all.find((a) => a.id === id);
    if (!prev) return;
    const next: Application = { ...prev, ...patch, updatedAt: Date.now() };
    // Only the user marks something as applied; stamp the date when they do.
    if (patch.status === 'Applied' && !next.appliedDate) next.appliedDate = new Date().toISOString().slice(0, 10);
    await setItem(STORAGE_KEYS.applications, all.map((a) => (a.id === id ? next : a)));
    if (patch.status && patch.status !== prev.status) await logActivity(`${next.title || 'Application'} at ${next.company || 'company'} moved to ${patch.status}`);
  },

  async setStatus(id: string, status: ApplicationStatus) {
    await this.update(id, { status });
  },

  async remove(id: string) {
    const all = await this.list();
    await setItem(STORAGE_KEYS.applications, all.filter((a) => a.id !== id));
  },
};

export const CoverLetterService = {
  list: () => getItem<CoverLetter[]>(STORAGE_KEYS.coverLetters, []),
  async save(data: Omit<CoverLetter, 'id' | 'createdAt'> & { id?: string }): Promise<CoverLetter> {
    const all = await this.list();
    const letter: CoverLetter = { ...data, id: data.id ?? uid(), createdAt: Date.now() };
    await setItem(STORAGE_KEYS.coverLetters, [letter, ...all.filter((l) => l.id !== letter.id)]);
    await logActivity(`Saved cover letter${letter.company ? ` for ${letter.company}` : ''}`);
    return letter;
  },
  async remove(id: string) {
    const all = await this.list();
    await setItem(STORAGE_KEYS.coverLetters, all.filter((l) => l.id !== id));
  },
};
