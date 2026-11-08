import { STORAGE_KEYS, type ResumeMeta } from '../shared/types';
import { deleteFile, getFile, getItem, putFile, setItem, uid } from './StorageService';

export const ACCEPTED_RESUME_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const mimeFromName = (name: string): string => {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.txt')) return 'text/plain';
  return '';
};

export const ResumeService = {
  async list(): Promise<ResumeMeta[]> {
    return getItem<ResumeMeta[]>(STORAGE_KEYS.resumes, []);
  },
  async getDefault(): Promise<ResumeMeta | undefined> {
    const all = await this.list();
    return all.find((r) => r.isDefault) ?? all[0];
  },
  /** Parses the file locally (no network) and stores meta in chrome.storage and the file in IndexedDB. */
  async add(file: File): Promise<ResumeMeta> {
    const mimeType = file.type || mimeFromName(file.name);
    if (!ACCEPTED_RESUME_TYPES.includes(mimeType)) throw new Error('Unsupported file type. Upload a PDF, DOCX or TXT file.');
    if (file.size > MAX_RESUME_BYTES) throw new Error('File is larger than 10 MB.');
    const { extractText } = await import('./resumeParser');
    const { text, pages } = await extractText(file, mimeType);
    const all = await this.list();
    const meta: ResumeMeta = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      mimeType,
      size: file.size,
      createdAt: Date.now(),
      isDefault: all.length === 0,
      pages,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      text,
    };
    await putFile(meta.id, file);
    await setItem(STORAGE_KEYS.resumes, [...all, meta]);
    return meta;
  },
  async rename(id: string, name: string) {
    const all = await this.list();
    await setItem(STORAGE_KEYS.resumes, all.map((r) => (r.id === id ? { ...r, name: name.trim() || r.name } : r)));
  },
  async setDefault(id: string) {
    const all = await this.list();
    await setItem(STORAGE_KEYS.resumes, all.map((r) => ({ ...r, isDefault: r.id === id })));
  },
  async remove(id: string) {
    const all = await this.list();
    const rest = all.filter((r) => r.id !== id);
    if (rest.length && !rest.some((r) => r.isDefault)) rest[0].isDefault = true;
    await deleteFile(id);
    await setItem(STORAGE_KEYS.resumes, rest);
  },
  getBlob: (id: string) => getFile(id),
};
