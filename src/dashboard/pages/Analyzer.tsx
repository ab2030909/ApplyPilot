import { motion } from 'framer-motion';
import { BookmarkPlus, FileSearch, Gauge, PenLine, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AIService, buildCandidate, type JobAnalysis, type MatchResult, type OptimizerResult } from '../../services/AIService';
import { ApplicationService } from '../../services/ApplicationService';
import { JobService } from '../../services/JobService';
import { Chip, Button, Card, Field, Input, Segmented, Textarea } from '../../ui/primitives';
import { EmptyState, ProgressBar, ScoreRing, SkeletonLines, useToast } from '../../ui/feedback';
import { go, useProfile, useResumes, useSettings } from '../../ui/hooks';
import { AIConsentNotice, PageHeader, ResumeSelect, SectionTitle, useAction, useConsumePendingJob } from '../components/shared';

type Tab = 'analysis' | 'match' | 'optimizer';

export function AnalyzerPage() {
  const [profile] = useProfile();
  const [resumes] = useResumes();
  const [settings] = useSettings();
  const toast = useToast();
  const [jd, setJd] = useState('');
  const [url, setUrl] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [tab, setTab] = useState<Tab>('analysis');
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [opt, setOpt] = useState<OptimizerResult | null>(null);
  const [hint, setHint] = useState({ title: '', company: '', location: '' });
  const a1 = useAction();
  const a2 = useAction();
  const a3 = useAction();

  useEffect(() => {
    const def = resumes.find((r) => r.isDefault) ?? resumes[0];
    if (def && !resumeId) setResumeId(def.id);
  }, [resumes, resumeId]);

  useConsumePendingJob('analyzer', (job) => {
    setJd(job.description);
    setUrl(job.url);
    setHint({ title: job.title, company: job.company, location: job.location });
    setAnalysis(null);
    setMatch(null);
    setOpt(null);
    toast('info', 'Job loaded from your browser tab.');
  });

  const resume = resumes.find((r) => r.id === resumeId) ?? null;
  const ready = settings.aiConsent && jd.trim().length >= 40;
  const candidate = () => buildCandidate(profile, resume);
  const noCandidate = !resume && !profile.fullName && !profile.summary && !profile.skills.length;

  const guard = (): boolean => {
    if (noCandidate) {
      toast('error', 'Add profile details or select a resume first.');
      return false;
    }
    return true;
  };

  const analyze = async () => {
    setTab('analysis');
    const r = await a1.run(() => AIService.analyzeJob(jd));
    if (r) setAnalysis(r);
  };
  const doMatch = async () => {
    if (!guard()) return;
    setTab('match');
    const r = await a2.run(() => AIService.match(jd, candidate()));
    if (r) setMatch(r);
  };
  const doOptimize = async () => {
    if (!resume) return toast('error', 'Select a resume to optimize.');
    setTab('optimizer');
    const r = await a3.run(() => AIService.optimize(jd, candidate()));
    if (r) setOpt(r);
  };

  const save = async () => {
    await ApplicationService.add({
      title: analysis?.title || hint.title,
      company: analysis?.company || hint.company,
      location: analysis?.location || hint.location,
      url,
      description: jd,
      resumeId,
      matchScore: match?.overall ?? null,
      status: 'Saved',
    });
    toast('ok', 'Saved to Job Tracker as “Saved”.');
  };

  const toCover = async () => {
    await JobService.setPending({ url, title: analysis?.title || hint.title, company: analysis?.company || hint.company, location: analysis?.location || hint.location, description: jd, target: 'cover-letter' });
    go('cover-letter');
  };

  return (
    <div>
      <PageHeader title="AI Job Analyzer" description="Paste a job description to extract requirements, see how your resume matches, and get suggestions." />
      <AIConsentNotice />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Job description">
            <Textarea rows={14} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job posting here…" />
          </Field>
          <div className="flex justify-between text-[12px] text-mute">
            <span>{jd.length.toLocaleString()} / 20,000</span>
            <span>Treated as untrusted text. Instructions inside it are ignored.</span>
          </div>
          <Field label="Job URL (optional)">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Compare with">
            <ResumeSelect resumes={resumes} value={resumeId} onChange={setResumeId} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="accent" icon={<FileSearch size={14} />} loading={a1.loading} disabled={!ready} onClick={analyze}>
              Analyze
            </Button>
            <Button variant="primary" icon={<Gauge size={14} />} loading={a2.loading} disabled={!ready} onClick={doMatch}>
              Match
            </Button>
            <Button icon={<Wand2 size={14} />} loading={a3.loading} disabled={!ready || !resume} onClick={doOptimize} title={!resume ? 'Select a resume first' : ''}>
              Optimize
            </Button>
          </div>
          {jd.trim().length < 40 && <p className="text-[12px] text-mute">Enter at least 40 characters to begin.</p>}
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: 'analysis', label: 'Analysis' }, { value: 'match', label: 'Match score' }, { value: 'optimizer', label: 'Resume optimizer' }]} />
            <div className="flex gap-2">
              <Button size="sm" icon={<PenLine size={13} />} disabled={jd.trim().length < 40} onClick={toCover}>
                Cover letter
              </Button>
              <Button size="sm" icon={<BookmarkPlus size={13} />} disabled={jd.trim().length < 40} onClick={save}>
                Save to tracker
              </Button>
            </div>
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
            {tab === 'analysis' && <AnalysisView data={analysis} loading={a1.loading} error={a1.error} />}
            {tab === 'match' && <MatchView data={match} loading={a2.loading} error={a2.error} />}
            {tab === 'optimizer' && <OptimizerView data={opt} loading={a3.loading} error={a3.error} />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ResultShell({ loading, error, data, empty, children }: { loading: boolean; error: string | null; data: unknown; empty: ReactNode; children: ReactNode }) {
  if (loading)
    return (
      <Card className="p-5">
        <SkeletonLines lines={8} />
      </Card>
    );
  if (error && !data) return <EmptyState icon={<Sparkles size={18} />} title="Something went wrong" description={error} />;
  if (!data) return <>{empty}</>;
  return <>{children}</>;
}

const List = ({ items, tone }: { items: string[]; tone?: 'ok' | 'bad' | 'neutral' }) =>
  items.length ? (
    <ul className="space-y-1.5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 text-[13.5px]">
          <span className={tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : 'text-accent'}>—</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[13px] text-mute">None found.</p>
  );

function AnalysisView({ data, loading, error }: { data: JobAnalysis | null; loading: boolean; error: string | null }) {
  return (
    <ResultShell loading={loading} error={error} data={data} empty={<EmptyState icon={<FileSearch size={18} />} title="No analysis yet" description="Paste a job description and click Analyze to extract title, skills, requirements and keywords." />}>
      {data && (
        <Card className="space-y-6 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{data.title || 'Untitled role'}</h2>
            <p className="text-[13px] text-mute">{[data.company, data.location, data.employmentType].filter(Boolean).join(' · ') || 'Details not stated'}</p>
          </div>
          <div>
            <SectionTitle>Required skills</SectionTitle>
            <div className="flex flex-wrap gap-1.5">{data.requiredSkills.length ? data.requiredSkills.map((s) => <Chip key={s} tone="accent">{s}</Chip>) : <span className="text-[13px] text-mute">None stated.</span>}</div>
          </div>
          <div>
            <SectionTitle>Preferred skills</SectionTitle>
            <div className="flex flex-wrap gap-1.5">{data.preferredSkills.length ? data.preferredSkills.map((s) => <Chip key={s}>{s}</Chip>) : <span className="text-[13px] text-mute">None stated.</span>}</div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <SectionTitle>Experience</SectionTitle>
              <p className="text-[13.5px]">{data.experience || 'Not stated.'}</p>
            </div>
            <div>
              <SectionTitle>Education</SectionTitle>
              <p className="text-[13.5px]">{data.education || 'Not stated.'}</p>
            </div>
          </div>
          <div>
            <SectionTitle>Responsibilities</SectionTitle>
            <List items={data.responsibilities} />
          </div>
          <div>
            <SectionTitle>Important keywords</SectionTitle>
            <div className="flex flex-wrap gap-1.5">{data.keywords.map((s) => <Chip key={s}>{s}</Chip>)}</div>
          </div>
        </Card>
      )}
    </ResultShell>
  );
}

function Bar({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="font-mono text-[12px]">{value}%</span>
      </div>
      <ProgressBar value={value} />
      {note && <p className="mt-1.5 text-[12.5px] text-mute">{note}</p>}
    </div>
  );
}

function MatchView({ data, loading, error }: { data: MatchResult | null; loading: boolean; error: string | null }) {
  return (
    <ResultShell loading={loading} error={error} data={data} empty={<EmptyState icon={<Gauge size={18} />} title="No match score yet" description="Choose a resume and click Match to compare it with this job." />}>
      {data && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-6 p-5">
            <ScoreRing value={data.overall} label="match" />
            <div className="min-w-56 flex-1 space-y-4">
              <Bar label="Skills" value={data.skillsMatch} note={`${data.matchingSkills.length} matched · ${data.missingSkills.length} missing`} />
              <Bar label="Experience" value={data.experienceCompatibility} note={data.experienceNotes} />
              <Bar label="Education" value={data.educationCompatibility} note={data.educationNotes} />
            </div>
          </Card>
          <Card className="p-4 text-[12.5px] text-mute">
            <span className="label-mono mr-2">How it is scored</span>
            {data.scoring.formula} Skills are verified against your resume/profile text, not just the AI’s claim. {data.scoring.disclaimer}
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>Matching skills</SectionTitle>
              <div className="flex flex-wrap gap-1.5">{data.matchingSkills.length ? data.matchingSkills.map((s) => <Chip key={s} tone="ok">{s}</Chip>) : <span className="text-[13px] text-mute">None verified.</span>}</div>
            </Card>
            <Card className="p-5">
              <SectionTitle>Missing skills</SectionTitle>
              <div className="flex flex-wrap gap-1.5">{data.missingSkills.length ? data.missingSkills.map((s) => <Chip key={s} tone="bad">{s}</Chip>) : <span className="text-[13px] text-mute">No gaps found.</span>}</div>
            </Card>
            <Card className="p-5">
              <SectionTitle>Strengths</SectionTitle>
              <List items={data.strengths} tone="ok" />
            </Card>
            <Card className="p-5">
              <SectionTitle>Weaknesses</SectionTitle>
              <List items={data.weaknesses} tone="bad" />
            </Card>
          </div>
          <Card className="p-5">
            <SectionTitle>Improvement suggestions</SectionTitle>
            <List items={data.suggestions} />
          </Card>
        </div>
      )}
    </ResultShell>
  );
}

