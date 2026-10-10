import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { startContentSync } from '@/backend/content';
import { toastError } from '@/components/ui/Toast';
import { useContent } from '@/hooks/useContent';

/**
 * Sits at the root and makes a super admin's content edits show at once:
 * catalogue queries are refetched whenever the content changes, and Supabase
 * builds keep the content in step with the server (`backend/content.ts`).
 */
export function ContentSync() {
  const queryClient = useQueryClient();
  const content = useContent();
  const shown = useRef(content);

  useEffect(() => {
    if (shown.current === content) return;
    shown.current = content;
    void queryClient.invalidateQueries();
  }, [content, queryClient]);

  useEffect(() => startContentSync(toastError), []);

  return null;
}
