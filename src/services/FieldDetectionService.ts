// FieldDetectionService: runs inside web pages (bundled into the content script).
// Identifies form fields from several signals (autocomplete, label, aria, name/id, placeholder, nearby text),
// fills them in a way React/Vue controlled inputs accept, and attaches the resume file to file inputs.
import type { FieldType, FillRequestItem, FillResultItem, UploadResult } from '../shared/types';

// ---------------------------------------------------------------- rules
interface Rule {
  type: FieldType;
  autocomplete?: string[];
  include: RegExp;
  exclude?: RegExp;
  /** Only valid for textarea/long text (avoid mapping long text onto a short input) */
  longOnly?: boolean;
}

const RULES: Rule[] = [
  { type: 'firstName', autocomplete: ['given-name'], include: /\b(first|given|fore)\s?name\b|\bfname\b|\bf name\b/ },
  { type: 'lastName', autocomplete: ['family-name'], include: /\b(last|family|sur)\s?name\b|\blname\b|\bl name\b/ },
  {
    type: 'fullName',
    autocomplete: ['name'],
    include: /\b(full|legal|complete|your|candidate|applicant)\s?name\b|^name$|^name \w{0,3}$/,
    exclude: /\b(first|last|family|given|sur|user|company|employer|school|university|manager|reference|file|project|preferred|middle|nick|display|referrer)\b/,
  },
  { type: 'email', autocomplete: ['email'], include: /\be ?mail\b/ },
  { type: 'phone', autocomplete: ['tel', 'tel-national'], include: /\b(phone|mobile|cell|telephone|tel|contact number)\b/, exclude: /\b(country code|extension|ext|type)\b/ },
  {
    type: 'address',
    autocomplete: ['street-address', 'address-line1'],
    include: /\b(street|address line|address|residen(ce|tial))\b/,
    exclude: /\b(e ?mail|ip|web|url|city|state|zip|postal|country|line 2)\b/,
  },
  { type: 'city', autocomplete: ['address-level2'], include: /\b(city|town|current location|location|where (are|do) you (live|based|located)|based in)\b/, exclude: /\b(job|work|office|preferred|relocat|remote|company|desired)\b/ },
  { type: 'country', autocomplete: ['country', 'country-name'], include: /\bcountry\b/, exclude: /\b(code|phone)\b/ },
  { type: 'linkedin', include: /\blinked ?in\b/ },
  { type: 'github', include: /\bgit ?hub\b/ },
  { type: 'portfolio', include: /\bportfolio\b|\bpersonal (site|page)\b|\bbehance\b|\bdribbble\b/ },
  { type: 'website', autocomplete: ['url'], include: /\b(website|web site|homepage|personal url|blog|other url|url)\b/, exclude: /\b(linked ?in|git ?hub|company|job|apply|resume|cv|portfolio)\b/ },
  { type: 'university', autocomplete: [], include: /\b(university|college|school|institution|alma mater)\b/, exclude: /\b(high school)\b/ },
  { type: 'degree', include: /\b(degree|qualification|level of education|education level|highest education)\b/ },
  { type: 'major', include: /\b(major|field of study|discipline|area of study|specializ?ation|concentration)\b/ },
  { type: 'graduationYear', include: /\bgraduat(e|ed|ion)\b|\bgrad (year|date)\b/ },
  { type: 'education', include: /\beducation\b/, exclude: /\b(level|degree|highest)\b/ },
  { type: 'yearsExperience', include: /\byears? of (work |professional |relevant |total )?experience\b|\bexperience \(?(in )?years\)?\b|\btotal experience\b|\bhow many years\b/ },
  { type: 'experience', include: /\b(work|professional|relevant|employment) (experience|history)\b|\bexperience summary\b/, longOnly: true },
  { type: 'skills', include: /\bskills?\b|\btechnologies\b|\bcompetenc(y|ies)\b|\btech stack\b/ },
  { type: 'company', autocomplete: ['organization'], include: /\b(current|present|recent|latest|previous|last) (company|employer|organi[sz]ation)\b|\bemployer\b|\bcompany name\b|^company$/ },
  { type: 'jobTitle', autocomplete: ['organization-title'], include: /\b(current|present|recent|latest) (job )?(title|position|role)\b|\bjob title\b|\bheadline\b|\bposition title\b|^title$/, exclude: /\b(desired|applying|applied|position applying)\b/ },
  { type: 'coverLetter', include: /\bcover letter\b|\bmotivation(al)? letter\b|\bletter of interest\b/, longOnly: true },
  { type: 'summary', include: /\b(professional |career )?summary\b|\babout (you|yourself|me)\b|\bbio\b|\bintroduce yourself\b|\btell us about yourself\b/, longOnly: true },
];

