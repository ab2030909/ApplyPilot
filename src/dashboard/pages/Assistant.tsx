import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Copy, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AIService, buildCandidate, type AnswerLength } from '../../services/AIService';
import { EmptyState, SkeletonLines, useToast } from '../../ui/feedback';
import { useProfile, useResumes, useSettings } from '../../ui/hooks';
import { Button, Card, cn, Field, Input, Segmented, Textarea } from '../../ui/primitives';
import { AIConsentNotice, copyText, PageHeader, ResumeSelect, SectionTitle, useAction, useConsumePendingJob } from '../components/shared';

const PRESETS = ['Why do you want to work here?', 'Why should we hire you?', 'Describe your experience.', 'What makes you a good fit?', 'Tell us about yourself.'];

interface Entry {
  id: number;
  question: string;
  answer: string;
  length: AnswerLength;
}

export function AssistantPage() {
  const [profile] = useProfile();
  const [resumes] = useResumes();
  const [settings] = useSettings();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [length, setLength] = useState<AnswerLength>('medium');
  const [resumeId, setResumeId] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [jd, setJd] = useState('');
  const [showJob, setShowJob] = useState(false);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const { run, loading, error } = useAction();

  useEffect(() => {
    const def = resumes.find((r) => r.isDefault) ?? resumes[0];
    if (def && !resumeId) setResumeId(def.id);
  }, [resumes, resumeId]);

  useConsumePendingJob('assistant', (job) => {
    setCompany(job.company);
    setTitle(job.title);
    setJd(job.description);
    setShowJob(true);
  });

  const generate = async () => {
    const resume = resumes.find((r) => r.id === resumeId) ?? null;
    if (!resume && !profile.fullName && !profile.summary) return toast('error', 'Add profile details or select a resume first.');
    const res = await run(() => AIService.answer({ question, jobDescription: jd || undefined, company: company || undefined, title: title || undefined, length, candidate: buildCandidate(profile, resume) }));
    if (res) {
      setAnswer(res.answer);
      setHistory((h) => [{ id: Date.now(), question, answer: res.answer, length }, ...h].slice(0, 12));
    }
  };

  return (
    <div>
      <PageHeader title="Application Assistant" description="Paste an application question and get an answer grounded in your real background. Always review before pasting it into a form." />
      <AIConsentNotice />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Application question">
            <Textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why do you want to work here?" />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setQuestion(p)} className="rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-mute transition-colors hover:border-accent hover:text-ink">
                {p}
              </button>
            ))}
          </div>

          <div>
            <span className="label-mono mb-1.5 block">Answer length</span>
            <Segmented<AnswerLength> value={length} onChange={setLength} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'detailed', label: 'Detailed' }]} />
          </div>

          <Field label="Use resume">
            <ResumeSelect resumes={resumes} value={resumeId} onChange={setResumeId} />
          </Field>

          <div className="rounded-xl border border-line bg-surface">
            <button onClick={() => setShowJob((s) => !s)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-medium">
              Job context <span className="text-[12px] font-normal text-mute">(optional)</span>
              <ChevronDown size={14} className={cn('ml-auto text-mute transition-transform', showJob && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {showJob && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="space-y-3 border-t border-line p-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Company">
                        <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                      </Field>
                      <Field label="Job title">
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Job description">
                      <Textarea rows={6} value={jd} onChange={(e) => setJd(e.target.value)} />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button variant="accent" className="w-full" icon={answer ? <RefreshCw size={14} /> : <Sparkles size={14} />} loading={loading} disabled={!settings.aiConsent || question.trim().length < 5} onClick={generate}>
            {answer ? 'Regenerate answer' : 'Generate answer'}
          </Button>
        </div>

        <div className="min-w-0 space-y-6">
          {loading ? (
            <Card className="p-6">
              <SkeletonLines lines={6} />
            </Card>
          ) : answer ? (
            <Card className="p-4">
              <Textarea rows={length === 'detailed' ? 12 : length === 'medium' ? 8 : 5} value={answer} onChange={(e) => setAnswer(e.target.value)} className="!border-0 !bg-transparent !px-2 text-[14px] leading-[1.7] focus:!border-0" aria-label="Generated answer" />
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[12px] text-mute">{answer.split(/\s+/).filter(Boolean).length} words · editable</span>
                <Button size="sm" icon={<Copy size={13} />} onClick={async () => ((await copyText(answer)) ? toast('ok', 'Copied to clipboard.') : toast('error', 'Copy failed.'))}>
                  Copy
                </Button>
              </div>
            </Card>
          ) : error ? (
            <EmptyState icon={<Sparkles size={18} />} title="Couldn’t generate the answer" description={error} />
          ) : (
            <EmptyState icon={<MessageSquareText size={18} />} title="Your answer will appear here" description="Type or pick a question, choose a length and generate." />
          )}

          {history.length > 1 && (
            <div>
              <SectionTitle>This session</SectionTitle>
              <div className="space-y-2">
                {history.slice(1).map((h) => (
                  <button key={h.id} onClick={() => { setQuestion(h.question); setAnswer(h.answer); setLength(h.length); }} className="block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-[#d2d2cd]">
                    <div className="truncate text-[13px] font-medium">{h.question}</div>
                    <div className="truncate text-[12.5px] text-mute">{h.answer}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
