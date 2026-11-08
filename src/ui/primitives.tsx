import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Logo
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <path d="M4 26 L13 6 H19 L10 26 Z" fill="#FF7A1A" />
        <path d="M15 26 L24 6 H30 L21 26 Z" fill="#FFFFFF" />
      </svg>
      {withText && (
        <span className="text-[22px] font-bold tracking-tight">
          ApplyPilot<span className="text-accent"> AI</span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:bg-[#ff8c3a] border-accent',
  accent: 'bg-accent text-black hover:bg-[#ff8c3a] border-accent',
  secondary: 'bg-surface text-ink border-line hover:border-accent/60 hover:bg-[#1a1a1a]',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-white/5',
  danger: 'bg-surface text-bad border-line hover:border-bad/50 hover:bg-bad/10',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: Omit<ComponentProps<typeof motion.button>, 'children'> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode; children?: ReactNode }) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-colors disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[13.5px]',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}

export function IconButton({ label, children, className, ...rest }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('grid h-7 w-7 place-items-center rounded-md text-mute transition-colors hover:bg-black/5 hover:text-ink disabled:opacity-30', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Fields
const inputBase =
  'w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink placeholder:text-[#6b6b6b] transition-colors hover:border-[#3a3a3a] focus:border-accent focus:outline-none focus-visible:outline-none';

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label-mono mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-mute">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={cn(inputBase, 'h-9', props.className)} />;
}
export function Textarea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cn(inputBase, 'py-2 leading-relaxed', props.className)} />;
}

export function Select({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
  return (
    <div ref={ref} className={cn('relative', className)} onKeyDown={onKey}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={cn(inputBase, 'flex h-9 items-center justify-between text-left')}>
        <span className={cn('truncate', !current && 'text-[#a8a8a3]')}>{current?.label ?? placeholder ?? 'Select…'}</span>
        <ChevronDown size={14} className={cn('ml-2 shrink-0 text-mute transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={id}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-40 mt-1 max-h-64 w-full min-w-40 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-paper"
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check size={13} className="text-accent" />}
                </button>
              </li>
            ))}
            {!options.length && <li className="px-2.5 py-2 text-[12.5px] text-mute">No options</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <div>
        <div className="text-[13.5px] font-medium">{label}</div>
        {description && <div className="mt-0.5 text-[12.5px] text-mute">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-[#333]')}
      >
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 36 }} className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={cn('relative flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors', o.value === value ? 'text-paper' : 'text-mute hover:text-ink')}>
          {o.value === value && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-md bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center gap-1.5">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Surfaces
export function Card({ children, className, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-soft', className)} {...rest}>
      {children}
    </div>
  );
}

export function Chip({ children, tone = 'neutral', onRemove }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'bad'; onRemove?: () => void }) {
  const tones = {
    neutral: 'border-line bg-paper text-ink',
    accent: 'border-accent/40 bg-accent-soft text-[#ffb27a]',
    ok: 'border-[#1f5a35] bg-[#0f2a1a] text-[#4ade80]',
    bad: 'border-[#5a1f1f] bg-[#2a0f0f] text-[#f87171]',
  };
  return (
    <motion.span layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px]', tones[tone])}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="-mr-0.5 rounded p-0.5 opacity-60 hover:opacity-100">
          <X size={11} />
        </button>
      )}
    </motion.span>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...value];
    items.forEach((i) => !next.some((n) => n.toLowerCase() === i.toLowerCase()) && next.push(i));
    onChange(next);
    setDraft('');
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5 focus-within:border-ink">
      {value.map((t) => (
        <Chip key={t} onRemove={() => onChange(value.filter((v) => v !== t))}>
          {t}
        </Chip>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text');
          if (t.includes(',')) {
            e.preventDefault();
            add(t);
          }
        }}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1.5 py-1 text-[13.5px] placeholder:text-[#a8a8a3] focus:outline-none"
      />
    </div>
  );
}
