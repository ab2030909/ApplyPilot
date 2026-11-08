import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookmarkPlus, Check, ChevronDown, ExternalLink, FileText, Paperclip, ScanSearch, Settings as SettingsIcon, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApplicationService, CoverLetterService, logActivity } from '../services/ApplicationService';
import { AutofillService } from '../services/AutofillService';
import { JobService, hostOf } from '../services/JobService';
import { profileCompletion } from '../services/ProfileService';
import { ResumeService } from '../services/ResumeService';
import { blobToBase64 } from '../services/StorageService';
import type { DetectedField, FieldType, FillResultItem, UploadResult } from '../shared/types';
import { CountUp, ProgressBar, Skeleton } from '../ui/feedback';
import { useProfile, useResumes, useSettings } from '../ui/hooks';
import { Button, cn, IconButton, Logo, Select, Toggle } from '../ui/primitives';

const TYPE_LABEL: Record<FieldType, string> = {
  firstName: 'First name', lastName: 'Last name', fullName: 'Full name', email: 'Email', phone: 'Phone', address: 'Address', city: 'City', country: 'Country',
  linkedin: 'LinkedIn', github: 'GitHub', portfolio: 'Portfolio', website: 'Website', education: 'Education', university: 'University', degree: 'Degree', major: 'Major',
  graduationYear: 'Graduation year', skills: 'Skills', experience: 'Experience', yearsExperience: 'Years of exp.', company: 'Current company', jobTitle: 'Job title',
  coverLetter: 'Cover letter', summary: 'Summary',
};

type Phase = 'home' | 'preview' | 'done';
type ScanState = { status: 'loading' } | { status: 'unsupported'; reason: string } | { status: 'ready'; fields: DetectedField[]; fileInputs: number };

async function openDashboard(route: string) {
  const url = chrome.runtime.getURL(`index.html#/${route}`);
  const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('index.html') + '*' });
  if (existing[0]?.id) {
    await chrome.tabs.update(existing[0].id, { url, active: true });
    if (existing[0].windowId) await chrome.windows.update(existing[0].windowId, { focused: true });
  } else await chrome.tabs.create({ url });
  window.close();
}

const fillable = (f: DetectedField) => f.type !== null && !!f.proposedValue;

