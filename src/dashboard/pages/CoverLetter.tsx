import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Download, FileText, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AIService, buildCandidate } from '../../services/AIService';
import { CoverLetterService } from '../../services/ApplicationService';
import { timeAgo } from '../../shared/util';
import { EmptyState, SkeletonLines, useToast } from '../../ui/feedback';
import { useCoverLetters, useProfile, useResumes, useSettings } from '../../ui/hooks';
import { Button, Card, Field, IconButton, Input, Select, Textarea } from '../../ui/primitives';
import { AIConsentNotice, copyText, downloadText, PageHeader, ResumeSelect, SectionTitle, useAction, useConsumePendingJob } from '../components/shared';

const TONES = ['Professional', 'Enthusiastic', 'Confident', 'Friendly', 'Concise', 'Formal'];

export function CoverLetterPage() {
  const [profile] = useProfile();
  const [resumes] = useResumes();
  const [settings] = useSettings();
  const [saved] = useCoverLetters();
  const toast = useToast();
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [jd, setJd] = useState('');
  const [tone, setTone] = useState(settings.defaultTone);
  const [resumeId, setResumeId] = useState('');
  const [letter, setLetter] = useState('');
  const [letterId, setLetterId] = useState<string | undefined>();
  const { run, loading, error } = useAction();

  useEffect(() => {
    const def = resumes.find((r) => r.isDefault) ?? resumes[0];
    if (def && !resumeId) setResumeId(def.id);
  }, [resumes, resumeId]);

  useConsumePendingJob('cover-letter', (job) => {
    setCompany(job.company);
    setTitle(job.title);
    setJd(job.description);
  });

  const generate = async () => {
    const resume = resumes.find((r) => r.id === resumeId) ?? null;
    if (!resume && !profile.fullName && !profile.summary) return toast('error', 'Add profile details or select a resume first.');
    const res = await run(() => AIService.coverLetter({ jobDescription: jd, company, title, tone, candidate: buildCandidate(profile, resume) }));
    if (res) {
      setLetter(res.coverLetter);
      setLetterId(undefined);
    }
  };

  const save = async () => {
    const l = await CoverLetterService.save({ id: letterId, company, title, tone, content: letter });
    setLetterId(l.id);
    toast('ok', 'Cover letter saved.');
  };

  return (
    <div>
      <PageHeader title="Cover Letter" description="Personalized from your real profile and resume. It never invents experience — review before you send." />
      <AIConsentNotice />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </Field>
            <Field label="Job title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend Engineer" />
            </Field>
          </div>
          <Field label="Job description" hint="Recommended — improves relevance.">
            <Textarea rows={9} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tone">
              <Select value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Resume">
              <ResumeSelect resumes={resumes} value={resumeId} onChange={setResumeId} />
            </Field>
          </div>
          <Button variant="accent" className="w-full" icon={letter ? <RefreshCw size={14} /> : <Sparkles size={14} />} loading={loading} disabled={!settings.aiConsent || !title.trim()} onClick={generate}>
            {letter ? 'Regenerate' : 'Generate cover letter'}
          </Button>
          {!title.trim() && <p className="text-[12px] text-mute">Job title is required.</p>}
        </div>

        <div className="min-w-0">
          {loading ? (
            <Card className="p-6">
              <SkeletonLines lines={12} />
            </Card>
          ) : letter ? (
            <Card className="p-4">
              <Textarea rows={20} value={letter} onChange={(e) => setLetter(e.target.value)} className="!border-0 !bg-transparent !px-2 text-[14px] leading-[1.7] focus:!border-0" aria-label="Cover letter" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[12px] text-mute">{letter.split(/\s+/).filter(Boolean).length} words · editable</span>
                <div className="flex gap-2">
                  <Button size="sm" icon={<Copy size={13} />} onClick={async () => ((await copyText(letter)) ? toast('ok', 'Copied to clipboard.') : toast('error', 'Copy failed.'))}>
                    Copy
                  </Button>
                  <Button size="sm" icon={<Download size={13} />} onClick={() => downloadText(`cover-letter-${(company || 'draft').replace(/\W+/g, '-').toLowerCase()}.txt`, letter)}>
                    Download .txt
                  </Button>
                  <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={save}>
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          ) : error ? (
            <EmptyState icon={<Sparkles size={18} />} title="Couldn’t generate the letter" description={error} />
          ) : (
            <EmptyState icon={<FileText size={18} />} title="Your letter will appear here" description="Enter the job details on the left, pick a resume and tone, then generate. You can edit everything afterwards." />
          )}
        </div>
      </div>

      {saved.length > 0 && (
        <div className="mt-10">
          <SectionTitle>Saved letters</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {saved.map((l) => (
                <motion.div key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="flex items-start justify-between gap-3 p-4">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setLetter(l.content);
                        setLetterId(l.id);
                        setCompany(l.company);
                        setTitle(l.title);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div className="truncate text-[14px] font-medium">{l.title || 'Untitled'}{l.company && ` · ${l.company}`}</div>
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] text-mute">{l.content}</div>
                      <div className="mt-1.5 text-[11.5px] text-mute">{l.tone} · {timeAgo(l.createdAt)}</div>
                    </button>
                    <IconButton label="Delete" className="hover:!text-bad" onClick={() => CoverLetterService.remove(l.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