const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'password', 'range', 'color', 'search']);

// ---------------------------------------------------------------- helpers
export const norm = (s: string): string =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type FormEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function collect<T extends Element>(selector: string, root: ParentNode = document, out: T[] = []): T[] {
  root.querySelectorAll<T>(selector).forEach((e) => out.push(e));
  root.querySelectorAll('*').forEach((e) => {
    if (e.shadowRoot) collect(selector, e.shadowRoot, out);
  });
  return out;
}

function isVisible(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  if (el.getAttribute('aria-hidden') === 'true' && el.tabIndex < 0) return false; // honeypot
  return true;
}

const textWithoutControls = (node: Element): string => {
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('input, select, textarea, option, script, style, button').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
};

interface Signals {
  label: string;
  aria: string;
  nameId: string;
  placeholder: string;
  nearby: string;
  autocomplete: string;
  displayLabel: string;
}

function getSignals(el: FormEl): Signals {
  const labels: string[] = [];
  if (el.labels) el.labels.forEach((l) => labels.push(textWithoutControls(l)));
  const wrapping = el.closest('label');
  if (wrapping && !labels.length) labels.push(textWithoutControls(wrapping));
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = el.getRootNode() as Document | ShadowRoot;
    labelledBy.split(/\s+/).forEach((id) => {
      const n = root.getElementById?.(id);
      if (n) labels.push(textWithoutControls(n));
    });
  }
  const aria = el.getAttribute('aria-label') ?? '';

  // nearby text: look through a few ancestors for a label-ish element or short preceding text
  let nearby = '';
  if (!labels.join('').trim() && !aria) {
    const controls = (n: Element) => n.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
    // 1) text directly before the control (sibling label/span)
    const prev = el.previousElementSibling;
    if (prev && !controls(prev)) {
      const t = textWithoutControls(prev);
      if (t && t.length < 100) nearby = t;
    }
    // 2) a label-ish element in a wrapper that contains only this control
    let node: Element | null = el.parentElement;
    for (let depth = 0; node && depth < 3 && !nearby; depth++, node = node.parentElement) {
      if (controls(node) !== 1) break;
      const cand = Array.from(node.querySelectorAll('label, legend, span, p, b, strong, div')).find((c) => !c.contains(el) && !controls(c) && textWithoutControls(c));
      if (cand) {
        const t = textWithoutControls(cand);
        if (t.length < 100) nearby = t;
      }
      if (!nearby && node.previousElementSibling && !controls(node.previousElementSibling)) {
        const t = textWithoutControls(node.previousElementSibling);
        if (t && t.length < 100) nearby = t;
      }
    }
  }

  const label = labels.filter(Boolean).join(' ');
  return {
    label: norm(label),
    aria: norm(aria),
    nameId: norm(`${el.getAttribute('name') ?? ''} ${el.id ?? ''}`),
    placeholder: norm(el.getAttribute('placeholder') ?? ''),
    nearby: norm(nearby),
    autocomplete: (el.getAttribute('autocomplete') ?? '').toLowerCase(),
    displayLabel: (label || aria || el.getAttribute('placeholder') || nearby || el.getAttribute('name') || el.id || '').replace(/\s*\*\s*$/, '').trim(),
  };
}

const matches = (rule: Rule, text: string) => !!text && rule.include.test(text) && !(rule.exclude && rule.exclude.test(text));

/** Score every rule on every signal; the best-scoring rule above the threshold wins. */
export function classify(el: FormEl): { type: FieldType | null; confidence: number; label: string } {
  const s = getSignals(el);
  const inputType = el instanceof HTMLInputElement ? el.type : '';
  const isLong = el instanceof HTMLTextAreaElement;
  let best: { type: FieldType; score: number } | null = null;

  for (const rule of RULES) {
    if (rule.longOnly && !isLong) continue;
    let score = 0;
    if (rule.autocomplete?.some((a) => s.autocomplete.split(/\s+/).includes(a))) score += 100;
    if (matches(rule, s.label)) score += 50;
    if (matches(rule, s.aria)) score += 45;
    if (matches(rule, s.nameId)) score += 40;
    if (matches(rule, s.placeholder)) score += 35;
    if (matches(rule, s.nearby)) score += 32;
    if (rule.type === 'email' && inputType === 'email') score += 90;
    if (rule.type === 'phone' && inputType === 'tel') score += 90;
    if (score > 0 && (!best || score > best.score)) best = { type: rule.type, score };
  }
  if (best && best.score >= 30) return { type: best.type, confidence: Math.min(best.score, 100) / 100, label: s.displayLabel };
  return { type: null, confidence: 0, label: s.displayLabel };
}