function OptimizerView({ data, loading, error }: { data: OptimizerResult | null; loading: boolean; error: string | null }) {
  return (
    <ResultShell loading={loading} error={error} data={data} empty={<EmptyState icon={<Wand2 size={18} />} title="No suggestions yet" description="Select a resume and click Optimize. Suggested edits are shown here; your resume is never changed automatically." />}>
      {data && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Overview</SectionTitle>
            <p className="text-[13.5px]">{data.summary || 'No summary returned.'}</p>
            <p className="mt-2 text-[12px] text-mute">Suggestions only — your original resume is unchanged. Only add keywords you can truthfully back up.</p>
          </Card>
          {data.wording.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Better wording</SectionTitle>
              <div className="space-y-4">
                {data.wording.map((w, i) => (
                  <div key={i} className="text-[13.5px]">
                    <p className="text-mute line-through decoration-[#d0d0cc]">{w.original}</p>
                    <p className="mt-1 font-medium">{w.suggested}</p>
                    {w.reason && <p className="mt-0.5 text-[12.5px] text-mute">{w.reason}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {data.achievements.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Stronger achievement bullets</SectionTitle>
              <div className="space-y-4">
                {data.achievements.map((w, i) => (
                  <div key={i} className="text-[13.5px]">
                    <p className="text-mute">{w.original}</p>
                    <p className="mt-1 font-medium">→ {w.suggested}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>Keywords to consider</SectionTitle>
              <div className="flex flex-wrap gap-1.5">{data.missingKeywords.map((s) => <Chip key={s} tone="accent">{s}</Chip>)}</div>
            </Card>
            <Card className="p-5">
              <SectionTitle>Skills to emphasize</SectionTitle>
              <div className="flex flex-wrap gap-1.5">{data.skillsToEmphasize.map((s) => <Chip key={s} tone="ok">{s}</Chip>)}</div>
            </Card>
          </div>
          <Card className="p-5">
            <SectionTitle>Formatting</SectionTitle>
            <List items={data.formatting} />
          </Card>
        </div>
      )}
    </ResultShell>
  );
}
