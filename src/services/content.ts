/**
 * App content edited by a super admin, laid over the bundled catalogue.
 *
 * Pure: no React, no store and no catalogue imports, so data modules, the
 * API layer and Node scripts can all use it. The store keeps `content` in
 * sync with `contentRuntime` (see `hooks/useContent.ts`), the same way the
 * translation runtime follows the language.
 */
import type { AppContent, ContentBanner, ContentEntry, ContentKind } from '@/types/content';

export const CONTENT_KINDS: ContentKind[] = ['venue', 'vendor', 'category', 'shortcut', 'collection', 'idea', 'story', 'realWedding'];

/** Content with nothing changed. */
export const emptyContent = (): AppContent => ({ images: {}, entries: {}, home: { order: [], titles: {} }, banners: [], brand: {} });

/** Shared, never mutated: the content of an install nobody has edited. */
export const EMPTY_CONTENT: AppContent = emptyContent();

/** Current content, kept in sync with the store for callers outside React. */
export const contentRuntime: { content: AppContent } = { content: EMPTY_CONTENT };

export const entryKey = (kind: ContentKind, id: string) => `${kind}:${id}`;
export const bannerSectionId = (id: string) => `banner:${id}`;

/** Addresses of photos kept on this device (`backend/contentMedia.ts`). */
export const LOCAL_IMAGE_SCHEME = 'vivah-file://';

export const MAX_TEXT = 4000;
export const MAX_LIST = 60;
export const MAX_BANNERS = 12;
/** Small images picked in a browser are kept inline; larger ones need a link. */
export const MAX_INLINE_IMAGE = 400_000;

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * A photo address the app can show: a web link, a photo kept on this device,
 * or a small inline image. Returns it trimmed, or null when it is none of these.
 */
export function imageAddress(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\/[^/]+\.[^/]+/i.test(value) && value.length <= 2000) return value;
  if (value.startsWith(LOCAL_IMAGE_SCHEME) && value.length <= 300) return value;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) && value.length <= MAX_INLINE_IMAGE) return value;
  return null;
}

// ─── Catalogue records ──────────────────────────────────────────────────────

interface Patched {
  content: AppContent;
  all: unknown[];
  visible: unknown[];
}
const patched = new WeakMap<object, Patched>();

function patchedFor<T extends { id: string }>(kind: ContentKind, list: readonly T[], content: AppContent): Patched {
  const hit = patched.get(list);
  if (hit && hit.content === content) return hit;
  let all: T[] = list as T[];
  let visible: T[] = all;
  const prefix = `${kind}:`;
  if (Object.keys(content.entries).some((k) => k.startsWith(prefix))) {
    all = list.map((item) => {
      const entry = content.entries[prefix + item.id];
      return entry && Object.keys(entry.fields).length ? { ...item, ...entry.fields, id: item.id } : item;
    });
    visible = all.filter((item) => !content.entries[prefix + item.id]?.hidden);
  }
  const next = { content, all, visible };
  patched.set(list, next);
  return next;
}

/**
 * A catalogue list with the super admin's edits applied. Untouched records
 * keep their identity, and the list itself comes back when nothing of this
 * kind was edited. Hidden records stay in, so links to them still open.
 */
export function patchList<T extends { id: string }>(kind: ContentKind, list: readonly T[], content: AppContent = contentRuntime.content): T[] {
  return patchedFor(kind, list, content).all as T[];
}

/** The edited list without the records a super admin hid: what lists and search show. */
export function visibleList<T extends { id: string }>(kind: ContentKind, list: readonly T[], content: AppContent = contentRuntime.content): T[] {
  return patchedFor(kind, list, content).visible as T[];
}

export const isHidden = (kind: ContentKind, id: string, content: AppContent = contentRuntime.content) => !!content.entries[entryKey(kind, id)]?.hidden;

/**
 * Checks edited fields against the original record and returns only those
 * that differ from it. A field must exist on the original and keep its type;
 * whole-number fields (prices, counts) are rounded and never negative, and
 * photo fields must pass `okImage`.
 */
export function checkFields(
  original: Record<string, unknown>,
  fields: Record<string, unknown>,
  imageFields: readonly string[] = [],
  okImage: (ref: string) => boolean = (ref) => !!imageAddress(ref),
): { fields?: Record<string, unknown>; error?: string } {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (key === 'id') {
      if (raw !== original.id) return { error: 'The id can’t be changed' };
      continue;
    }
    if (!Object.hasOwn(original, key)) return { error: `This record has no field called ${key}` };
    const was = original[key];
    let value = raw;
    if (typeof was === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${key} must be a number` };
      if (value < 0) return { error: `${key} can’t be negative` };
      if (Number.isInteger(was)) value = Math.round(value);
    } else if (typeof was === 'string') {
      if (typeof value !== 'string') return { error: `${key} must be text` };
      value = value.trim();
      if ((value as string).length > MAX_TEXT) return { error: `Keep ${key} under ${MAX_TEXT} characters` };
      if (imageFields.includes(key)) {
        if (!okImage(value as string)) return { error: `${key} needs a photo: pick one or paste a link that starts with https://` };
      } else if (!value && was) return { error: `${key} can’t be empty` };
    } else if (typeof was === 'boolean') {
      if (typeof value !== 'boolean') return { error: `${key} is on or off` };
    } else if (Array.isArray(was)) {
      if (!Array.isArray(value)) return { error: `${key} must be a list` };
      if (value.length > MAX_LIST) return { error: `Keep ${key} to ${MAX_LIST} items` };
      if (was.every((x) => typeof x === 'string')) {
        if (!value.every((x) => typeof x === 'string')) return { error: `${key} must be a list of text` };
        value = (value as string[]).map((x) => x.trim()).filter(Boolean);
        if (imageFields.includes(key) && (!(value as string[]).length || !(value as string[]).every(okImage))) return { error: `${key} needs at least one photo, each picked or pasted as a link` };
      }
    } else if (isRecord(was)) {
      if (!isRecord(value)) return { error: `${key} must be an object with fields` };
    }
    if (JSON.stringify(value).length > 60_000) return { error: `${key} is too long` };
    if (!same(value, was)) out[key] = value;
  }
  return { fields: out };
}

