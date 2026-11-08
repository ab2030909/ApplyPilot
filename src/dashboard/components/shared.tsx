import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AIError } from '../../services/AIService';
import { usePendingJob, useSettings } from '../../ui/hooks';
import { JobService } from '../../services/JobService';
import { Button, Select } from '../../ui/primitives';
import { Notice, useToast } from '../../ui/feedback';
import type { PendingJob, ResumeMeta } from '../../shared/types';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-[13.5px] text-mute">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="label-mono">{children}</h3>
      {aside}
    </div>
  );
}

/** Shown on every AI page until the user explicitly allows sending data to their backend. */
export function AIConsentNotice() {
  const [settings, save] = useSettings();
  if (settings.aiConsent) return null;
  return (
    <div className="mb-5">
      <Notice tone="warn">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            AI features send only the text for the action you click (job description, plus your profile/resume text when needed) to your ApplyPilot backend, which calls Groq. Nothing is sent until you allow it.
          </span>
          <Button size="sm" variant="primary" icon={<ShieldCheck size={13} />} onClick={() => save({ ...settings, aiConsent: true })}>
            Allow AI processing
          </Button>
        </div>
      </Notice>
    </div>
  );
}

export function ResumeSelect({ resumes, value, onChange, allowNone = true }: { resumes: ResumeMeta[]; value: string; onChange: (id: string) => void; allowNone?: boolean }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="Select a resume"
      options={[...(allowNone ? [{ value: '', label: 'Profile only (no resume)' }] : []), ...resumes.map((r) => ({ value: r.id, label: `${r.name}${r.isDefault ? ' · default' : ''}` }))]}
    />
  );
}

/** Wraps an async AI call with loading + friendly error handling. */
export function useAction() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof AIError || e instanceof Error ? e.message : 'Something went wrong.';
        setError(msg);
        toast('error', msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );
  return { run, loading, error, setError };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const statusTone: Record<string, string> = {
  Saved: 'bg-[#222] text-ink border border-[#333]',
  Applied: 'bg-[#0f2a1a] text-[#4ade80] border border-[#1f5a35]',
  Assessment: 'bg-[#3a2a08] text-[#fbbf24] border border-[#6b4e10]',
  Interview: 'bg-[#1f1a3a] text-[#c4b5fd] border border-[#3b3270]',
  Offer: 'bg-[#0f2a1a] text-ok border border-[#1f5a35]',
  Rejected: 'bg-[#2a0f0f] text-bad border border-[#5a1f1f]',
  Withdrawn: 'bg-[#1a1a1a] text-mute border border-[#333]',
};

/** Applies a job captured from the browser extension (or another page) once, then clears it. */
export function useConsumePendingJob(page: string, apply: (job: PendingJob) => void) {
  const [pending] = usePendingJob();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (!pending) return;
    // The page that hands a job off stays mounted during the route transition,
    // so only the page the job was addressed to may consume it.
    if (pending.target && pending.target !== page) return;
    applyRef.current(pending);
    JobService.clearPending();
  }, [pending, page]);
}
