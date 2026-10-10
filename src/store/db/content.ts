/**
 * Content studio (permission `admin.full`): replace any photo, edit any
 * marketplace listing, reorder and rename the couple's home sections, add
 * home banners and change the brand details, with no code change. Edits are
 * stored as differences from the bundled catalogue, so "restore" simply
 * removes them. Every write is audited. Supabase builds publish the result to
 * every device (`hooks/useContentSync.ts`, 0021_app_content.sql).
 */
import { BRAND_DEFAULTS, BRAND_FIELDS, type BrandField } from '@/constants/brand';
import { isPhotoKey } from '@/constants/images';
import { CONTENT_KIND_BY_ID, isImageRef } from '@/data/contentCatalogue';
import { HOME_SECTION_BY_ID, HOME_SECTION_IDS } from '@/data/homeSections';
import { bannerSectionId, checkFields, emptyContent, entryKey, imageAddress, MAX_BANNERS } from '@/services/content';
import type { AppContent, ContentBanner, ContentEntry, ContentKind } from '@/types/content';
import { uid } from '@/utils/format';

import { currentActor, type GetDb, type SetDb } from './helpers';
import { staffOnly } from './personas';

export type ContentPart = 'images' | 'entries' | 'home' | 'banners' | 'brand' | 'all';
export type BannerInput = Pick<ContentBanner, 'title'> & Partial<Omit<ContentBanner, 'title'>>;

export interface ContentActions {
  /** Shows another photo wherever a bundled one appears; null restores the original. Returns an error to show, or null. */
  setContentImage: (key: string, address: string | null) => string | null;
  /** Saves a catalogue record's edited fields (pass every field of the form; only the differences are kept). */
  saveContentEntry: (kind: ContentKind, id: string, fields: Record<string, unknown>) => string | null;
  /** Takes a record out of lists and search, or puts it back. */
  setContentHidden: (kind: ContentKind, id: string, hidden: boolean) => string | null;
  /** Removes every edit to one record. */
  restoreContentEntry: (kind: ContentKind, id: string) => string | null;
  /** Saves the order of the couple's home sections, top to bottom. */
  setHomeOrder: (order: string[]) => string | null;
  /** Renames a home section's heading; empty text restores the built-in one. */
  setHomeTitle: (sectionId: string, title: string) => string | null;
  /** Adds a home banner, or saves one that exists (`id`). Returns its id, or an error. */
  saveBanner: (input: BannerInput) => { id?: string; error?: string };
  removeBanner: (id: string) => string | null;
  /** Replaces one brand detail (name, support phone…); empty text restores the built-in one. */
  setBrandField: (field: BrandField, value: string) => string | null;
  /** Puts one part of the content, or all of it, back to what the app shipped with. */
  resetContent: (part: ContentPart) => string | null;
}

const GUARD = 'admin.full' as const;
const LINK = /^(\/[\w\-./[\]()?=&%]*|https:\/\/\S+)$/;

