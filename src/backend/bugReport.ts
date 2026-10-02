/**
 * Bug reports: the payload the shake-to-report sheet sends, where it goes,
 * and the little history kept for it (recent screens, console errors).
 *
 * Reports go to the bug inbox (`scripts/bug-inbox.cjs`), which writes them
 * into the project's `bug-reports/` folder. In development the inbox runs
 * inside `npx expo start`, so the app finds it at the dev server's address;
 * an installed test build (EXPO_PUBLIC_BUG_REPORTS=on) sends to
 * `npm run bugs:inbox` at EXPO_PUBLIC_BUG_INBOX_URL, or at the address typed in
 * Settings → Help on the phone. Store builds have none of these, and the
 * feature stays hidden.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Dimensions, PixelRatio, Platform } from 'react-native';

import { ENV } from '@/constants/env';
import { BRAND } from '@/constants/brand';

import { failResult, okResult, type Result } from './types';

/** Same path as `BUG_INBOX_PATH` in scripts/bug-inbox.cjs. */
export const BUG_INBOX_PATH = '/__vivah/bug-report';

export interface BugLogLine {
  at: string;
  level: 'error' | 'warn';
  message: string;
}

export interface BugReport {
  description: string;
  /** PNG or JPEG as a data URI. */
  screenshot?: string;
  route: string;
  params: Record<string, string>;
  capturedAt: string;
  account?: { id: string; name: string; role: string; staffRole?: string };
  device: { os: string; osVersion: string; width: number; height: number; scale: number; runtime: string; userAgent?: string };
  app: { name: string; version: string; backend: string; language: string; calendar: string };
  recentRoutes: { at: string; path: string }[];
  logs: BugLogLine[];
}

const UNREACHABLE = 'Couldn’t reach the developer’s computer. Is the dev server running on the same Wi-Fi?';

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

/** Does this build offer bug reports? Development builds, and test builds with EXPO_PUBLIC_BUG_REPORTS=on or an inbox URL. */
export const bugReportsAvailable = () => __DEV__ || ENV.bugReports || !!ENV.bugInboxUrl;

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

/** Posts a report to the inbox. Resolves to the folder it was saved in. */
export async function sendBugReport(report: BugReport): Promise<Result<string>> {
  const url = bugInboxUrl();
  if (!url) return failResult('Add the bug inbox address in Settings → Help first');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...report, app: { ...report.app, name: report.app.name || BRAND.name } }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; folder?: string; error?: string } | null;
    if (!res.ok || !body?.ok) return failResult(body?.error ?? `The bug inbox answered ${res.status}`);
    return okResult(body.folder ?? '');
  } catch {
    return failResult(UNREACHABLE);
  } finally {
    clearTimeout(timer);
  }
}
