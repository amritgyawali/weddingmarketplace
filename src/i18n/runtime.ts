/**
 * Translation runtime, free of React and store imports so pure modules
 * (`utils/format`, services, Node scripts) can use it.
 *
 * The app is written in English. In Nepali mode every string the UI renders
 * goes through `translate()`: an exact entry in the dictionary, else a
 * template entry such as "{0} days to go" (placeholders match anything and
 * are translated in turn), else the text unchanged. A super admin's text
 * overrides win over both, in either language.
 */
import { NE } from './ne';

export type Lang = 'en' | 'ne';
export type CalendarMode = 'bs' | 'ad';
/** English source text → replacement per language. */
export type TextOverrides = Record<string, { en?: string; ne?: string }>;

/** Current settings, kept in sync by `I18nProvider`. */
export const runtime: { lang: Lang; calendar: CalendarMode; overrides: TextOverrides } = {
  lang: 'en',
  calendar: 'bs',
  overrides: {},
};

interface Template {
  re: RegExp;
  out: string;
}

const PLACEHOLDER = /\{(\w+)\}/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(entries: Record<string, string>): Template[] {
  const list: Template[] = [];
  for (const [key, out] of Object.entries(entries)) {
    if (!key.includes('{')) continue;
    const literal = key.replace(PLACEHOLDER, '');
    if (!literal.trim()) continue;
    const names: string[] = [];
    const source = key
      .split(PLACEHOLDER)
      .map((part, i) => {
        if (i % 2 === 0) return escape(part);
        names.push(part);
        return '(.*?)';
      })
      .join('');
    // Placeholders become $1, $2… in the order they appear in the English key.
    let target = out;
    names.forEach((n, i) => {
      target = target.split(`{${n}}`).join(`\u0000${i}\u0000`);
    });
    list.push({ re: new RegExp(`^${source}$`, 's'), out: target });
  }
  // Longer literal text first, so "{0} days to go" beats "{0} days".
  const literal = (t: Template) => t.re.source.replace(/\(\.\*\?\)/g, '').length;
  return list.sort((a, b) => literal(b) - literal(a));
}

const TEMPLATES = compile(NE);
const cache = new Map<string, string>();
let cacheFor: TextOverrides | null = null;

function lookup(core: string, lang: Lang, overrides: TextOverrides, depth: number): string | undefined {
  const o = overrides[core]?.[lang];
  if (o) return o;
  if (lang === 'en') return undefined;
  const exact = NE[core];
  if (exact) return exact;
  if (depth > 2) return undefined;
  for (const t of TEMPLATES) {
    const m = t.re.exec(core);
    if (!m) continue;
    return t.out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => {
      const part = m[Number(i) + 1] ?? '';
      // English plural endings ("day{1}" → "days") have no Nepali counterpart.
      if (part === 's' || part === 'es') return '';
      return translateWith(part, lang, overrides, depth + 1);
    });
  }
  return undefined;
}

function translateWith(text: string, lang: Lang, overrides: TextOverrides, depth = 0): string {
  const core = text.trim();
  if (!core || /^[\d\s.,:%+\-–/()#]+$/.test(core)) return text;
  const found = lookup(core, lang, overrides, depth);
  if (found === undefined) return text;
  if (core === text) return found;
  const start = text.indexOf(core);
  return text.slice(0, start) + found + text.slice(start + core.length);
}

/** Text in the current language (with super admin overrides). */
export function translate(text: string, lang: Lang = runtime.lang, overrides: TextOverrides = runtime.overrides): string {
  if (lang === 'en' && !overrides[text.trim()]) return text;
  if (cacheFor !== overrides) {
    cache.clear();
    cacheFor = overrides;
  }
  const key = `${lang}\u0001${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = translateWith(text, lang, overrides);
  if (cache.size > 6000) cache.clear();
  cache.set(key, out);
  return out;
}

/** Shorthand for non-React callers: alerts, toasts, placeholders. */
export const tr = (text: string) => translate(text);

/** True when `text` has a Nepali entry (exact or template). Used by the admin text editor. */
export const hasTranslation = (text: string) => translateWith(text, 'ne', {}) !== text;

/** Every English key in the dictionary, for the admin text editor. */
export const dictionaryKeys = () => Object.keys(NE);