// ---------------------------------------------------------------- scanning
export interface RawField {
  id: string;
  el: FormEl;
  type: FieldType | null;
  confidence: number;
  label: string;
  tag: 'input' | 'textarea' | 'select';
  inputType: string;
  currentValue: string;
}

let counter = 0;
const ATTR = 'data-applypilot-id';

const selectIsEmpty = (s: HTMLSelectElement) => {
  const o = s.selectedOptions[0];
  return !o || !o.value || s.selectedIndex <= 0 && /^(select|choose|please|--|—|pick)/i.test(o.text.trim());
};

export function currentValueOf(el: FormEl): string {
  if (el instanceof HTMLSelectElement) return selectIsEmpty(el) ? '' : el.selectedOptions[0].text.trim();
  return el.value ?? '';
}

export function detectFields(): RawField[] {
  const out: RawField[] = [];
  for (const el of collect<FormEl>('input, textarea, select')) {
    if (el instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(el.type)) continue;
    if (el.disabled || (el as HTMLInputElement).readOnly) continue;
    if (!isVisible(el)) continue;
    let id = el.getAttribute(ATTR);
    if (!id) {
      id = `ap-${++counter}`;
      el.setAttribute(ATTR, id);
    }
    const c = classify(el);
    out.push({
      id,
      el,
      ...c,
      tag: el.tagName.toLowerCase() as RawField['tag'],
      inputType: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
      currentValue: currentValueOf(el),
    });
  }
  return out;
}

export const findById = (id: string): FormEl | null => collect<FormEl>(`[${ATTR}="${id}"]`)[0] ?? null;

