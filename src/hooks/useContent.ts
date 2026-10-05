import { contentRuntime, EMPTY_CONTENT, patchList, visibleList } from '@/services/content';
import type { Db } from '@/store/useDb';
import { useDb } from '@/store/useDb';
import type { AppContent, ContentKind } from '@/types/content';

const selectContent = (s: Db): AppContent => s.content ?? EMPTY_CONTENT;

// Edits made in the super admin console reach callers outside React (the API layer, category helpers, BRAND) too.
contentRuntime.content = selectContent(useDb.getState());
useDb.subscribe((s) => {
  contentRuntime.content = selectContent(s);
});

/** The super admin's content edits; re-renders when any of them changes. */
export const useContent = () => useDb(selectContent);

/** A catalogue list with content edits applied (`all` keeps hidden records, for lookups by id). */
export function useLiveList<T extends { id: string }>(kind: ContentKind, list: readonly T[], all = false): T[] {
  const content = useContent();
  return all ? patchList(kind, list, content) : visibleList(kind, list, content);
}
