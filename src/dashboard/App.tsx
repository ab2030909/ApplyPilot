import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, Crosshair, FileText, House, LayoutGrid, PenLine, Search, Settings as SettingsIcon, Sparkles, UserRound } from 'lucide-react';
import type { ComponentType } from 'react';
import { useProfile, useRoute } from '../ui/hooks';
import { cn, Logo } from '../ui/primitives';
import { AnalyzerPage } from './pages/Analyzer';
import { AssistantPage } from './pages/Assistant';
import { CoverLetterPage } from './pages/CoverLetter';
import { OverviewPage } from './pages/Overview';
import { ProfilePage } from './pages/Profile';
import { ResumesPage } from './pages/Resumes';
import { SettingsPage } from './pages/Settings';
import { TrackerPage } from './pages/Tracker';

type NavItem = { id: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }>; page: ComponentType };
const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: House, page: OverviewPage },
  { id: 'profile', label: 'My Profile', icon: UserRound, page: ProfilePage },
  { id: 'resumes', label: 'Resumes', icon: FileText, page: ResumesPage },
  { id: 'analyzer', label: 'Job Analyzer', icon: Crosshair, page: AnalyzerPage },
  { id: 'cover-letter', label: 'Cover Letter', icon: PenLine, page: CoverLetterPage },
  { id: 'assistant', label: 'Application Assistant', icon: Sparkles, page: AssistantPage },
  { id: 'tracker', label: 'Job Tracker', icon: LayoutGrid, page: TrackerPage },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, page: SettingsPage },
];

function NavButton({ item, activeId }: { item: NavItem; activeId: string }) {
  const on = item.id === activeId;
  return (
    <a href={`#/${item.id}`} className={cn('relative flex h-[52px] items-center gap-4 rounded-xl px-6 text-[16.5px] font-medium transition-colors', on ? 'text-accent' : 'text-ink/90 hover:bg-white/5')}>
      {on && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl border-2 border-accent bg-gradient-to-r from-accent/25 to-accent/5 shadow-[0_0_24px_-4px_rgba(255,122,26,0.6)]"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative flex items-center gap-4">
        <item.icon size={22} strokeWidth={1.7} />
        {item.label}
      </span>
    </a>
  );
}

export function App() {
  const [route] = useRoute();
  const [profile] = useProfile();
  const active = NAV.find((n) => n.id === route) ?? NAV[0];
  const Page = active.page;
  const initials = profile.fullName.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'AH';

  return (
    <div className="flex min-h-screen bg-[#070707] text-ink">
      <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-[#1f1f1f] bg-[#0b0b0b] px-5 py-8 md:flex">
        <div className="px-4 pb-12">
          <Logo size={34} />
        </div>
        <nav className="flex flex-col gap-1.5" aria-label="Main">
          {NAV.map((n) => (
            <NavButton key={n.id} item={n} activeId={active.id} />
          ))}
        </nav>

        <div className="relative mt-auto overflow-hidden rounded-2xl border border-[#262626] bg-gradient-to-b from-[#141414] to-[#0d0d0d] px-10 py-14">
          <span className="absolute -left-6 top-0 h-16 w-16 rotate-45 border-r border-accent/60" />
          <p className="text-[17px] leading-snug text-ink">AI-Powered<br />Job Applications</p>
          <div className="mt-6 ml-20 space-y-1">
            <div className="h-[3px] w-24 rounded bg-accent" />
            <div className="ml-4 h-[3px] w-20 rounded bg-accent/60" />
          </div>
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <div className="dots pointer-events-none absolute bottom-0 left-0 h-40 w-full opacity-20 [mask-image:linear-gradient(to_top,black,transparent)]" />
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Main mobile">
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} className={cn('shrink-0 rounded-md px-2.5 py-1.5 text-[13px]', n.id === active.id ? 'bg-accent text-black' : 'text-mute')}>
              {n.label}
            </a>
          ))}
        </nav>

        <header className="relative z-20 flex items-center gap-4 px-9 pt-6">
          <label className="flex h-[52px] w-full max-w-[730px] items-center gap-3 rounded-2xl border border-[#333] bg-[#111]/80 px-5 backdrop-blur">
            <Search size={22} className="text-ink/80" />
            <input placeholder="Search jobs, applications, or notes..." className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink/70" />
            <kbd className="rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-2 py-0.5 text-[13px] text-mute">Ctrl</kbd>
            <kbd className="rounded-md border border-[#3a3a3a] bg-[#1a1a1a] px-2 py-0.5 text-[13px] text-mute">K</kbd>
          </label>
          <div className="ml-auto flex items-center gap-5">
            <button className="relative text-ink/90" aria-label="Notifications">
              <Bell size={26} strokeWidth={1.6} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
            </button>
            <a href="#/profile" className="flex items-center gap-2">
              <span className="grid h-[50px] w-[50px] place-items-center rounded-full border border-[#3a3a3a] bg-[#111] text-[17px] font-bold">{initials}</span>
              <ChevronDown size={18} />
            </a>
          </div>
        </header>

        <main className={cn('relative z-10', active.id === 'overview' ? 'px-9 pb-8' : 'mx-auto max-w-[1080px] px-6 py-9 md:px-10')}>
          <AnimatePresence mode="wait">
            <motion.div key={active.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