// ---------------------------------------------------------------- filling
function setNativeValue(el: FormEl, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fire(el: FormEl, value?: string) {
  el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value, inputType: 'insertText' }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

const COUNTRY_ALIASES: string[][] = [
  ['united states', 'united states of america', 'usa', 'us', 'u s', 'u s a', 'america'],
  ['united kingdom', 'uk', 'u k', 'great britain', 'gb', 'england'],
  ['united arab emirates', 'uae', 'u a e'],
  ['south korea', 'korea republic of', 'republic of korea', 'korea'],
  ['russia', 'russian federation'],
  ['netherlands', 'the netherlands', 'holland'],
  ['czech republic', 'czechia'],
  ['turkey', 'turkiye'],
  ['pakistan', 'pk'],
];
const aliasGroup = (n: string) => COUNTRY_ALIASES.find((g) => g.includes(n));

function bestOption(select: HTMLSelectElement, wanted: string): HTMLOptionElement | null {
  const w = norm(wanted);
  if (!w) return null;
  const group = aliasGroup(w);
  let best: { o: HTMLOptionElement; score: number } | null = null;
  for (const o of Array.from(select.options)) {
    if (!o.value && !o.text.trim()) continue;
    const t = norm(o.text);
    const v = norm(o.value);
    let score = 0;
    if (t === w || v === w) score = 100;
    else if (group && (group.includes(t) || group.includes(v))) score = 95;
    else if (t && t.length > 2 && (t.includes(w) || w.includes(t))) score = 70;
    else if (w.split(' ')[0].length > 3 && t.split(' ')[0] === w.split(' ')[0]) score = 45;
    if (score && (!best || score > best.score)) best = { o, score };
  }
  return best && best.score >= 45 ? best.o : null;
}

export function fillElement(el: FormEl, value: string, overwrite: boolean): FillResultItem['status'] {
  const existing = currentValueOf(el).trim();
  if (existing && !overwrite) return 'skipped-existing';
  try {
    if (el instanceof HTMLSelectElement) {
      const opt = bestOption(el, value);
      if (!opt) return 'failed';
      setNativeValue(el, opt.value);
      fire(el);
      return el.value === opt.value ? 'filled' : 'failed';
    }
    el.focus({ preventScroll: true });
    setNativeValue(el, value);
    fire(el, value);
    return el.value === value ? 'filled' : 'failed';
  } catch {
    return 'failed';
  }
}

export function fillFields(items: FillRequestItem[]): FillResultItem[] {
  return items.map((it) => {
    const el = findById(it.id);
    if (!el) return { id: it.id, status: 'failed' as const };
    return { id: it.id, status: fillElement(el, it.value, it.overwrite) };
  });
}

// ---------------------------------------------------------------- highlighting (inline style: works under strict page CSP)
const HL = 'data-applypilot-prev-outline';
export function setHighlight(id: string, kind: 'unmatched' | 'filled' | null) {
  const el = findById(id);
  if (!el) return;
  if (!el.hasAttribute(HL)) el.setAttribute(HL, el.style.outline || '');
  if (kind === null) {
    el.style.outline = el.getAttribute(HL) ?? '';
    el.removeAttribute(HL);
    return;
  }
  el.style.setProperty('outline', kind === 'unmatched' ? '2px dashed #FF6B35' : '2px solid #FF6B35', 'important');
  el.style.setProperty('outline-offset', '2px', 'important');
}
export function clearHighlights() {
  collect<FormEl>(`[${HL}]`).forEach((el) => {
    el.style.outline = el.getAttribute(HL) ?? '';
    el.removeAttribute(HL);
  });
}

// ---------------------------------------------------------------- resume upload
function base64ToFile(base64: string, name: string, type: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

export function uploadResume(base64: string, name: string, type: string): UploadResult {
  const inputs = collect<HTMLInputElement>('input[type="file"]').filter((i) => !i.disabled);
  if (!inputs.length) return { ok: false, fileInputs: 0, attached: 0, message: 'No file upload field found on this page.' };

  const ext = name.toLowerCase().split('.').pop() ?? '';
  const scored = inputs
    .map((i) => {
      const s = getSignals(i as unknown as FormEl);
      const text = `${s.label} ${s.aria} ${s.nameId} ${s.nearby}`;
      const accept = (i.accept || '').toLowerCase();
      const acceptOk = !accept || accept.includes(`.${ext}`) || accept.includes(type) || accept.includes('application/') || accept.includes('.doc') || accept.includes('.pdf');
      let score = acceptOk ? 1 : -10;
      if (/\b(resume|cv|curriculum)\b/.test(text)) score += 5;
      if (/\b(cover|letter|portfolio|transcript|photo|image|avatar)\b/.test(text)) score -= 6;
      return { input: i, score };
    })
    .sort((a, b) => b.score - a.score);

  const target = scored[0];
  if (!target || target.score <= 0) return { ok: false, fileInputs: inputs.length, attached: 0, message: 'The upload field does not accept this file type, or looks like a different document slot.' };

  try {
    const dt = new DataTransfer();
    dt.items.add(base64ToFile(base64, name, type));
    target.input.files = dt.files;
    target.input.dispatchEvent(new Event('input', { bubbles: true }));
    target.input.dispatchEvent(new Event('change', { bubbles: true }));
    if (target.input.files?.length === 1) return { ok: true, fileInputs: inputs.length, attached: 1, message: `Attached ${name}. Confirm the site shows the file before submitting.` };
  } catch {
    /* fall through */
  }
  return { ok: false, fileInputs: inputs.length, attached: 0, message: 'The browser or website blocked programmatic upload. Please attach the file manually.' };
}

// ---------------------------------------------------------------- page info (for Analyze / Save job)
export interface PageInfo {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  fromStructuredData: boolean;
}

const htmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('li').forEach((li) => li.prepend('• '));
  doc.querySelectorAll('p, br, div, li, h1, h2, h3, h4').forEach((n) => n.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n');
};

function findJobPosting(node: unknown): Record<string, any> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findJobPosting(n);
      if (f) return f;
    }
    return null;
  }
  const o = node as Record<string, any>;
  const t = o['@type'];
  if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return o;
  return findJobPosting(o['@graph']);
}

export function getPageInfo(): PageInfo {
  const base: PageInfo = { url: location.href, title: '', company: '', location: '', description: '', fromStructuredData: false };

  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const jp = findJobPosting(JSON.parse(s.textContent ?? ''));
      if (jp) {
        const loc = Array.isArray(jp.jobLocation) ? jp.jobLocation[0] : jp.jobLocation;
        const addr = loc?.address ?? {};
        return {
          ...base,
          title: String(jp.title ?? ''),
          company: String(jp.hiringOrganization?.name ?? ''),
          location: [addr.addressLocality, addr.addressRegion, addr.addressCountry?.name ?? addr.addressCountry].filter((x) => typeof x === 'string' && x).join(', '),
          description: htmlToText(String(jp.description ?? '')).slice(0, 15000),
          fromStructuredData: true,
        };
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const selected = window.getSelection()?.toString() ?? '';
  const main = document.querySelector<HTMLElement>('main, [role="main"], article') ?? document.body;
  const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
  const site = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content ?? '';
  return {
    ...base,
    title: h1 || document.title,
    company: site,
    description: (selected.length > 200 ? selected : main.innerText).slice(0, 15000),
  };
}
