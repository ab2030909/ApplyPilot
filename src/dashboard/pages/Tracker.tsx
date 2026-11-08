import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Kanban, LayoutList, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApplicationService } from '../../services/ApplicationService';
import { hostOf } from '../../services/JobService';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '../../shared/types';
import { timeAgo } from '../../shared/util';
import { ConfirmModal, CountUp, EmptyState, Modal, Skeleton, useToast } from '../../ui/feedback';
import { useApplications, useResumes } from '../../ui/hooks';
import { Button, Card, Chip, cn, Field, Input, Segmented, Select, Textarea } from '../../ui/primitives';
import { PageHeader, statusTone } from '../components/shared';

type Sort = 'newest' | 'oldest' | 'company' | 'match' | 'status';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'company', label: 'Company A–Z' },
  { value: 'match', label: 'Best match' },
  { value: 'status', label: 'Status' },
];
const ACTIVE: ApplicationStatus[] = ['Saved', 'Applied', 'Assessment', 'Interview'];

export function TrackerPage() {
  const [apps, , loaded] = useApplications();
  const [resumes] = useResumes();
  const toast = useToast();
  const [view, setView] = useState<'board' | 'table'>('board');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [dialog, setDialog] = useState<{ id: string | null; mode: 'view' | 'edit' } | null>(null);
  const dialogApp = dialog?.id ? apps.find((a) => a.id === dialog.id) ?? null : null;
  const [toDelete, setToDelete] = useState<Application | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = apps.filter((a) => (statusFilter === 'all' || a.status === statusFilter) && (!needle || [a.company, a.title, a.location, a.notes].some((s) => s.toLowerCase().includes(needle))));
    const order = (s: ApplicationStatus) => APPLICATION_STATUSES.indexOf(s);
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest': return a.createdAt - b.createdAt;
        case 'company': return a.company.localeCompare(b.company);
        case 'match': return (b.matchScore ?? -1) - (a.matchScore ?? -1);
        case 'status': return order(a.status) - order(b.status);
        default: return b.createdAt - a.createdAt;
      }
    });
  }, [apps, q, statusFilter, sort]);

  const metrics = [
    { label: 'Total', value: apps.length },
    { label: 'Active', value: apps.filter((a) => ACTIVE.includes(a.status)).length },
    { label: 'Interviews', value: apps.filter((a) => a.status === 'Interview').length },
    { label: 'Offers', value: apps.filter((a) => a.status === 'Offer').length },
    { label: 'Rejections', value: apps.filter((a) => a.status === 'Rejected').length },
  ];

  return (
    <div>
      <PageHeader
        title="Job Tracker"
        description="Track every application from saved to offer. Statuses only change when you change them."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setDialog({ id: null, mode: 'edit' })}>
            Add application
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="label-mono">{m.label}</div>
            <CountUp value={m.value} className="mt-1 block text-[26px] font-semibold leading-none tracking-tight" />
          </Card>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1 md:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, title, notes…" className="pl-8" aria-label="Search applications" />
        </div>
        <Select className="w-40" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...APPLICATION_STATUSES.map((s) => ({ value: s, label: s }))]} />
        <Select className="w-40" value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS} />
        <div className="ml-auto">
          <Segmented<'board' | 'table'> value={view} onChange={setView} options={[{ value: 'board', label: 'Board', icon: <Kanban size={13} /> }, { value: 'table', label: 'Table', icon: <LayoutList size={13} /> }]} />
        </div>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !apps.length ? (
        <EmptyState
          icon={<Kanban size={18} />}
          title="No applications yet"
          description="Add one manually, save a job from any page with the extension popup, or from the Job Analyzer."
          action={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setDialog({ id: null, mode: 'edit' })}>Add application</Button>}
        />
      ) : view === 'board' ? (
        <Board apps={filtered} onOpen={(a) => setDialog({ id: a.id, mode: 'view' })} />
      ) : (
        <Table apps={filtered} onOpen={(a) => setDialog({ id: a.id, mode: 'view' })} />
      )}
      {apps.length > 0 && !filtered.length && <p className="mt-4 text-center text-[13px] text-mute">No applications match your filters.</p>}

      {dialog && (!dialog.id || dialogApp) && (
        <ApplicationDialog
          key={dialog.id ?? 'new'}
          app={dialogApp}
          initialMode={dialog.mode}
          resumes={resumes.map((r) => ({ value: r.id, label: r.name }))}
          onClose={() => setDialog(null)}
          onDelete={(a) => setToDelete(a)}
          onSaved={() => toast('ok', 'Application saved.')}
        />
      )}
      <ConfirmModal
        open={!!toDelete}
        title="Delete application?"
        message={`“${toDelete?.title || 'This application'}” will be removed permanently.`}
        onConfirm={() => {
          if (toDelete) ApplicationService.remove(toDelete.id);
          setDialog(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- board
function Board({ apps, onOpen }: { apps: Application[]; onOpen: (a: Application) => void }) {
  const [over, setOver] = useState<ApplicationStatus | null>(null);
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
      {APPLICATION_STATUSES.map((status) => {
        const col = apps.filter((a) => a.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) ApplicationService.setStatus(id, status);
            }}
            className={cn('w-64 shrink-0 rounded-xl border p-2.5 transition-colors', over === status ? 'border-accent bg-accent-soft/60' : 'border-line bg-[#101010]')}
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="label-mono">{status}</span>
              <span className="font-mono text-[11px] text-mute">{col.length}</span>
            </div>
            <div className="min-h-16 space-y-2">
              <AnimatePresence initial={false}>
                {col.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    draggable
                    onDragStart={(e) => (e as unknown as DragEvent).dataTransfer?.setData('text/plain', a.id)}
                    onClick={() => onOpen(a)}
                    className="cursor-grab rounded-lg border border-line bg-surface p-3 shadow-soft transition-colors hover:border-[#cfcfca] active:cursor-grabbing"
                  >
                    <div className="text-[13.5px] font-medium leading-snug">{a.title || 'Untitled role'}</div>
                    <div className="mt-0.5 text-[12.5px] text-mute">{a.company || 'Unknown company'}</div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[11.5px] text-mute">{timeAgo(a.updatedAt)}</span>
                      {a.matchScore != null && <Chip tone={a.matchScore >= 70 ? 'ok' : a.matchScore >= 45 ? 'accent' : 'neutral'}>{a.matchScore}%</Chip>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- table
function Table({ apps, onOpen }: { apps: Application[]; onOpen: (a: Application) => void }) {
  if (!apps.length) return null;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {['Role', 'Company', 'Status', 'Match', 'Applied', 'Updated'].map((h) => (
              <th key={h} className="label-mono px-4 py-3 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} onClick={() => onOpen(a)} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper">
              <td className="max-w-64 truncate px-4 py-3 font-medium">{a.title || 'Untitled role'}</td>
              <td className="px-4 py-3 text-mute">{a.company || '—'}</td>
              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={a.status}
                  onChange={(e) => ApplicationService.setStatus(a.id, e.target.value as ApplicationStatus)}
                  aria-label={`Status for ${a.title}`}
                  className={cn('rounded-md px-2 py-1 text-[12px] font-medium focus:outline-none', statusTone[a.status])}
                >
                  {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-4 py-3 font-mono text-[12px]">{a.matchScore != null ? `${a.matchScore}%` : '—'}</td>
              <td className="px-4 py-3 text-mute">{a.appliedDate || '—'}</td>
              <td className="px-4 py-3 text-mute">{timeAgo(a.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------- dialog (detail + add/edit)
function ApplicationDialog({ app, initialMode, resumes, onClose, onDelete, onSaved }: { app: Application | null; initialMode: 'view' | 'edit'; resumes: { value: string; label: string }[]; onClose: () => void; onDelete: (a: Application) => void; onSaved: () => void }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState<Partial<Application>>(app ?? { status: 'Saved' });
  const set = <K extends keyof Application>(k: K, v: Application[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim() && !form.company?.trim()) return;
    if (app) await ApplicationService.update(app.id, form);
    else await ApplicationService.add(form);
    onSaved();
    onClose();
  };

  if (mode === 'view' && app) {
    const live = app;
    return (
      <Modal
        open
        onClose={onClose}
        title={live.title || 'Application'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => onDelete(live)}>Delete</Button>
            <Button icon={<Pencil size={14} />} onClick={() => setMode('edit')}>Edit</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-medium">{live.company || 'Unknown company'}</div>
              <div className="text-[12.5px] text-mute">{[live.location, live.appliedDate && `Applied ${live.appliedDate}`].filter(Boolean).join(' · ') || 'No location'}</div>
            </div>
            <Select className="w-44" value={live.status} onChange={(v) => ApplicationService.setStatus(live.id, v as ApplicationStatus)} options={APPLICATION_STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>
          {live.url && (
            <a href={live.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[13px] text-ink underline decoration-accent decoration-2 underline-offset-2">
              <ExternalLink size={13} /> {hostOf(live.url) || live.url}
            </a>
          )}
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div><div className="label-mono">Match</div>{live.matchScore != null ? `${live.matchScore}%` : '—'}</div>
            <div><div className="label-mono">Resume</div>{resumes.find((r) => r.value === live.resumeId)?.label ?? '—'}</div>
            <div><div className="label-mono">Saved</div>{timeAgo(live.createdAt)}</div>
          </div>
          {live.notes && (
            <div>
              <div className="label-mono mb-1">Notes</div>
              <p className="whitespace-pre-wrap text-[13.5px]">{live.notes}</p>
            </div>
          )}
          {live.description && (
            <div>
              <div className="label-mono mb-1">Job description</div>
              <p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-[12.5px] text-mute">{live.description}</p>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={app ? 'Edit application' : 'Add application'}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={() => (app ? setMode('view') : onClose())}>Cancel</Button>
          <Button variant="primary" disabled={!form.title?.trim() && !form.company?.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Job title"><Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
        <Field label="Company"><Input value={form.company ?? ''} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Job URL"><Input value={form.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
        <Field label="Location"><Input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} /></Field>
        <Field label="Status"><Select value={form.status as string} onChange={(v) => set('status', v as ApplicationStatus)} options={APPLICATION_STATUSES.map((s) => ({ value: s, label: s }))} /></Field>
        <Field label="Application date"><Input type="date" value={form.appliedDate ?? ''} onChange={(e) => set('appliedDate', e.target.value)} /></Field>
        <Field label="Resume used"><Select value={form.resumeId ?? ''} onChange={(v) => set('resumeId', v)} options={[{ value: '', label: 'None' }, ...resumes]} /></Field>
        <Field label="Match score (%)"><Input type="number" min={0} max={100} value={form.matchScore ?? ''} onChange={(e) => set('matchScore', e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))} /></Field>
        <Field label="Notes" className="md:col-span-2"><Textarea rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Field label="Job description" className="md:col-span-2"><Textarea rows={6} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