export const contentActions = (set: SetDb, get: GetDb): ContentActions => {
  const guard = () => staffOnly(GUARD, get);
  const audit = (action: string, id: string, detail?: string) => get().log(currentActor(), action, 'content', id, detail);
  const edit = (change: (c: AppContent) => AppContent) => set((s) => ({ content: change(s.content) }));
  const originalOf = (kind: ContentKind, id: string) => CONTENT_KIND_BY_ID[kind]?.items.find((r) => r.id === id);

  /** Writes or drops one record's entry; an entry with nothing in it is removed. */
  const putEntry = (kind: ContentKind, id: string, next: ContentEntry) =>
    edit((c) => {
      const entries = { ...c.entries };
      const key = entryKey(kind, id);
      if (Object.keys(next.fields).length || next.hidden) entries[key] = next.hidden ? { fields: next.fields, hidden: true } : { fields: next.fields };
      else delete entries[key];
      return { ...c, entries };
    });

  return {
    setContentImage: (key, address) => {
      const denied = guard();
      if (denied) return denied;
      if (!isPhotoKey(key)) return 'Pick one of the app’s photos to replace';
      const value = address === null ? null : imageAddress(address);
      if (address !== null && !value) return 'Pick a photo, or paste a link to one that starts with https://';
      edit((c) => {
        const images = { ...c.images };
        if (value) images[key] = value;
        else delete images[key];
        return { ...c, images };
      });
      audit(value ? 'content.image' : 'content.image.restore', key);
      return null;
    },

    saveContentEntry: (kind, id, fields) => {
      const denied = guard();
      if (denied) return denied;
      const def = CONTENT_KIND_BY_ID[kind];
      const original = originalOf(kind, id);
      if (!def || !original) return 'That record is no longer in the app';
      const checked = checkFields(original, fields, def.imageFields, isImageRef);
      if (!checked.fields) return checked.error ?? 'Check the fields and try again';
      putEntry(kind, id, { fields: checked.fields, hidden: get().content.entries[entryKey(kind, id)]?.hidden });
      audit('content.entry', entryKey(kind, id), Object.keys(checked.fields).join(', ') || '(no changes)');
      return null;
    },

    setContentHidden: (kind, id, hidden) => {
      const denied = guard();
      if (denied) return denied;
      const def = CONTENT_KIND_BY_ID[kind];
      if (!def || !originalOf(kind, id)) return 'That record is no longer in the app';
      if (hidden && !def.hideable) return 'Categories can’t be hidden here. Switch their services off in Features instead.';
      putEntry(kind, id, { fields: get().content.entries[entryKey(kind, id)]?.fields ?? {}, hidden: hidden || undefined });
      audit(hidden ? 'content.hide' : 'content.show', entryKey(kind, id));
      return null;
    },

    restoreContentEntry: (kind, id) => {
      const denied = guard();
      if (denied) return denied;
      putEntry(kind, id, { fields: {} });
      audit('content.entry.restore', entryKey(kind, id));
      return null;
    },

    setHomeOrder: (order) => {
      const denied = guard();
      if (denied) return denied;
      const valid = new Set([...HOME_SECTION_IDS, ...get().content.banners.map((b) => bannerSectionId(b.id))]);
      const clean = [...new Set(order)].filter((id) => valid.has(id));
      edit((c) => ({ ...c, home: { ...c.home, order: clean } }));
      audit('content.home.order', 'home', `${clean.length} sections`);
      return null;
    },

    setHomeTitle: (sectionId, title) => {
      const denied = guard();
      if (denied) return denied;
      if (!HOME_SECTION_BY_ID[sectionId]?.title) return 'This section has no heading to rename';
      const value = title.trim();
      if (value.length > 60) return 'Keep the heading under 60 characters';
      edit((c) => {
        const titles = { ...c.home.titles };
        if (value) titles[sectionId] = value;
        else delete titles[sectionId];
        return { ...c, home: { ...c.home, titles } };
      });
      audit('content.home.title', sectionId, value || '(restored)');
      return null;
    },

    saveBanner: (input) => {
      const denied = guard();
      if (denied) return { error: denied };
      const current = get().content.banners;
      const existing = input.id ? current.find((b) => b.id === input.id) : undefined;
      if (input.id && !existing) return { error: 'Banner not found' };
      if (!existing && current.length >= MAX_BANNERS) return { error: `Keep it to ${MAX_BANNERS} banners. Delete one first.` };
      const title = input.title.trim();
      const body = input.body?.trim() ?? '';
      const image = input.image?.trim() ?? '';
      const href = input.href?.trim() ?? '';
      const actionLabel = input.actionLabel?.trim() ?? '';
      if (title.length < 3) return { error: 'Write a title of at least 3 characters' };
      if (title.length > 90) return { error: 'Keep the title under 90 characters' };
      if (body.length > 300) return { error: 'Keep the text under 300 characters' };
      if (image && !isImageRef(image)) return { error: 'Pick a photo, or paste a link to one that starts with https://' };
      if (href && !LINK.test(href)) return { error: 'The link is a screen such as /venues, or a web address that starts with https://' };
      if (actionLabel.length > 30) return { error: 'Keep the button under 30 characters' };
      if (actionLabel && !href) return { error: 'Say where the button goes' };
      const banner: ContentBanner = {
        id: existing?.id ?? uid('ban'),
        title,
        body: body || undefined,
        image: image || undefined,
        actionLabel: actionLabel || undefined,
        href: href || undefined,
        active: input.active ?? existing?.active ?? true,
      };
      edit((c) => ({ ...c, banners: existing ? c.banners.map((b) => (b.id === banner.id ? banner : b)) : [banner, ...c.banners] }));
      audit(existing ? 'content.banner.update' : 'content.banner.add', banner.id, title);
      return { id: banner.id };
    },

    removeBanner: (id) => {
      const denied = guard();
      if (denied) return denied;
      if (!get().content.banners.some((b) => b.id === id)) return 'Banner not found';
      const section = bannerSectionId(id);
      edit((c) => ({ ...c, banners: c.banners.filter((b) => b.id !== id), home: { ...c.home, order: c.home.order.filter((s) => s !== section) } }));
      audit('content.banner.remove', id);
      return null;
    },

    setBrandField: (field, value) => {
      const denied = guard();
      if (denied) return denied;
      if (!BRAND_FIELDS.includes(field)) return 'Unknown detail';
      const text = value.trim();
      if (text.length > 120) return 'Keep it under 120 characters';
      if (text && field === 'supportPhone' && !/^\+?\d{7,15}$/.test(text)) return 'Enter the phone number with its country code, e.g. +9779801000000';
      if (text && field === 'supportWhatsApp' && !/^\d{7,15}$/.test(text)) return 'Enter the WhatsApp number as digits with the country code, e.g. 9779801000000';
      if (text && field === 'supportEmail' && !/^\S+@\S+\.\S+$/.test(text)) return 'Enter a valid email address';
      edit((c) => {
        const brand = { ...c.brand };
        if (text && text !== BRAND_DEFAULTS[field]) brand[field] = text;
        else delete brand[field];
        return { ...c, brand };
      });
      audit('content.brand', field, text || '(restored)');
      return null;
    },

    resetContent: (part) => {
      const denied = guard();
      if (denied) return denied;
      const blank = emptyContent();
      edit((c) => {
        if (part === 'all') return blank;
        if (part === 'banners') return { ...c, banners: [], home: { ...c.home, order: c.home.order.filter((s) => !s.startsWith('banner:')) } };
        return { ...c, [part]: blank[part] };
      });
      audit('content.reset', part);
      return null;
    },
  };
};