// ─── Home sections ──────────────────────────────────────────────────────────

/**
 * Section ids top to bottom. The saved order comes first; a built-in section
 * it doesn't mention (added in a later version) goes back after the section
 * it follows by default, and a new banner goes to the top.
 */
export function orderSections(defaults: readonly string[], saved: readonly string[], banners: readonly ContentBanner[]): string[] {
  const bannerIds = banners.map((b) => bannerSectionId(b.id));
  const valid = new Set([...defaults, ...bannerIds]);
  const order = [...new Set(saved)].filter((id) => valid.has(id));
  if (!order.length) return [...bannerIds, ...defaults];
  defaults.forEach((id, i) => {
    if (order.includes(id)) return;
    const before = defaults.slice(0, i).reverse().find((d) => order.includes(d));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  return [...bannerIds.filter((id) => !order.includes(id)), ...order];
}

/** A section heading: the super admin's wording (with `{city}` filled in), else the built-in one. */
export function sectionTitle(id: string, fallback: string, city: string, content: AppContent = contentRuntime.content): string {
  const custom = content.home.titles[id]?.trim();
  return custom ? custom.split('{city}').join(city) : fallback;
}

// ─── Reading saved content ──────────────────────────────────────────────────

const text = (x: unknown, max = MAX_TEXT) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const textMap = (x: unknown, max: number, check: (v: string) => string | null = (v) => v || null) => {
  const out: Record<string, string> = {};
  if (isRecord(x)) {
    for (const [k, v] of Object.entries(x)) {
      const value = check(text(v, max));
      if (k && value) out[k] = value;
    }
  }
  return out;
};

function readBanner(x: unknown): ContentBanner | null {
  if (!isRecord(x)) return null;
  const id = text(x.id, 60);
  const title = text(x.title, 90);
  if (!id || !title) return null;
  return {
    id,
    title,
    body: text(x.body, 300) || undefined,
    image: text(x.image, MAX_INLINE_IMAGE) || undefined,
    actionLabel: text(x.actionLabel, 30) || undefined,
    href: text(x.href, 300) || undefined,
    active: x.active !== false,
  };
}

/**
 * Content from storage or the server, with anything malformed dropped, so a
 * bad value can never break the screens that read it. Content that is
 * already clean comes back as the same object.
 */
export function normalizeContent(raw: unknown): AppContent {
  if (!isRecord(raw)) return EMPTY_CONTENT;
  const entries: Record<string, ContentEntry> = {};
  if (isRecord(raw.entries)) {
    for (const [key, value] of Object.entries(raw.entries)) {
      const kind = key.slice(0, key.indexOf(':')) as ContentKind;
      if (!CONTENT_KINDS.includes(kind) || key.length <= kind.length + 1 || !isRecord(value)) continue;
      const fields = isRecord(value.fields) ? { ...value.fields } : {};
      delete fields.id;
      if (Object.keys(fields).length || value.hidden === true) entries[key] = { fields, ...(value.hidden === true ? { hidden: true } : {}) };
    }
  }
  const home = isRecord(raw.home) ? raw.home : {};
  const banners: ContentBanner[] = [];
  for (const b of Array.isArray(raw.banners) ? raw.banners : []) {
    const banner = readBanner(b);
    if (banner && banners.length < MAX_BANNERS && !banners.some((x) => x.id === banner.id)) banners.push(banner);
  }
  const next: AppContent = {
    images: textMap(raw.images, MAX_INLINE_IMAGE, imageAddress),
    entries,
    home: {
      order: Array.isArray(home.order) ? [...new Set(home.order.filter((x): x is string => typeof x === 'string' && !!x))].slice(0, 80) : [],
      titles: textMap(home.titles, 90),
    },
    banners,
    brand: textMap(raw.brand, 200),
  };
  return same(next, raw) ? (raw as unknown as AppContent) : next;
}

/** How much has been changed, for the console. */
export function contentStats(content: AppContent) {
  const entries = Object.values(content.entries);
  return {
    images: Object.keys(content.images).length,
    edited: entries.filter((e) => Object.keys(e.fields).length).length,
    hidden: entries.filter((e) => e.hidden).length,
    banners: content.banners.length,
    home: content.home.order.length ? 1 : 0,
    titles: Object.keys(content.home.titles).length,
    brand: Object.keys(content.brand).length,
  };
}

/** Total number of changes; zero means the app shows exactly what it shipped with. */
export function contentChangeCount(content: AppContent) {
  const s = contentStats(content);
  return s.images + s.edited + s.hidden + s.banners + s.home + s.titles + s.brand;
}
