import { useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteBugReports, fetchBugReport, fetchBugReports, saveBugReportStatus } from '@/backend/bugReport';
import { toast } from '@/components/ui/Toast';
import { usesSupabase } from '@/constants/env';
import { useDb } from '@/store/useDb';
import type { BugReportRecord, BugReportStatus } from '@/types/platform';

const KEY = ['bugReports'] as const;

async function unwrap<T>(p: Promise<{ ok: true; value: T } | { ok: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

/** Bug reports for the super admin console: the server's on Supabase builds, the store's in the demo. */
export function useBugReports(): { reports: BugReportRecord[]; loading: boolean; error?: string; refresh: () => void } {
  const live = usesSupabase();
  const local = useDb((s) => s.bugReports);
  const query = useQuery({ queryKey: KEY, queryFn: () => unwrap(fetchBugReports()), enabled: live });
  if (!live) return { reports: local, loading: false, refresh: () => {} };
  return { reports: query.data ?? [], loading: query.isLoading, error: query.error?.message, refresh: () => void query.refetch() };
}

/** One report, with its screenshot. */
export function useBugReport(id: string | undefined): { report?: BugReportRecord; loading: boolean; error?: string } {
  const live = usesSupabase();
  const local = useDb((s) => s.bugReports);
  const query = useQuery({ queryKey: [...KEY, id], queryFn: () => unwrap(fetchBugReport(id!)), enabled: live && !!id });
  if (!live) return { report: local.find((r) => r.id === id), loading: false };
  return { report: query.data ?? undefined, loading: query.isLoading, error: query.error?.message };
}

/** Mark fixed / dismissed / new and delete; each resolves to an error to show, or null. */
export function useBugReportActions() {
  const live = usesSupabase();
  const qc = useQueryClient();
  const setLocal = useDb((s) => s.setBugReportStatus);
  const removeLocal = useDb((s) => s.removeBugReports);

  const setStatus = async (id: string, status: BugReportStatus, note?: string): Promise<string | null> => {
    if (!live) return setLocal(id, status, note);
    const r = await saveBugReportStatus(id, status, note);
    if (!r.ok) return r.error;
    await qc.invalidateQueries({ queryKey: KEY });
    toast('Bug report updated');
    return null;
  };

  const remove = async (ids: string[]): Promise<string | null> => {
    if (!live) return removeLocal(ids);
    const r = await deleteBugReports(ids);
    if (!r.ok) return r.error;
    await qc.invalidateQueries({ queryKey: KEY });
    toast('Bug report deleted');
    return null;
  };

  return { setStatus, remove };
}
