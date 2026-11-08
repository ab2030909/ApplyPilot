import { emptyProfile, ProfileSchema, STORAGE_KEYS, type Profile } from '../shared/types';
import { getItem, setItem } from './StorageService';

export const ProfileService = {
  async get(): Promise<Profile> {
    const raw = await getItem<unknown>(STORAGE_KEYS.profile, null);
    const parsed = ProfileSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : emptyProfile();
  },
  async save(profile: Profile): Promise<void> {
    await setItem(STORAGE_KEYS.profile, ProfileSchema.parse(profile));
  },
};

/** Profile completion 0-100 using weighted checks. */
export function profileCompletion(p: Profile): number {
  const checks: [boolean, number][] = [
    [!!p.fullName.trim(), 10],
    [!!p.email.trim(), 10],
    [!!p.phone.trim(), 6],
    [!!(p.location.trim() || p.city.trim()), 5],
    [!!p.country.trim(), 4],
    [!!p.linkedin.trim(), 5],
    [!!(p.github.trim() || p.portfolio.trim() || p.website.trim()), 5],
    [!!p.headline.trim(), 5],
    [p.summary.trim().length > 40, 8],
    [p.skills.length >= 3, 8],
    [!!p.currentTitle.trim(), 4],
    [!!p.yearsOfExperience.trim(), 3],
    [p.education.some((e) => e.university.trim()), 10],
    [p.experience.some((e) => e.company.trim() && e.position.trim()), 12],
    [p.projects.some((e) => e.name.trim()), 5],
  ];
  const total = checks.reduce((a, [, w]) => a + w, 0);
  const got = checks.reduce((a, [ok, w]) => a + (ok ? w : 0), 0);
  return Math.round((got / total) * 100);
}

/** Compact plain-text rendering of the profile; this is what may be sent to AI (only on explicit request). */
export function profileToText(p: Profile): string {
  const lines: string[] = [];
  const add = (k: string, v: string) => v.trim() && lines.push(`${k}: ${v.trim()}`);
  add('Name', p.fullName);
  add('Headline', p.headline);
  add('Location', [p.city, p.location, p.country].filter(Boolean).join(', '));
  add('Current title', p.currentTitle);
  add('Current company', p.currentCompany);
  add('Years of experience', p.yearsOfExperience);
  add('Summary', p.summary);
  if (p.skills.length) add('Skills', p.skills.join(', '));
  for (const e of p.experience)
    lines.push(
      `Experience: ${e.position} at ${e.company} (${e.startDate} - ${e.current ? 'Present' : e.endDate})\n${[e.description, e.achievements && `Achievements: ${e.achievements}`, e.technologies && `Technologies: ${e.technologies}`].filter(Boolean).join('\n')}`,
    );
  for (const e of p.education) lines.push(`Education: ${[e.degree, e.field].filter(Boolean).join(' in ')} - ${e.university} (${e.graduation})${e.gpa ? ` GPA ${e.gpa}` : ''}`);
  for (const pr of p.projects) lines.push(`Project: ${pr.name} - ${pr.description} [${pr.technologies}]`);
  return lines.join('\n');
}

export { splitName } from '../shared/util';
