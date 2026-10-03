/**
 * Bug reports: the payload the shake-to-report sheet sends, where it goes,
 * and the little history kept for it (recent screens, console errors).
 *
 * Every build, for everyone (signed in or not), saves the report in the app's
 * backend, where super admins read it (Super admin → Bug reports):
 *
 *   - mock (the demo, Expo Go): the store's `bugReports`, with the screenshot
 *     as a file in the app's documents folder (`submitBugReport`);
 *   - supabase: `rpc_submit_bug_report` (supabase/migrations/0019_bug_reports.sql).
 *
 * Development and test builds also send it to the bug inbox on the
 * developer's computer (`scripts/bug-inbox.cjs`), which writes it into the
 * project's `bug-reports/` folder. In development the inbox runs inside
 * `npx expo start`, so the app finds it at the dev server's address; an
 * installed test build (EXPO_PUBLIC_BUG_REPORTS=on) sends to
 * `npm run bugs:inbox` at EXPO_PUBLIC_BUG_INBOX_URL, or at the address typed in
 * Settings → Help on the phone.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Dimensions, PixelRatio, Platform } from 'react-native';

import { BRAND } from '@/constants/brand';
import { ENV, usesSupabase } from '@/constants/env';
import { useDb } from '@/store/useDb';
import type { BugLogLine, BugReport, BugReportRecord, BugReportStatus } from '@/types/platform';
import { uid } from '@/utils/format';

import { getAccessToken } from './auth';
import { rpc } from './supabase';
import { failResult, okResult, type Result } from './types';

export type { BugLogLine, BugReport } from '@/types/platform';

/** Same path as `BUG_INBOX_PATH` in scripts/bug-inbox.cjs. */
export const BUG_INBOX_PATH = '/__vivah/bug-report';

const UNREACHABLE = 'Couldn’t reach the developer’s computer. Is the dev server running on the same Wi-Fi?';
const OFFLINE = 'No connection. Check your internet and try again.';
/** Same limit as the screenshot check in 0019_bug_reports.sql. */
const MAX_SCREENSHOT_CHARS = 3_000_000;

let deviceInbox: string | undefined;
/** The inbox address typed in Settings → Help on this device; it wins over the build's own. */
export function setDeviceBugInbox(address: string | undefined) {
  deviceInbox = address?.trim() || undefined;
}

/** `192.168.1.10:8790` → `http://192.168.1.10:8790/__vivah/bug-report`. */
const inboxAt = (address: string) => {
  let base = address.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base.endsWith(BUG_INBOX_PATH) ? base : base + BUG_INBOX_PATH;
};

/** The dev server this app was loaded from (Expo Go, development builds, `expo start --web`). */
function devServerInbox(): string | undefined {
  if (!__DEV__) return undefined;
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.origin + BUG_INBOX_PATH : undefined;
  const host = Constants.expoConfig?.hostUri;
  return host ? inboxAt(host.replace(/\/.*$/, '')) : undefined;
}

/** The address used when the device has none of its own: the dev server, else the build's EXPO_PUBLIC_BUG_INBOX_URL. */
export const defaultBugInbox = () => devServerInbox() ?? (ENV.bugInboxUrl ? inboxAt(ENV.bugInboxUrl) : undefined);

/** Where reports go, or undefined when there is nowhere to send them yet. */
export const bugInboxUrl = (): string | undefined => (deviceInbox ? inboxAt(deviceInbox) : defaultBugInbox());

/** Every build offers bug reports, to everyone: they are saved in the app's backend. A super admin can switch them off (`app.bug_report`). */
export const bugReportsAvailable = () => true;

/** Do reports also go to a developer's computer? Development builds, and test builds with EXPO_PUBLIC_BUG_REPORTS=on or an inbox URL. Settings → Help shows the inbox address only then. */
export const devInboxOffered = () => __DEV__ || ENV.bugReports || !!ENV.bugInboxUrl;

/** Checks that the inbox answers, for Settings → Help. Resolves to the address it reached. */
export async function pingBugInbox(): Promise<Result<string>> {
  const url = bugInboxUrl();
  if (!url) return failResult('Add the bug inbox address first');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok ? okResult(url) : failResult(`The bug inbox answered ${res.status}`);
  } catch {
    return failResult(UNREACHABLE);
  } finally {
    clearTimeout(timer);
  }
}

const time = () => new Date().toTimeString().slice(0, 8);
const MAX_ROUTES = 15;
const MAX_LOGS = 30;
const routes: { at: string; path: string }[] = [];
const logs: BugLogLine[] = [];

/** Remembers a visited screen for the next report. */
export function recordRoute(path: string) {
  if (routes[routes.length - 1]?.path === path) return;
  routes.push({ at: time(), path });
  if (routes.length > MAX_ROUTES) routes.shift();
}