export function Popup() {
  const [profile, , pLoaded] = useProfile();
  const [settings, saveSettings] = useSettings();
  const [resumes] = useResumes();
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [scan, setScan] = useState<ScanState>({ status: 'loading' });
  const [phase, setPhase] = useState<Phase>('home');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState<{ filled: number; skipped: number; failed: number; unmatched: string[]; upload: UploadResult | null } | null>(null);

  const completion = profileCompletion(profile);
  const resume = resumes.find((r) => r.isDefault) ?? resumes[0];
  const host = tab?.url ? hostOf(tab.url) : '';
  const key = (f: DetectedField) => `${f.frameId ?? 0}:${f.id}`;

  const runScan = useCallback(async (t: chrome.tabs.Tab) => {
    if (!t.id || !t.url || !/^https?:/.test(t.url)) return setScan({ status: 'unsupported', reason: 'ApplyPilot can’t run on this page. Open a job application page.' });
    setScan({ status: 'loading' });
    try {
      const letters = await CoverLetterService.list();
      const r = await AutofillService.scan(t.id, profile, letters[0]?.content ?? '');
      setScan({ status: 'ready', fields: r.fields, fileInputs: r.fileInputs });
    } catch {
      setScan({ status: 'unsupported', reason: 'Chrome blocked access to this page (browser pages, the Web Store and some PDFs are restricted).' });
    }
  }, [profile]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => t && setTab(t));
  }, []);
  useEffect(() => {
    if (tab && pLoaded) runScan(tab);
    // scan once after the tab and profile have loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab?.id, pLoaded]);

  const detected = scan.status === 'ready' ? scan.fields.filter((f) => f.type !== null) : [];
  const unmatched = scan.status === 'ready' ? scan.fields.filter((f) => f.type === null) : [];
  const usable = detected.filter(fillable);

  const startPreview = () => {
    const sel = new Set<string>();
    usable.forEach((f) => (!f.currentValue.trim() || settings.overwriteByDefault) && sel.add(key(f)));
    setPicked(sel);
    setPhase('preview');
  };

  const fill = async () => {
    if (!tab?.id || scan.status !== 'ready') return;
    setBusy('fill');
    try {
      const chosen = usable.filter((f) => picked.has(key(f)));
      const items = chosen.map((f) => ({ id: f.id, frameId: f.frameId, value: f.proposedValue!, overwrite: !!f.currentValue.trim() }));
      const res: FillResultItem[] = await AutofillService.fill(tab.id, items);
      const filled = res.filter((r) => r.status === 'filled').length;
      const failed = res.filter((r) => r.status === 'failed');
      const skipped = res.filter((r) => r.status === 'skipped-existing').length;

      let upload: UploadResult | null = null;
      if (settings.attachResume && resume && scan.fileInputs > 0) {
        const blob = await ResumeService.getBlob(resume.id);
        if (blob) upload = await AutofillService.upload(tab.id, await blobToBase64(blob), resume.fileName, resume.mimeType);
      }

      // Highlight what still needs the user's attention (never submits anything).
      await AutofillService.clear(tab.id);
      const textLike = (f: DetectedField) => f.tag === 'textarea' || ['text', 'email', 'tel', 'url', 'number', 'select'].includes(f.inputType) || f.tag === 'select';
      const needAttention = [
        ...unmatched.filter((f) => textLike(f) && !f.currentValue.trim()),
        ...chosen.filter((f) => failed.some((x) => x.id === f.id)),
      ];
      if (settings.highlightUnmatched) await AutofillService.highlight(tab.id, needAttention.map((f) => ({ id: f.id, frameId: f.frameId })), 'unmatched');

      await logActivity(`Autofilled ${filled} field${filled === 1 ? '' : 's'} on ${host}`);
      setResult({ filled, skipped, failed: failed.length, unmatched: needAttention.map((f) => f.label || 'Unlabeled field').slice(0, 8), upload });
      setPhase('done');
    } catch {
      setNote({ kind: 'error', text: 'Could not fill this page. Reload it and try again.' });
    } finally {
      setBusy(null);
    }
  };

  const withPage = async (name: string, fn: (info: NonNullable<Awaited<ReturnType<typeof AutofillService.pageInfo>>>) => Promise<void>) => {
    if (!tab?.id) return;
    setBusy(name);
    try {
      const info = await AutofillService.pageInfo(tab.id);
      if (!info) throw new Error();
      await fn(info);
    } catch {
      setNote({ kind: 'error', text: 'Couldn’t read this page.' });
    } finally {
      setBusy(null);
    }
  };

  const analyze = () =>
    withPage('analyze', async (info) => {
      await JobService.setPending({ url: info.url, title: info.title, company: info.company, location: info.location, description: info.description, target: 'analyzer' });
      await openDashboard('analyzer');
    });

  const saveJob = () =>
    withPage('save', async (info) => {
      await ApplicationService.add({ title: info.title.slice(0, 200), company: info.company.slice(0, 200), location: info.location, url: info.url, description: info.description, resumeId: resume?.id ?? '', status: 'Saved' });
      setNote({ kind: 'ok', text: 'Saved to your tracker as “Saved”.' });
    });

  const grouped = useMemo(() => usable, [usable]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Logo size={24} />
        <IconButton label="Open settings" onClick={() => openDashboard('settings')}>
          <SettingsIcon size={15} />
        </IconButton>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.12 }} className="space-y-3 p-4">
            {/* current site */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-night font-mono text-[13px] uppercase text-paper">{host[0] ?? '·'}</div>
                <div className="min-w-0 flex-1">
                  <div className="label-mono">Current site</div>
                  <div className="truncate text-[14px] font-medium">{host || 'No page'}</div>
                </div>
                <div className="text-right">
                  {scan.status === 'loading' ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <>
                      <CountUp key={detected.length} value={detected.length} className="block text-[24px] font-semibold leading-none tracking-tight" />
                      <div className="label-mono mt-0.5">fields</div>
                    </>
                  )}
                </div>
              </div>
              {scan.status === 'unsupported' && <p className="mt-3 text-[12.5px] text-mute">{scan.reason}</p>}
              {scan.status === 'ready' && !detected.length && <p className="mt-3 text-[12.5px] text-mute">No application fields found yet. If the form is on another tab or loads later, reopen this popup.</p>}
            </div>

            {/* profile + resume */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => openDashboard('profile')} className="rounded-xl border border-line bg-surface p-3 text-left shadow-soft transition-colors hover:border-[#cfcfca]">
                <div className="flex items-baseline justify-between">
                  <span className="label-mono">Profile</span>
                  <span className="font-mono text-[12px]">{completion}%</span>
                </div>
                <ProgressBar value={completion} className="mt-2.5" />
                <div className="mt-2 truncate text-[12px] text-mute">{completion < 60 ? 'Add more details' : 'Ready to autofill'}</div>
              </button>
              <div className="rounded-xl border border-line bg-surface p-3 shadow-soft">
                <div className="label-mono mb-1.5 flex items-center gap-1">
                  <FileText size={11} /> Resume
                </div>
                {resumes.length ? (
                  <Select value={resume?.id ?? ''} onChange={(id) => ResumeService.setDefault(id)} options={resumes.map((r) => ({ value: r.id, label: r.name }))} className="[&>button]:h-7 [&>button]:px-2 [&>button]:text-[12.5px]" />
                ) : (
                  <button onClick={() => openDashboard('resumes')} className="text-[12.5px] text-mute underline decoration-accent underline-offset-2">
                    Upload a resume
                  </button>
                )}
              </div>
            </div>

            {/* actions */}
            <Button variant="accent" className="h-10 w-full text-[14px]" icon={<Wand2 size={15} />} disabled={scan.status !== 'ready' || !detected.length} onClick={startPreview}>
              Autofill{detected.length ? ` · preview ${usable.length} field${usable.length === 1 ? '' : 's'}` : ''}
            </Button>
            {scan.status === 'ready' && detected.length > 0 && !usable.length && <p className="text-center text-[12px] text-mute">Your profile has no data for the detected fields yet.</p>}

            <div className="grid grid-cols-2 gap-2">
              <Button icon={<ScanSearch size={14} />} loading={busy === 'analyze'} disabled={scan.status === 'unsupported'} onClick={analyze}>
                Analyze job
              </Button>
              <Button icon={<BookmarkPlus size={14} />} loading={busy === 'save'} disabled={scan.status === 'unsupported'} onClick={saveJob}>
                Save job
              </Button>
            </div>

            <AnimatePresence>
              {note && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={cn('overflow-hidden rounded-lg px-3 py-2 text-[12.5px]', note.kind === 'ok' ? 'bg-[#0f2a1a] text-[#4ade80]' : 'bg-[#2a0f0f] text-[#f87171]')} onClick={() => setNote(null)}>
                  {note.text}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <button onClick={() => openDashboard('overview')} className="flex items-center gap-1.5 text-[13px] font-medium hover:text-accent">
                Open dashboard <ExternalLink size={12} />
              </button>
              <button onClick={() => setShowSettings((s) => !s)} className="flex items-center gap-1 text-[12.5px] text-mute hover:text-ink" aria-expanded={showSettings}>
                Quick settings <ChevronDown size={13} className={cn('transition-transform', showSettings && 'rotate-180')} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showSettings && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="-mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface px-3.5">
                  <Toggle checked={settings.attachResume} onChange={(v) => saveSettings({ ...settings, attachResume: v })} label="Attach resume" />
                  <Toggle checked={settings.overwriteByDefault} onChange={(v) => saveSettings({ ...settings, overwriteByDefault: v })} label="Overwrite filled fields" />
                  <Toggle checked={settings.highlightUnmatched} onChange={(v) => saveSettings({ ...settings, highlightUnmatched: v })} label="Highlight unmatched fields" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.12 }} className="flex max-h-[520px] flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <IconButton label="Back" onClick={() => setPhase('home')}>
                <ArrowLeft size={15} />
              </IconButton>
              <div className="flex-1">
                <div className="text-[14px] font-medium">Review before filling</div>
                <div className="text-[12px] text-mute">{picked.size} of {grouped.length} selected · nothing is submitted</div>
              </div>
              <button className="text-[12px] text-mute hover:text-ink" onClick={() => setPicked(picked.size === grouped.length ? new Set() : new Set(grouped.map(key)))}>
                {picked.size === grouped.length ? 'None' : 'All'}
              </button>
            </div>
            <ul className="flex-1 divide-y divide-line overflow-auto">
              {grouped.map((f) => {
                const has = !!f.currentValue.trim();
                const on = picked.has(key(f));
                return (
                  <li key={key(f)}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((s) => {
                            const n = new Set(s);
                            n.has(key(f)) ? n.delete(key(f)) : n.add(key(f));
                            return n;
                          })
                        }
                        className="mt-1 accent-[#FF6B35]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium">{f.label || TYPE_LABEL[f.type!]}</span>
                          <span className="shrink-0 rounded bg-[#222] px-1.5 py-px font-mono text-[10px] text-mute">{TYPE_LABEL[f.type!]}</span>
                        </div>
                        <div className="truncate text-[12.5px] text-mute">{f.proposedValue!.replace(/\s+/g, ' ')}</div>
                        {has && <div className="mt-0.5 truncate text-[11.5px] text-[#b8461a]">Already has “{f.currentValue.slice(0, 40)}”{on ? ' — will be replaced' : ' — kept'}</div>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {unmatched.length > 0 && <p className="border-t border-line px-4 py-2 text-[12px] text-mute">{unmatched.length} other field{unmatched.length === 1 ? '' : 's'} couldn’t be matched and will be left untouched.</p>}
            <div className="border-t border-line p-3">
              <Button variant="accent" className="h-10 w-full" loading={busy === 'fill'} disabled={!picked.size} icon={<Check size={15} />} onClick={fill}>
                Fill {picked.size} field{picked.size === 1 ? '' : 's'}
              </Button>
            </div>
          </motion.div>
        )}

        {phase === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 p-4">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
              <div className="mb-3 flex items-center gap-2 text-[14px] font-medium">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-ok text-white"><Check size={12} /></span>
                Autofill complete
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Filled', result.filled],
                  ['Kept', result.skipped],
                  ['Failed', result.failed],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-paper py-2">
                    <CountUp value={v as number} className="block text-[20px] font-semibold leading-none" />
                    <div className="label-mono mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {result.upload && (
              <div className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]', result.upload.ok ? 'bg-[#0f2a1a] text-[#4ade80]' : 'bg-accent-soft text-[#ffb27a]')}>
                <Paperclip size={14} className="mt-0.5 shrink-0" />
                <span>{result.upload.ok ? result.upload.message : `${result.upload.message} Use the site’s upload button to attach “${resume?.fileName}”.`}</span>
              </div>
            )}
            {!result.upload && settings.attachResume && scan.status === 'ready' && scan.fileInputs === 0 && <p className="text-[12px] text-mute">No file upload field was found, so no resume was attached.</p>}

            {result.unmatched.length > 0 && (
              <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="label-mono mb-1.5">Needs your attention{settings.highlightUnmatched ? ' · outlined on page' : ''}</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.unmatched.map((l, i) => (
                    <span key={i} className="rounded-md border border-dashed border-accent/60 bg-accent-soft px-1.5 py-0.5 text-[12px] text-[#8f3a17]">{l}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12px] text-mute">Review everything and submit the form yourself. ApplyPilot never submits applications.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => { setPhase('home'); tab && runScan(tab); }}>Done</Button>
              <Button variant="primary" onClick={saveJob} loading={busy === 'save'} icon={<BookmarkPlus size={14} />}>Save job</Button>
            </div>
            {note && <p className={cn('text-[12.5px]', note.kind === 'ok' ? 'text-ok' : 'text-bad')}>{note.text}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
