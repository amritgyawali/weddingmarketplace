# 23. Content studio (super admin)

As of 12 Oct 2026. Super admins can change what the app shows without a release: replace any photo, edit any listing, arrange the couple's home, add banners and change brand details. Screens: `/platform/admin/content` (tabs Brand, Home, Listings, Photos) and `/platform/admin/content/[kind]`, linked from Platform → More → Super admin.

## 1. How it works: edits laid over the catalogue

The bundled catalogue (venues, vendors, categories, ideas, stories…) is never changed. A single persisted object, `DbData.content` (`AppContent`, `types/content.ts`), holds only the **differences**: replacement photos (`images`), per-record field edits and hidden flags (`entries`, keyed `kind:id` by `entryKey`), the order and headings of home sections (`home`), banners and brand details. `services/content.ts` (pure) lays them over the bundle at read time (`patchList`, `visibleList`). Removing an edit therefore restores the original, and **Reset** (`resetContent`) is always safe.

- `contentRuntime` (in `services/content.ts`) mirrors the store for code outside React (the API layer, category helpers, `BRAND`); `hooks/useContent.ts` keeps it in sync and exposes `useContent()` and `useLiveList()`.
- `ContentSync` (root layout) refetches catalogue queries when the content changes so screens update at once.
- `data/contentCatalogue.ts` describes the editable kinds (`CONTENT_CATALOGUE`, `ContentKind`: venue, vendor, category, shortcut, collection, idea, story, realWedding) and which fields each has.

## 2. Store actions (`store/db/content.ts`)

`setContentImage`, `saveContentEntry`, `setContentHidden`, `restoreContentEntry`, `setHomeOrder`, `setHomeTitle`, `saveBanner`, `removeBanner`, `setBrandField`, `resetContent`. Each checks `admin.full` itself (`staffOnly`), validates input (`normalizeContent`, link and size limits `MAX_TEXT`, `MAX_LIST`, `MAX_BANNERS`) and writes the audit log. They return an error string or null.

## 3. Photos

`backend/contentMedia.ts` keeps a picked photo where it can be shown again: Cloudinary through `media-sign` on Supabase builds (a web address, every device sees it); the app's documents folder on a phone in the demo (`vivah-file://name.jpg`, this device only); inline for small images in a browser (`MAX_INLINE_IMAGE`), larger ones need a link.

## 4. Supabase

`0021_app_content.sql` adds one-row table `app_content` (content plus a `revision`) and RPCs: `rpc_app_config` (anyone; content, text overrides and feature switches in one answer, or the revision only when `p_known` matches), and the super admin saves `rpc_save_app_content`, `rpc_save_text_overrides`, `rpc_save_feature_flags`. Every save bumps the revision. `backend/content.ts` (`startContentSync`) asks on app open, on returning to the foreground and every 45 seconds; a super admin's device sends a changed part shortly after the edit. The demo (`mock`) never calls it. **Not deployed**; do not apply without the owner.

## 5. Rules

- Add editable fields to `CONTENT_CATALOGUE` rather than writing edits into catalogue files.
- Reading a catalogue list in a screen goes through the API layer or `useLiveList`, so hidden records and edits apply.
- Persisted since DB `version` 7 (additive; `migrate` normalises the field).
- New UI text needs its line in `src/i18n/ne/content.ts`.
