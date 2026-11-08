import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowUp, BarChart3, Bookmark, Briefcase, CalendarDays, Check, Cpu, FileText, Hourglass, Layers, MessageSquareText,
  MoreVertical, NotebookPen, Sparkles, Target, Zap,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { checkBackend } from '../../services/AIService';
import { profileCompletion } from '../../services/ProfileService';
import { timeAgo } from '../../shared/util';
import { CountUp } from '../../ui/feedback';
import { useApplications, useProfile, useResumes, useSettings } from '../../ui/hooks';
import { cn } from '../../ui/primitives';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const Spark = () => (
  <svg viewBox="0 0 100 30" className="absolute bottom-4 right-4 h-7 w-24" aria-hidden>
    <path d="M2 26 C 20 26, 25 18, 40 20 S 60 26, 72 16 S 90 8, 98 6" fill="none" stroke="#ff7a1a" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

function Stat({ icon: Icon, label, value, suffix = '', delta }: { icon: ComponentType<{ size?: number }>; label: string; value: number; suffix?: string; delta?: string }) {
  return (
    <div className="panel relative min-h-[156px] p-6">
      <span className="text-accent"><Icon size={26} /></span>
      <div className="mt-3 text-[17px] text-ink/90">{label}</div>
      <div className="mt-1 flex items-baseline gap-4">
        <CountUp value={value} suffix={suffix} className="text-[42px] font-bold leading-none" />
        {delta && <span className="flex items-center gap-1 text-[14px] text-ok"><ArrowUp size={14} />{delta}</span>}
      </div>
      <Spark />
    </div>
  );
}

const badge: Record<string, { cls: string; icon: ComponentType<{ size?: number }> }> = {
  Applied: { cls: 'border-[#1f5a35] bg-[#0f2a1a] text-[#4ade80]', icon: Check },
  Offer: { cls: 'border-[#1f5a35] bg-[#0f2a1a] text-[#4ade80]', icon: Check },
  Interview: { cls: 'border-[#3b3270] bg-[#1f1a3a] text-[#d8d0ff]', icon: CalendarDays },
  Assessment: { cls: 'border-[#6b4e10] bg-[#3a2a08] text-[#ffd27a]', icon: Hourglass },
  Saved: { cls: 'border-[#6b4e10] bg-[#3a2a08] text-[#ffd27a]', icon: Bookmark },
  Rejected: { cls: 'border-[#5a1f1f] bg-[#2a0f0f] text-[#f87171]', icon: Hourglass },
  Withdrawn: { cls: 'border-[#333] bg-[#1a1a1a] text-mute', icon: Hourglass },
};

export function OverviewPage() {
  const [profile] = useProfile();
  const [apps] = useApplications();
  const [resumes] = useResumes();
  const completion = profileCompletion(profile);
  const scored = apps.filter((a) => typeof a.matchScore === 'number');
  const matchAvg = scored.length ? Math.round(scored.reduce((s, a) => s + (a.matchScore ?? 0), 0) / scored.length) : 0;
  const weekAgo = Date.now() - 7 * 864e5;
  const [settings] = useSettings();
  const [backend, setBackend] = useState<{ ok: boolean; model?: string; configured?: boolean } | null>(null);
  useEffect(() => {
    checkBackend(settings.apiUrl).then(setBackend);
  }, [settings.apiUrl]);
  const newThisWeek = apps.filter((a) => a.createdAt > weekAgo).length;
  const newInterviews = apps.filter((a) => a.status === 'Interview' && a.updatedAt > weekAgo).length;
  const connected = !!backend?.ok && !!backend.configured;
  const resume = [...resumes].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt - a.createdAt)[0];

  const checklist = [
    { label: 'Basic Info', ok: !!(profile.fullName && profile.email) },
    { label: 'Education', ok: profile.education.length > 0 },
    { label: 'Experience', ok: profile.experience.length > 0 },
    { label: 'Skills', ok: profile.skills.length > 0 },
    { label: 'Resume', ok: resumes.length > 0 },
  ];

  const chips = [
    { icon: Zap, label: 'Autofill Forms', href: '#/profile' },
    { icon: BarChart3, label: 'Match Jobs', href: '#/analyzer' },
    { icon: NotebookPen, label: 'Generate Cover Letters', href: '#/cover-letter' },
    { icon: Sparkles, label: 'Answer Applications', href: '#/assistant' },
  ];

  const actions = [
    { href: '#/analyzer', icon: Zap, title: 'Analyze a Job', text: 'Get match score & missing skills', primary: true },
    { href: '#/cover-letter', icon: NotebookPen, title: 'Generate Cover Letter', text: 'Tailored, role-specific with AI' },
    { href: '#/assistant', icon: MessageSquareText, title: 'Application Answers', text: 'AI-assisted responses' },
    { href: '#/resumes', icon: BarChart3, title: 'Optimize My Resume', text: 'Improve for higher match' },
  ];

  const R = 50;
  const C = 2 * Math.PI * R;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* Hero */}
      <motion.section variants={item} className="relative min-h-[262px] pt-6">
        <img src="/hero.png" alt="" className="pointer-events-none absolute -top-[78px] right-0 z-0 h-[340px] w-auto max-w-[60%] object-cover object-right [mask-image:linear-gradient(to_right,transparent,black_18%)]" />
        <span className="absolute left-0 top-4 h-4 w-4 border-l-[3px] border-t-[3px] border-accent" />
        <div className="relative z-10 pl-6">
          <h1 className="font-pixel text-[46px] font-bold leading-[1.1] tracking-tight">
            Your AI Copilot for
            <br />
            <span className="text-accent">Job Applications_</span>
          </h1>
          <p className="mt-6 text-[17px] text-ink/85">Find opportunities, tailor your applications, and track your progress — all with AI.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {chips.map((c) => (
              <a key={c.label} href={c.href} className="flex h-11 items-center gap-2 rounded-2xl border border-[#333] bg-[#121212]/90 px-4 text-[14px] font-medium transition-colors hover:border-accent">
                <c.icon size={18} className="text-accent" /> {c.label}
              </a>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-[1fr_335px]">
        <div className="space-y-5">
          {/* Stats */}
          <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Briefcase} label="Applications" value={apps.length} delta={newThisWeek ? `+${newThisWeek} this week` : undefined} />
            <Stat icon={CalendarDays} label="Interviews" value={apps.filter((a) => a.status === 'Interview').length} delta={newInterviews ? `+${newInterviews} new` : undefined} />
            <Stat icon={Bookmark} label="Saved Jobs" value={apps.filter((a) => a.status === 'Saved').length} />
            <Stat icon={Target} label="Match Avg." value={matchAvg} suffix="%" delta={scored.length ? `${scored.length} scored` : undefined} />
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
            {/* Recent applications */}
            <motion.div variants={item} className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-3 text-[20px] font-bold"><Layers size={28} className="text-accent" /> Recent Applications</h2>
                <a href="#/tracker" className="flex items-center gap-1 text-[14px] font-medium text-accent">View All <ArrowRight size={16} /></a>
              </div>
              {!apps.length ? (
                <p className="py-10 text-center text-[14px] text-mute">No applications yet — save a job from the extension popup.</p>
              ) : (
                <div className="divide-y divide-[#242424]">
                  {apps.slice(0, 4).map((a) => {
                    const b = badge[a.status] ?? badge.Applied;
                    return (
                      <a key={a.id} href="#/tracker" className="flex items-center gap-4 py-2.5 hover:bg-white/[0.02]">
                        <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-xl bg-[#1c1c1c] text-[20px] font-bold">{(a.company || '?')[0].toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15.5px] font-medium">{a.title || 'Untitled role'}</div>
                          <div className="truncate text-[14px] text-mute">{a.company || 'Unknown company'}</div>
                        </div>
                        <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-medium', b.cls)}>
                          <b.icon size={15} /> {a.status === 'Assessment' ? 'In Review' : a.status}
                        </span>
                        <span className="w-16 shrink-0 text-right text-[14px] text-ink/80">{timeAgo(a.updatedAt)}</span>
                        <MoreVertical size={18} className="shrink-0 text-ink/70" />
                      </a>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* AI quick actions */}
            <motion.div variants={item} className="panel p-3">
              <h2 className="mb-3 flex items-center gap-3 px-2 pt-2 text-[20px] font-bold"><Sparkles size={28} className="text-accent" /> AI Quick Actions</h2>
              <div className="space-y-2.5">
                {actions.map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    className={cn(
                      'flex items-center gap-4 rounded-xl border px-4 py-2.5 transition-colors',
                      a.primary ? 'border-accent bg-gradient-to-r from-[#ff7a1a] to-[#ff8f2e] text-black' : 'border-[#262626] bg-[#181818] hover:border-accent/60',
                    )}
                  >
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-lg', a.primary ? '' : 'bg-[#222]')}><a.icon size={26} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">{a.title}</span>
                      <span className={cn('block text-[13px]', a.primary ? 'text-black/80' : 'text-ink/75')}>{a.text}</span>
                    </span>
                    <ArrowRight size={20} />
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <motion.a variants={item} href="#/profile" className="panel block p-5">
            <h2 className="text-[19px] font-bold">Profile Completion</h2>
            <div className="mt-3 flex items-center gap-6">
              <div className="relative h-[125px] w-[125px] shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="#2a2a2a" strokeWidth="13" />
                  <circle cx="60" cy="60" r={R} fill="none" stroke="#ff7a1a" strokeWidth="13" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - completion / 100)} />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-[24px] font-bold"><CountUp value={completion} suffix="%" /></span>
              </div>
              <ul className="space-y-1.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5 text-[14.5px]">
                    <span className={cn('grid h-5 w-5 place-items-center rounded', c.ok ? 'bg-accent text-black' : 'border border-[#444]')}>{c.ok && <Check size={14} strokeWidth={3} />}</span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </motion.a>

          <motion.div variants={item} className="panel p-4">
            <h3 className="mb-3 flex items-center gap-3 border-b border-[#242424] pb-3 text-[16.5px] font-medium"><FileText size={24} className="text-accent" /> Resume in Use</h3>
            <a href="#/resumes" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#1c1c1c]"><FileText size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{resume?.name ?? 'No resume uploaded'}</span>
                <span className="block text-[13.5px] text-mute">{resume ? `Updated ${timeAgo(resume.createdAt)}` : 'Upload one to get started'}</span>
              </span>
              <MoreVertical size={18} className="text-ink/70" />
            </a>
          </motion.div>

          <motion.a variants={item} href="#/settings" className="panel flex items-center gap-4 p-4">
            <Cpu size={34} className="text-accent" />
            <span className="flex-1">
              <span className="block text-[16.5px] font-medium">AI Processing</span>
              <span className="block text-[13px] text-ink/80">Use Groq to power AI features</span>
            </span>
            <span className={cn('relative h-7 w-12 rounded-full', settings.aiConsent ? 'bg-accent' : 'bg-[#333]')}>
              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white', settings.aiConsent ? 'right-1' : 'left-1')} />
            </span>
          </motion.a>

          <motion.div variants={item} className="panel flex items-center gap-4 p-5">
            <Zap size={34} className="fill-accent text-accent" />
            <span className="flex-1">
              <span className="block text-[16.5px] font-medium">Groq (LLM)</span>
              <span className="block truncate text-[13.5px] text-ink/80">{backend?.model ?? (backend ? 'Backend unreachable' : 'Checking…')}</span>
            </span>
            <span className={cn('flex items-center gap-2 text-[14px]', connected ? 'text-ok' : 'text-bad')}>
              <span className={cn('h-2.5 w-2.5 rounded-full', connected ? 'bg-ok' : 'bg-bad')} /> {connected ? 'Connected' : backend?.ok ? 'No API key' : 'Offline'}
            </span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
