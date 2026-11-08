// AIService: thin client for the ApplyPilot backend. Only called after an explicit user action,
// and only when the user has given AI consent in Settings.
import { defaultSettings, STORAGE_KEYS, type Profile, type ResumeMeta, type Settings } from '../shared/types';
import { getItem } from './StorageService';
import { profileToText } from './ProfileService';

export class AIError extends Error {
  constructor(message: string, public code: 'consent' | 'network' | 'server' | 'validation' | 'rate' = 'server') {
    super(message);
  }
}

export interface Candidate {
  profileText: string;
  resumeText?: string;
}

export interface JobAnalysis {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experience: string;
  education: string;
  responsibilities: string[];
  keywords: string[];
}

export interface MatchResult {
  overall: number;
  skillsMatch: number;
  experienceCompatibility: number;
  educationCompatibility: number;
  matchingSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  experienceNotes: string;
  educationNotes: string;
  scoring: { weights: { skills: number; experience: number; education: number }; formula: string; disclaimer: string };
}

export interface OptimizerResult {
  summary: string;
  wording: { original: string; suggested: string; reason: string }[];
  missingKeywords: string[];
  achievements: { original: string; suggested: string }[];
  skillsToEmphasize: string[];
  formatting: string[];
}

export interface ExtractedProfile {
  fullName: string; email: string; phone: string; location: string; city: string; country: string;
  linkedin: string; github: string; portfolio: string; website: string;
  headline: string; summary: string; skills: string[]; yearsOfExperience: string; currentTitle: string; currentCompany: string;
  education: { university: string; degree: string; field: string; graduation: string; gpa: string }[];
  experience: { company: string; position: string; startDate: string; endDate: string; current: boolean; description: string; achievements: string; technologies: string }[];
  projects: { name: string; description: string; technologies: string; url: string }[];
}

export type AnswerLength = 'short' | 'medium' | 'detailed';

async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await getItem<Partial<Settings>>(STORAGE_KEYS.settings, {})) };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const settings = await getSettings();
  if (!settings.aiConsent) throw new AIError('AI features are off. Enable AI processing in Settings to allow sending the data for this request to your backend.', 'consent');
  const base = settings.apiUrl.replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new AIError(`Can't reach the ApplyPilot backend at ${base}. Start it with "npm run server" and check the URL in Settings.`, 'network');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error */
  }
  if (!res.ok) {
    const msg = data?.error || `Backend returned ${res.status}`;
    throw new AIError(msg, res.status === 429 ? 'rate' : res.status === 400 ? 'validation' : 'server');
  }
  return data as T;
}

export async function checkBackend(apiUrl: string): Promise<{ ok: boolean; model?: string; configured?: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/health`);
    const data = await res.json();
    return { ok: res.ok, model: data.model, configured: data.groqConfigured };
  } catch {
    return { ok: false, error: 'Unreachable' };
  }
}

/** Build the candidate context that is sent for a single, explicitly requested AI operation. */
export function buildCandidate(profile: Profile, resume?: ResumeMeta | null, includeProfile = true): Candidate {
  return {
    profileText: includeProfile ? profileToText(profile) : '',
    resumeText: resume?.text ? resume.text.slice(0, 30000) : undefined,
  };
}

export const AIService = {
  analyzeJob: (jobDescription: string) => post<JobAnalysis>('/api/analyze-job', { jobDescription }),
  match: (jobDescription: string, candidate: Candidate) => post<MatchResult>('/api/match', { jobDescription, candidate }),
  coverLetter: (p: { jobDescription: string; company: string; title: string; tone: string; candidate: Candidate }) =>
    post<{ coverLetter: string }>('/api/cover-letter', p),
  answer: (p: { question: string; jobDescription?: string; company?: string; title?: string; length: AnswerLength; candidate: Candidate }) =>
    post<{ answer: string }>('/api/answer', p),
  optimize: (jobDescription: string, candidate: Candidate) => post<OptimizerResult>('/api/optimize', { jobDescription, candidate }),
  extractResume: (resumeText: string) => post<ExtractedProfile>('/api/extract-resume', { resumeText }),
};
