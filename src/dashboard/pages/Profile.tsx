import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Briefcase, Check, ChevronDown, FolderGit2, GraduationCap, Plus, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ProfileService, profileCompletion } from '../../services/ProfileService';
import { uid } from '../../services/StorageService';
import type { Education, Experience, Profile, Project } from '../../shared/types';
import { EmptyState, ProgressBar, SkeletonLines, Skeleton } from '../../ui/feedback';
import { useDebounced, useProfile } from '../../ui/hooks';
import { Button, Card, cn, Field, IconButton, Input, Segmented, TagInput, Textarea } from '../../ui/primitives';
import { PageHeader } from '../components/shared';

type Tab = 'personal' | 'professional' | 'education' | 'experience' | 'projects';

export function ProfilePage() {
  const [stored, , loaded] = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('personal');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const initialised = useRef(false);

  useEffect(() => {
    if (loaded && !initialised.current) {
      initialised.current = true;
      setDraft(stored);
    }
  }, [loaded, stored]);

  const persist = useDebounced(async (p: Profile) => {
    await ProfileService.save(p);
    setStatus('saved');
  }, 450);

  const update = (patch: Partial<Profile>) => {
    setDraft((d) => {
      const next = { ...(d as Profile), ...patch };
      setStatus('saving');
      persist(next);
      return next;
    });
  };

  if (!draft) {
    return (
      <div>
        <PageHeader title="My Profile" />
        <Skeleton className="mb-6 h-8 w-80" />
        <SkeletonLines lines={8} />
      </div>
    );
  }

  const completion = profileCompletion(draft);
  const set = (k: keyof Profile) => (e: { target: { value: string } }) => update({ [k]: e.target.value } as Partial<Profile>);

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="This is the source of truth for autofill and AI answers. It is stored only in this browser."
        actions={
          <div className="flex items-center gap-2 text-[12.5px] text-mute">
            {status === 'saving' && <span>Saving…</span>}
            {status === 'saved' && (
              <span className="flex items-center gap-1 text-ok">
                <Check size={13} /> Saved
              </span>
            )}
          </div>
        }
      />

      <Card className="mb-6 flex items-center gap-6 p-4">
        <div className="w-28">
          <div className="label-mono">Completion</div>
          <div className="text-2xl font-semibold tracking-tight">{completion}%</div>
        </div>
        <ProgressBar value={completion} className="flex-1" />
      </Card>

      <div className="mb-5 overflow-x-auto">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'personal', label: 'Personal', icon: <User size={13} /> },
            { value: 'professional', label: 'Professional', icon: <Briefcase size={13} /> },
            { value: 'education', label: 'Education', icon: <GraduationCap size={13} /> },
            { value: 'experience', label: 'Experience', icon: <Briefcase size={13} /> },
            { value: 'projects', label: 'Projects', icon: <FolderGit2 size={13} /> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
          {tab === 'personal' && (
            <Card className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Full name">
                <Input value={draft.fullName} onChange={set('fullName')} placeholder="Ada Lovelace" autoComplete="off" />
              </Field>
              <Field label="Email">
                <Input type="email" value={draft.email} onChange={set('email')} placeholder="ada@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={draft.phone} onChange={set('phone')} placeholder="+1 555 010 1234" />
              </Field>
              <Field label="Location" hint="City, region — shown on applications">
                <Input value={draft.location} onChange={set('location')} placeholder="London, UK" />
              </Field>
              <Field label="City">
                <Input value={draft.city} onChange={set('city')} placeholder="London" />
              </Field>
              <Field label="Country">
                <Input value={draft.country} onChange={set('country')} placeholder="United Kingdom" />
              </Field>
              <Field label="Street address (optional)" className="md:col-span-2">
                <Input value={draft.address} onChange={set('address')} placeholder="12 Analytical Engine Rd" />
              </Field>
              <Field label="LinkedIn">
                <Input value={draft.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/…" />
              </Field>
              <Field label="GitHub">
                <Input value={draft.github} onChange={set('github')} placeholder="https://github.com/…" />
              </Field>
              <Field label="Portfolio">
                <Input value={draft.portfolio} onChange={set('portfolio')} placeholder="https://…" />
              </Field>
              <Field label="Website">
                <Input value={draft.website} onChange={set('website')} placeholder="https://…" />
              </Field>
            </Card>
          )}

          {tab === 'professional' && (
            <Card className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Professional headline" className="md:col-span-2">
                <Input value={draft.headline} onChange={set('headline')} placeholder="Full-stack engineer focused on developer tools" />
              </Field>
              <Field label="Summary" className="md:col-span-2" hint="2–4 sentences. Used for “about you” fields and AI context.">
                <Textarea rows={5} value={draft.summary} onChange={set('summary')} />
              </Field>
              <Field label="Skills" className="md:col-span-2" hint="Press Enter or comma to add.">
                <TagInput value={draft.skills} onChange={(skills) => update({ skills })} placeholder="TypeScript, React, Node.js…" />
              </Field>
              <Field label="Years of experience">
                <Input value={draft.yearsOfExperience} onChange={set('yearsOfExperience')} placeholder="5" inputMode="numeric" />
              </Field>
              <span />
              <Field label="Current job title">
                <Input value={draft.currentTitle} onChange={set('currentTitle')} placeholder="Senior Software Engineer" />
              </Field>
              <Field label="Current company">
                <Input value={draft.currentCompany} onChange={set('currentCompany')} placeholder="Analytical Engines Ltd" />
              </Field>
            </Card>
          )}

          {tab === 'education' && (
            <EntryList<Education>
              items={draft.education}
              onChange={(education) => update({ education })}
              create={() => ({ id: uid(), university: '', degree: '', field: '', graduation: '', gpa: '' })}
              summary={(e) => [e.degree, e.university].filter(Boolean).join(' · ') || 'New education'}
              icon={<GraduationCap size={18} />}
              emptyTitle="No education yet"
              emptyText="Add your degrees so forms can be filled with your university, degree and graduation year."
              addLabel="Add education"
              render={(e, patch) => (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="University" className="md:col-span-2">
                    <Input value={e.university} onChange={(ev) => patch({ university: ev.target.value })} />
                  </Field>
                  <Field label="Degree">
                    <Input value={e.degree} onChange={(ev) => patch({ degree: ev.target.value })} placeholder="Bachelor of Science" />
                  </Field>
                  <Field label="Field of study">
                    <Input value={e.field} onChange={(ev) => patch({ field: ev.target.value })} placeholder="Computer Science" />
                  </Field>
                  <Field label="Graduation date">
                    <Input value={e.graduation} onChange={(ev) => patch({ graduation: ev.target.value })} placeholder="2021 or May 2021" />
                  </Field>
                  <Field label="GPA (optional)">
                    <Input value={e.gpa} onChange={(ev) => patch({ gpa: ev.target.value })} placeholder="3.8" />
                  </Field>
                </div>
              )}
            />
          )}

          {tab === 'experience' && (
            <EntryList<Experience>
              items={draft.experience}
              onChange={(experience) => update({ experience })}
              create={() => ({ id: uid(), company: '', position: '', startDate: '', endDate: '', current: false, description: '', achievements: '', technologies: '' })}
              summary={(e) => [e.position, e.company].filter(Boolean).join(' at ') || 'New experience'}
              icon={<Briefcase size={18} />}
              emptyTitle="No experience yet"
              emptyText="Add your roles. The AI only ever uses what you write here and in your resume."
              addLabel="Add experience"
              render={(e, patch) => (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Company">
                    <Input value={e.company} onChange={(ev) => patch({ company: ev.target.value })} />
                  </Field>
                  <Field label="Position">
                    <Input value={e.position} onChange={(ev) => patch({ position: ev.target.value })} />
                  </Field>
                  <Field label="Start date">
                    <Input value={e.startDate} onChange={(ev) => patch({ startDate: ev.target.value })} placeholder="Jan 2021" />
                  </Field>
                  <Field label="End date">
                    <Input value={e.current ? 'Present' : e.endDate} disabled={e.current} onChange={(ev) => patch({ endDate: ev.target.value })} placeholder="Dec 2023" />
                  </Field>
                  <label className="flex items-center gap-2 text-[13px] md:col-span-2">
                    <input type="checkbox" checked={e.current} onChange={(ev) => patch({ current: ev.target.checked })} className="accent-[#FF6B35]" />I currently work here
                  </label>
                  <Field label="Description" className="md:col-span-2">
                    <Textarea rows={3} value={e.description} onChange={(ev) => patch({ description: ev.target.value })} />
                  </Field>
                  <Field label="Achievements" className="md:col-span-2" hint="One per line.">
                    <Textarea rows={3} value={e.achievements} onChange={(ev) => patch({ achievements: ev.target.value })} />
                  </Field>
                  <Field label="Technologies" className="md:col-span-2">
                    <Input value={e.technologies} onChange={(ev) => patch({ technologies: ev.target.value })} placeholder="React, Postgres, AWS" />
                  </Field>
                </div>
              )}
            />
          )}

          {tab === 'projects' && (
            <EntryList<Project>
              items={draft.projects}
              onChange={(projects) => update({ projects })}
              create={() => ({ id: uid(), name: '', description: '', technologies: '', url: '' })}
              summary={(p) => p.name || 'New project'}
              icon={<FolderGit2 size={18} />}
              emptyTitle="No projects yet"
              emptyText="Showcase side projects, open source work or case studies."
              addLabel="Add project"
              render={(p, patch) => (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Project name">
                    <Input value={p.name} onChange={(ev) => patch({ name: ev.target.value })} />
                  </Field>
                  <Field label="Project URL">
                    <Input value={p.url} onChange={(ev) => patch({ url: ev.target.value })} placeholder="https://…" />
                  </Field>
                  <Field label="Description" className="md:col-span-2">
                    <Textarea rows={3} value={p.description} onChange={(ev) => patch({ description: ev.target.value })} />
                  </Field>
                  <Field label="Technologies" className="md:col-span-2">
                    <Input value={p.technologies} onChange={(ev) => patch({ technologies: ev.target.value })} />
                  </Field>
                </div>
              )}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EntryList<T extends { id: string }>({
  items,
  onChange,
  create,
  summary,
  render,
  icon,
  emptyTitle,
  emptyText,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  summary: (item: T) => string;
  render: (item: T, patch: (p: Partial<T>) => void) => ReactNode;
  icon: ReactNode;
  emptyTitle: string;
  emptyText: string;
  addLabel: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const add = () => {
    const item = create();
    onChange([...items, item]);
    setOpen((s) => new Set(s).add(item.id));
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {!items.length && <EmptyState icon={icon} title={emptyTitle} description={emptyText} action={<Button variant="primary" icon={<Plus size={14} />} onClick={add}>{addLabel}</Button>} />}
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const isOpen = open.has(item.id);
          return (
            <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16 }}>
              <Card className="overflow-hidden">
                <div className="flex items-center gap-1 pr-2">
                  <button onClick={() => toggle(item.id)} className="flex flex-1 items-center gap-3 px-4 py-3 text-left" aria-expanded={isOpen}>
                    <span className="font-mono text-[11px] text-mute">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 truncate text-[14px] font-medium">{summary(item)}</span>
                    <ChevronDown size={15} className={cn('text-mute transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label="Delete" onClick={() => onChange(items.filter((x) => x.id !== item.id))} className="hover:!text-bad">
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="border-t border-line p-4">{render(item, (p) => onChange(items.map((x) => (x.id === item.id ? { ...x, ...p } : x))))}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {items.length > 0 && (
        <Button icon={<Plus size={14} />} onClick={add}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}
