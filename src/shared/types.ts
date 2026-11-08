import { z } from 'zod';

// ---------- Profile ----------
export const ExperienceSchema = z.object({
  id: z.string(),
  company: z.string().default(''),
  position: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  current: z.boolean().default(false),
  description: z.string().default(''),
  achievements: z.string().default(''),
  technologies: z.string().default(''),
});
export const EducationSchema = z.object({
  id: z.string(),
  university: z.string().default(''),
  degree: z.string().default(''),
  field: z.string().default(''),
  graduation: z.string().default(''),
  gpa: z.string().default(''),
});
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  description: z.string().default(''),
  technologies: z.string().default(''),
  url: z.string().default(''),
});
export const ProfileSchema = z.object({
  fullName: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  city: z.string().default(''),
  address: z.string().default(''),
  country: z.string().default(''),
  linkedin: z.string().default(''),
  github: z.string().default(''),
  portfolio: z.string().default(''),
  website: z.string().default(''),
  headline: z.string().default(''),
  summary: z.string().default(''),
  skills: z.array(z.string()).default([]),
  yearsOfExperience: z.string().default(''),
  currentTitle: z.string().default(''),
  currentCompany: z.string().default(''),
  education: z.array(EducationSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
});
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

export const emptyProfile = (): Profile => ProfileSchema.parse({});

// ---------- Resumes ----------
export interface ResumeMeta {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isDefault: boolean;
  pages?: number;
  wordCount: number;
  /** Text extracted locally in the browser. */
  text: string;
}

// ---------- Applications ----------
export const APPLICATION_STATUSES = ['Saved', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  company: string;
  title: string;
  url: string;
  location: string;
  appliedDate: string;
  resumeId: string;
  description: string;
  matchScore: number | null;
  status: ApplicationStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ---------- Misc stored data ----------
export interface CoverLetter {
  id: string;
  company: string;
  title: string;
  tone: string;
  content: string;
  createdAt: number;
}

export interface ActivityItem {
  id: string;
  text: string;
  at: number;
}

export interface Settings {
  apiUrl: string;
  aiConsent: boolean;
  defaultTone: string;
  highlightUnmatched: boolean;
  overwriteByDefault: boolean;
  attachResume: boolean;
}
export const defaultSettings: Settings = {
  // Set VITE_API_URL at build time to point a release build at your deployed backend.
  apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/+$/, ''),
  aiConsent: false,
  defaultTone: 'Professional',
  highlightUnmatched: true,
  overwriteByDefault: false,
  attachResume: true,
};

/** Job captured from a browser tab and handed to the dashboard. */
export interface PendingJob {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  capturedAt: number;
  /** Dashboard route that should consume this job; others leave it alone. */
  target?: string;
}

// ---------- Autofill ----------
export type FieldType =
  | 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'address' | 'city' | 'country'
  | 'linkedin' | 'github' | 'portfolio' | 'website' | 'education' | 'university' | 'degree' | 'major'
  | 'graduationYear' | 'skills' | 'experience' | 'yearsExperience' | 'company' | 'jobTitle' | 'coverLetter' | 'summary';

export interface DetectedField {
  /** Stable id assigned to the element (data-applypilot-id). */
  id: string;
  frameId?: number;
  type: FieldType | null;
  confidence: number;
  label: string;
  tag: 'input' | 'textarea' | 'select';
  inputType: string;
  currentValue: string;
  /** Value we would fill from the saved profile. */
  proposedValue: string | null;
}

export interface ScanResult {
  fields: DetectedField[];
  fileInputs: number;
  frameId?: number;
}

export interface FillRequestItem {
  id: string;
  value: string;
  overwrite: boolean;
}
export interface FillResultItem {
  id: string;
  status: 'filled' | 'skipped-existing' | 'failed';
}
export interface UploadResult {
  ok: boolean;
  fileInputs: number;
  attached: number;
  message: string;
}

export const STORAGE_KEYS = {
  profile: 'profile',
  resumes: 'resumes',
  applications: 'applications',
  coverLetters: 'coverLetters',
  activity: 'activity',
  settings: 'settings',
  pendingJob: 'pendingJob',
} as const;