const describe = (value: unknown): string => {
  if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack.split('\n').slice(1, 6).join('\n')}` : ''}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

let consoleCaptured = false;
/** Keeps the last console errors and warnings so a report shows what went wrong under the hood. Idempotent. */
export function captureConsole() {
  if (consoleCaptured) return;
  consoleCaptured = true;
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      logs.push({ at: time(), level, message: args.map(describe).join(' ').slice(0, 1500) });
      if (logs.length > MAX_LOGS) logs.shift();
      original(...args);
    };
  }
}

const runtime = () => {
  if (Platform.OS === 'web') return 'web browser';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'Expo Go';
  return __DEV__ ? 'development build' : 'installed build';
};

/** Device, app and history details that go with every report. */
export function reportContext(): Pick<BugReport, 'device' | 'recentRoutes' | 'logs'> & { appVersion: string } {
  const { width, height } = Dimensions.get('window');
  return {
    device: {
      os: Platform.OS,
      osVersion: String(Platform.Version ?? ''),
      width: Math.round(width),
      height: Math.round(height),
      scale: PixelRatio.get(),
      runtime: runtime(),
      userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
    appVersion: Constants.expoConfig?.version ?? '?',
    recentRoutes: routes.slice(0, -1),
    logs: [...logs],
  };
}

// Where reports are saved -------------------------------------------------------

const withName = (report: BugReport): BugReport => ({ ...report, app: { ...report.app, name: report.app.name || BRAND.name } });

/** Posts a report to the developer's bug inbox. Resolves to the folder it was saved in. */
async function postToInbox(url: string, report: BugReport): Promise<Result<string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), signal: controller.signal });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; folder?: string; error?: string } | null;
    if (!res.ok || !body?.ok) return failResult(body?.error ?? `The bug inbox answered ${res.status}`);
    return okResult(body.folder ?? '');
  } catch {
    return failResult(UNREACHABLE);
  } finally {
    clearTimeout(timer);
  }
}

const SHOTS_DIR = 'bug-reports';

/** Keeps the screenshot as a file in the app's documents folder; the store holds only its address. The web demo keeps none (its storage is too small). */
function keepScreenshotFile(dataUri: string | undefined): string | undefined {
  if (!dataUri || Platform.OS === 'web') return undefined;
  if (!dataUri.startsWith('data:')) return dataUri;
  try {
    const ext = dataUri.startsWith('data:image/png') ? 'png' : 'jpg';
    const file = new File(Paths.document, SHOTS_DIR, `${uid('shot')}.${ext}`);
    file.create({ intermediates: true, overwrite: true });
    file.write(dataUri.slice(dataUri.indexOf(',') + 1), { encoding: 'base64' });
    return file.uri;
  } catch {
    return undefined;
  }
}

/** Deletes screenshot files no saved report points at any more (older reports drop theirs). */
function pruneScreenshotFiles() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, SHOTS_DIR);
    if (!dir.exists) return;
    const kept = new Set(useDb.getState().bugReports.map((r) => r.screenshot).filter(Boolean));
    for (const item of dir.list()) if (item instanceof File && !kept.has(item.uri)) item.delete();
  } catch {
    // Housekeeping only.
  }
}

/** The demo backend: the store, on this device. */
function saveOnDevice(report: BugReport): Result<string> {
  const saved = useDb.getState().submitBugReport({ ...report, screenshot: keepScreenshotFile(report.screenshot) });
  if (!saved.id) return failResult(saved.error ?? 'The report could not be saved');
  pruneScreenshotFiles();
  return okResult(saved.id);
}

/** Supabase: rpc_submit_bug_report, as the signed-in user or signed out (the publishable key). */
async function saveOnServer(report: BugReport): Promise<Result<string>> {
  const key = ENV.supabasePublishableKey ?? '';
  const token = (await getAccessToken().catch(() => null)) ?? key;
  const payload = report.screenshot && report.screenshot.length > MAX_SCREENSHOT_CHARS ? { ...report, screenshot: undefined } : report;
  try {
    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/rpc_submit_bug_report`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_report: payload }),
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : '';
      return failResult(message || `Request failed (${res.status})`);
    }
    return okResult(String(body));
  } catch {
    return failResult(OFFLINE);
  }
}

/**
 * Sends a report: saved in the app's backend (super admin console) and, in
 * development and test builds, also posted to the developer's bug inbox.
 * Resolves once at least one of them has it.
 */
export async function sendBugReport(report: BugReport): Promise<Result<string>> {
  const full = withName(report);
  const inbox = devInboxOffered() ? bugInboxUrl() : undefined;
  const [saved, posted] = await Promise.all([usesSupabase() ? saveOnServer(full) : Promise.resolve(saveOnDevice(full)), inbox ? postToInbox(inbox, full) : Promise.resolve(null)]);
  if (saved.ok) return saved;
  if (posted?.ok) return posted;
  return failResult(saved.error);
}

// Reading them (Supabase builds; the demo reads the store) -----------------------

interface ServerBugReport extends Omit<BugReportRecord, 'resolvedBy'> {
  resolvedBy?: string | null;
}

const fromServer = (r: ServerBugReport): BugReportRecord => ({ ...r, resolvedBy: r.resolvedBy ?? undefined, params: r.params ?? {}, recentRoutes: r.recentRoutes ?? [], logs: r.logs ?? [] });

/** The newest reports without their screenshots (super admins). */
export async function fetchBugReports(limit = 200): Promise<Result<BugReportRecord[]>> {
  const r = await rpc<ServerBugReport[] | null>('rpc_list_bug_reports', { p_limit: limit });
  return r.ok ? okResult((r.value ?? []).map(fromServer)) : r;
}

/** One report with its screenshot (super admins). */
export async function fetchBugReport(id: string): Promise<Result<BugReportRecord | null>> {
  const r = await rpc<ServerBugReport | null>('rpc_get_bug_report', { p_id: id });
  return r.ok ? okResult(r.value ? fromServer(r.value) : null) : r;
}

/** Marks a report new, fixed or dismissed on the server (super admins). */
export async function saveBugReportStatus(id: string, status: BugReportStatus, note?: string): Promise<Result<void>> {
  const r = await rpc('rpc_set_bug_report_status', { p_id: id, p_status: status, p_note: note?.trim() || null });
  return r.ok ? okResult(undefined) : r;
}

/** Deletes reports on the server (super admins). */
export async function deleteBugReports(ids: string[]): Promise<Result<void>> {
  const r = await rpc('rpc_delete_bug_reports', { p_ids: ids });
  return r.ok ? okResult(undefined) : r;
}
