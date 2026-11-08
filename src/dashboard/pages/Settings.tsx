import { CheckCircle2, Download, Globe, Plug, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { checkBackend } from '../../services/AIService';
import { clearAllData, exportAllData, removeItem, deleteFile } from '../../services/StorageService';
import { STORAGE_KEYS } from '../../shared/types';
import { ConfirmModal, useToast } from '../../ui/feedback';
import { useResumes, useSettings } from '../../ui/hooks';
import { Button, Card, Field, Input, Select, Toggle } from '../../ui/primitives';
import { downloadText, PageHeader, SectionTitle } from '../components/shared';

const TONES = ['Professional', 'Enthusiastic', 'Confident', 'Friendly', 'Concise', 'Formal'];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <SectionTitle>{title}</SectionTitle>
      <Card className="divide-y divide-line px-5 py-2">{children}</Card>
    </section>
  );
}

export function SettingsPage() {
  const [settings, save] = useSettings();
  const [resumes] = useResumes();
  const toast = useToast();
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [health, setHealth] = useState<null | { ok: boolean; text: string }>(null);
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState<null | 'profile' | 'applications' | 'resumes' | 'all'>(null);
  const inExtension = typeof chrome !== 'undefined' && !!chrome.permissions;

  const test = async () => {
    setTesting(true);
    const r = await checkBackend(apiUrl);
    setHealth(r.ok ? { ok: !!r.configured, text: r.configured ? `Connected · model ${r.model}` : 'Backend reachable, but GROQ_API_KEY is not set in server/.env.' } : { ok: false, text: 'Cannot reach the backend. Is it running (npm run server)?' });
    setTesting(false);
  };

  const enableFrames = async () => {
    try {
      const granted = await chrome.permissions.request({ origins: ['https://*/*', 'http://*/*'] });
      toast(granted ? 'ok' : 'info', granted ? 'Enabled. Autofill can now reach forms embedded in iframes.' : 'Permission not granted.');
    } catch {
      toast('error', 'Could not request permission.');
    }
  };

  const doDelete = async () => {
    switch (confirm) {
      case 'profile': await removeItem(STORAGE_KEYS.profile); break;
      case 'applications': await removeItem(STORAGE_KEYS.applications); break;
      case 'resumes':
        for (const r of resumes) await deleteFile(r.id);
        await removeItem(STORAGE_KEYS.resumes);
        break;
      case 'all': await clearAllData(); break;
    }
    toast('ok', 'Deleted.');
  };

  const exportData = async () => {
    const data = await exportAllData();
    downloadText('applypilot-export.json', JSON.stringify(data, null, 2));
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Privacy controls, AI backend connection and autofill behavior." />

      <Group title="Privacy & AI">
        <div className="py-1">
          <Toggle
            checked={settings.aiConsent}
            onChange={(aiConsent) => save({ ...settings, aiConsent })}
            label="Allow AI processing"
            description="When on, the text needed for an AI action you click (job description, plus profile/resume text when relevant) is sent to your backend and then Groq. Nothing is sent in the background."
          />
        </div>
        <div className="space-y-3 py-4">
          <Field label="Backend URL" hint="Your ApplyPilot server. It holds the Groq API key; the extension never does.">
            <div className="flex gap-2">
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} onBlur={() => apiUrl !== settings.apiUrl && save({ ...settings, apiUrl: apiUrl.trim() })} placeholder="http://localhost:8787" />
              <Button icon={<Plug size={14} />} loading={testing} onClick={async () => { await save({ ...settings, apiUrl: apiUrl.trim() }); test(); }}>
                Test
              </Button>
            </div>
          </Field>
          {health && (
            <div className={`flex items-center gap-2 text-[13px] ${health.ok ? 'text-ok' : 'text-bad'}`}>
              {health.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {health.text}
            </div>
          )}
          <p className="flex items-start gap-2 text-[12.5px] text-mute">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Profile, resumes, applications and settings are stored only in this browser. Job descriptions and web page text are treated as untrusted data and sanitized before use.
          </p>
        </div>
      </Group>

      <Group title="Autofill">
        <Toggle checked={settings.highlightUnmatched} onChange={(v) => save({ ...settings, highlightUnmatched: v })} label="Highlight fields I couldn’t match" description="Draws an orange dashed outline around form fields that need manual attention." />
        <Toggle checked={settings.overwriteByDefault} onChange={(v) => save({ ...settings, overwriteByDefault: v })} label="Overwrite filled fields by default" description="Off by default: fields that already contain text are left alone unless you select them in the preview." />
        <Toggle checked={settings.attachResume} onChange={(v) => save({ ...settings, attachResume: v })} label="Attach selected resume when autofilling" description="Tries to attach your resume to file inputs. Some sites block this; you will get a clear note if so." />
        <div className="py-3">
          <Field label="Default cover letter tone">
            <Select className="max-w-56" value={settings.defaultTone} onChange={(defaultTone) => save({ ...settings, defaultTone })} options={TONES.map((t) => ({ value: t, label: t }))} />
          </Field>
        </div>
        {inExtension && (
          <div className="flex items-center justify-between gap-6 py-3.5">
            <div>
              <div className="text-[13.5px] font-medium">Forms embedded in iframes</div>
              <div className="mt-0.5 text-[12.5px] text-mute">Many career sites embed their application form from another domain. Granting broad site access lets autofill reach those frames. Optional; autofill never submits forms.</div>
            </div>
            <Button icon={<Globe size={14} />} onClick={enableFrames}>Enable</Button>
          </div>
        )}
      </Group>

      <Group title="Your data">
        <div className="flex items-center justify-between gap-6 py-3.5">
          <div>
            <div className="text-[13.5px] font-medium">Export data</div>
            <div className="mt-0.5 text-[12.5px] text-mute">Download your profile, applications, saved letters and resume text as JSON (resume files not included).</div>
          </div>
          <Button icon={<Download size={14} />} onClick={exportData}>Export</Button>
        </div>
        {([
          ['profile', 'Delete profile', 'Clears every field in My Profile.'],
          ['resumes', 'Delete all resumes', 'Removes resume files and extracted text.'],
          ['applications', 'Delete all applications', 'Clears the Job Tracker.'],
          ['all', 'Delete everything', 'Removes all ApplyPilot data from this browser.'],
        ] as const).map(([k, title, text]) => (
          <div key={k} className="flex items-center justify-between gap-6 py-3.5">
            <div>
              <div className="text-[13.5px] font-medium">{title}</div>
              <div className="mt-0.5 text-[12.5px] text-mute">{text}</div>
            </div>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(k)}>Delete</Button>
          </div>
        ))}
      </Group>

      <ConfirmModal
        open={!!confirm}
        title="This can’t be undone"
        message={confirm === 'all' ? 'All profile data, resumes, applications, letters and settings will be permanently removed from this browser.' : 'The selected data will be permanently removed from this browser.'}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
