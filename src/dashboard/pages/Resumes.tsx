import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Sparkles, Star, Trash2, Upload, Eye, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AIService, type ExtractedProfile } from '../../services/AIService';
import { ProfileService } from '../../services/ProfileService';
import { ResumeService } from '../../services/ResumeService';
import { logActivity } from '../../services/ApplicationService';
import { uid } from '../../services/StorageService';
import { formatBytes, timeAgo } from '../../shared/util';
import type { Profile, ResumeMeta } from '../../shared/types';
import { ConfirmModal, EmptyState, Modal, Skeleton, useToast } from '../../ui/feedback';
import { useResumes, useSettings } from '../../ui/hooks';
import { Button, Card, Chip, cn, IconButton, Input, Segmented } from '../../ui/primitives';
import { AIConsentNotice, PageHeader, useAction } from '../components/shared';

export function ResumesPage() {
  const [resumes, , loaded] = useResumes();
  const toast = useToast();
  const [settings] = useSettings();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<ResumeMeta | null>(null);
  const [toDelete, setToDelete] = useState<ResumeMeta | null>(null);
  const [review, setReview] = useState<{ resume: ResumeMeta; data: ExtractedProfile } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ai = useAction();

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        await ResumeService.add(f);
        await logActivity(`Uploaded resume ${f.name}`);
        toast('ok', `${f.name} added and parsed locally.`);
      } catch (e) {
        toast('error', `${f.name}: ${e instanceof Error ? e.message : 'could not read file'}`);
      }
    }
    setBusy(false);
  };

  const extract = async (r: ResumeMeta) => {
    const data = await ai.run(() => AIService.extractResume(r.text));
    if (data) setReview({ resume: r, data });
  };

  return (
    <div>
      <PageHeader
        title="Resumes"
        description="Upload PDF or DOCX files. Text is extracted on your device; nothing is uploaded anywhere."
        actions={
          <Button variant="primary" icon={<Upload size={14} />} loading={busy} onClick={() => input.current?.click()}>
            Upload resume
          </Button>
        }
      />
      <input ref={input} type="file" hidden multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ''))} />
      <AIConsentNotice />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={cn('mb-6 rounded-xl border border-dashed px-6 py-7 text-center transition-colors', drag ? 'border-accent bg-accent-soft' : 'border-[#333]')}
      >
        <p className="text-[13.5px]">
          Drop resumes here or <button className="font-medium underline decoration-accent decoration-2 underline-offset-2" onClick={() => input.current?.click()}>browse</button>
        </p>
        <p className="mt-1 text-[12px] text-mute">PDF, DOCX or TXT · up to 10 MB each</p>
      </div>

      {!loaded ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !resumes.length ? (
        <EmptyState icon={<FileText size={18} />} title="No resumes yet" description="Upload your resume to attach it on applications and give the AI real context about you." />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {resumes.map((r) => (
              <motion.div key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
                <Card className="flex flex-wrap items-center gap-4 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-paper font-mono text-[11px] text-mute">{r.fileName.split('.').pop()?.toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {renaming === r.id ? (
                        <Input
                          autoFocus
                          defaultValue={r.name}
                          className="h-7 max-w-64"
                          onBlur={(e) => {
                            ResumeService.rename(r.id, e.target.value);
                            setRenaming(null);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <div className="truncate text-[14px] font-medium">{r.name}</div>
                      )}
                      {r.isDefault && <Chip tone="accent">Default</Chip>}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-mute">
                      {r.fileName} · {formatBytes(r.size)}
                      {r.pages ? ` · ${r.pages} page${r.pages > 1 ? 's' : ''}` : ''} · {r.wordCount.toLocaleString()} words · {timeAgo(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" icon={<Sparkles size={13} />} loading={ai.loading} disabled={!settings.aiConsent} title={settings.aiConsent ? 'Extract structured info with AI' : 'Enable AI processing first'} onClick={() => extract(r)}>
                      Extract profile
                    </Button>
                    <IconButton label="Preview" onClick={() => setPreview(r)}>
                      <Eye size={15} />
                    </IconButton>
                    <IconButton label="Rename" onClick={() => setRenaming(r.id)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={r.isDefault ? 'Default resume' : 'Make default'} onClick={() => ResumeService.setDefault(r.id)} className={cn(r.isDefault && '!text-accent')}>
                      <Star size={15} fill={r.isDefault ? 'currentColor' : 'none'} />
                    </IconButton>
                    <IconButton label="Delete" onClick={() => setToDelete(r)} className="hover:!text-bad">
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <PreviewModal resume={preview} onClose={() => setPreview(null)} />
      <ConfirmModal open={!!toDelete} title="Delete resume?" message={`“${toDelete?.name}” will be removed from this browser. This cannot be undone.`} onConfirm={() => toDelete && ResumeService.remove(toDelete.id)} onClose={() => setToDelete(null)} />
      {review && <ImportReview resume={review.resume} data={review.data} onClose={() => setReview(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- preview
function PreviewModal({ resume, onClose }: { resume: ResumeMeta | null; onClose: () => void }) {
  const [view, setView] = useState<'document' | 'text'>('document');
  const [pdfError, setPdfError] = useState(false);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const isPdf = resume?.mimeType === 'application/pdf';

  useEffect(() => {
    setView(isPdf ? 'document' : 'text');
    setPdfError(false);
  }, [resume?.id, isPdf]);

  useEffect(() => {
    if (!resume || !isPdf || view !== 'document') return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await ResumeService.getBlob(resume.id);
        if (!blob) throw new Error('missing');
        const { renderPdfPages } = await import('../../services/resumeParser');
        await new Promise((r) => setTimeout(r, 60)); // wait for canvases to mount
        if (!cancelled) await renderPdfPages(blob, (i) => canvases.current[i], 3);
      } catch {
        if (!cancelled) setPdfError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resume, isPdf, view]);

  return (
    <Modal open={!!resume} onClose={onClose} title={resume?.name ?? 'Preview'} width="max-w-3xl">
      {resume && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            {isPdf ? (
              <Segmented value={view} onChange={setView} options={[{ value: 'document', label: 'Document' }, { value: 'text', label: 'Extracted text' }]} />
            ) : (
              <span className="label-mono">Extracted text</span>
            )}
            <span className="text-[12px] text-mute">{resume.wordCount} words</span>
          </div>
          {view === 'document' && isPdf ? (
            pdfError ? (
              <p className="text-[13px] text-mute">Could not render the PDF preview. Showing text instead is available in the “Extracted text” tab.</p>
            ) : (
              <div className="space-y-3">
                {[0, 1, 2].slice(0, Math.min(3, resume.pages ?? 1)).map((i) => (
                  <canvas key={i} ref={(el) => void (canvases.current[i] = el)} className="w-full rounded-lg border border-line bg-white" />
                ))}
                {(resume.pages ?? 1) > 3 && <p className="text-center text-[12px] text-mute">Showing first 3 of {resume.pages} pages</p>}
              </div>
            )
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 font-mono text-[12px] leading-relaxed">{resume.text}</pre>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- reviewed import (never silently replaces profile data)
type ScalarKey = 'fullName' | 'email' | 'phone' | 'location' | 'city' | 'country' | 'linkedin' | 'github' | 'portfolio' | 'website' | 'headline' | 'summary' | 'yearsOfExperience' | 'currentTitle' | 'currentCompany';
const SCALARS: [ScalarKey, string][] = [
  ['fullName', 'Full name'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'], ['city', 'City'], ['country', 'Country'],
  ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['portfolio', 'Portfolio'], ['website', 'Website'], ['headline', 'Headline'], ['summary', 'Summary'],
  ['yearsOfExperience', 'Years of experience'], ['currentTitle', 'Current title'], ['currentCompany', 'Current company'],
];

function ImportReview({ resume, data, onClose }: { resume: ResumeMeta; data: ExtractedProfile; onClose: () => void }) {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    ProfileService.get().then((p) => {
      setProfile(p);
      const s = new Set<string>();
      SCALARS.forEach(([k]) => data[k] && !p[k].trim() && s.add(k));
      // Additive items never overwrite anything, so they start selected.
      const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      if (data.skills.some((x) => !p.skills.some((y) => same(x, y)))) s.add('skills');
      data.experience
        .filter((e) => (e.company || e.position) && !p.experience.some((x) => same(x.company, e.company) && same(x.position, e.position)))
        .forEach((_, i) => s.add(`exp${i}`));
      data.education
        .filter((e) => e.university && !p.education.some((x) => same(x.university, e.university) && same(x.degree, e.degree)))
        .forEach((e, i) => !p.education.some((x) => same(x.university, e.university)) && s.add(`edu${i}`));
      data.projects.filter((x) => x.name && !p.projects.some((y) => same(y.name, x.name))).forEach((_, i) => s.add(`proj${i}`));
      setPicked(s);
    });
  }, [data]);

  if (!profile) return null;
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const newSkills = data.skills.filter((s) => !profile.skills.some((x) => eq(x, s)));
  const newExp = data.experience.filter((e) => (e.company || e.position) && !profile.experience.some((x) => eq(x.company, e.company) && eq(x.position, e.position)));
  const newEdu = data.education.filter((e) => e.university && !profile.education.some((x) => eq(x.university, e.university) && eq(x.degree, e.degree)));
  const newProj = data.projects.filter((p) => p.name && !profile.projects.some((x) => eq(x.name, p.name)));
  const changed = SCALARS.filter(([k]) => data[k] && data[k].trim() !== profile[k].trim());

  const toggle = (k: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const apply = async () => {
    const next: Profile = { ...profile };
    for (const [k] of SCALARS) if (picked.has(k)) next[k] = data[k];
    if (picked.has('skills')) next.skills = [...profile.skills, ...newSkills];
    next.experience = [...profile.experience, ...newExp.filter((_, i) => picked.has(`exp${i}`)).map((e) => ({ ...e, id: uid() }))];
    next.education = [...profile.education, ...newEdu.filter((_, i) => picked.has(`edu${i}`)).map((e) => ({ ...e, id: uid() }))];
    next.projects = [...profile.projects, ...newProj.filter((_, i) => picked.has(`proj${i}`)).map((e) => ({ ...e, id: uid() }))];
    await ProfileService.save(next);
    await logActivity(`Imported ${picked.size} item(s) from ${resume.name} into profile`);
    toast('ok', 'Selected items imported into your profile.');
    onClose();
  };

  const Row = ({ id, title, sub, current }: { id: string; title: string; sub?: string; current?: string }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 hover:border-[#d2d2cd]">
      <input type="checkbox" checked={picked.has(id)} onChange={() => toggle(id)} className="mt-1 accent-[#FF6B35]" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{title}</div>
        {sub && <div className="mt-0.5 line-clamp-3 text-[12.5px] text-mute">{sub}</div>}
        {current && <div className="mt-1 text-[12px] text-bad">Currently: {current}</div>}
      </div>
    </label>
  );

  const nothing = !changed.length && !newSkills.length && !newExp.length && !newEdu.length && !newProj.length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Review extracted information"
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={!picked.size} onClick={apply}>
            Import {picked.size} selected
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-mute">
        From “{resume.name}”. Nothing changes until you import. Fields that would overwrite existing data are unchecked by default.
      </p>
      {nothing && <p className="text-[13px]">Everything in this resume already matches your profile.</p>}
      <div className="space-y-2">
        {changed.map(([k, label]) => (
          <Row key={k} id={k} title={label} sub={data[k]} current={profile[k].trim() ? profile[k] : undefined} />
        ))}
        {newSkills.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3">
            <input type="checkbox" checked={picked.has('skills')} onChange={() => toggle('skills')} className="mt-1 accent-[#FF6B35]" />
            <div>
              <div className="mb-1.5 text-[13px] font-medium">Add {newSkills.length} skills</div>
              <div className="flex flex-wrap gap-1.5">{newSkills.map((s) => <Chip key={s}>{s}</Chip>)}</div>
            </div>
          </label>
        )}
        {newExp.map((e, i) => <Row key={`exp${i}`} id={`exp${i}`} title={`Add experience: ${e.position} at ${e.company}`} sub={`${e.startDate} – ${e.current ? 'Present' : e.endDate}. ${e.description}`} />)}
        {newEdu.map((e, i) => <Row key={`edu${i}`} id={`edu${i}`} title={`Add education: ${[e.degree, e.field].filter(Boolean).join(' in ')} — ${e.university}`} sub={e.graduation} />)}
        {newProj.map((p, i) => <Row key={`proj${i}`} id={`proj${i}`} title={`Add project: ${p.name}`} sub={p.description} />)}
      </div>
    </Modal>
  );
}
