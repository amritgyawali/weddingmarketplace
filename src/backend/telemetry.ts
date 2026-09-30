/**
 * Product analytics and error reports (master plan §14), without SDKs:
 *
 *   PostHog  screens, a few product events and JavaScript errors ($exception),
 *            in every build once EXPO_PUBLIC_POSTHOG_KEY is set. Batched, sent
 *            every 20 s, when 20 events are waiting, and when the app goes to
 *            the background.
 *   Sentry   errors from store and preview builds (not development), once
 *            EXPO_PUBLIC_SENTRY_DSN is set. JavaScript errors only; native
 *            crash capture needs the Sentry SDK in a development build
 *            (docs/LAUNCH.md).
 *
 * With neither key (the demo) every call is a no-op. Users can switch
 * analytics off in Settings (prefs.analytics); error reports still go, since
 * they carry no personal data. Payloads are built in telemetryPayloads.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { ENV } from '@/constants/env';

import { type PosthogEvent, posthogBatch, posthogEvent, posthogException, type Props, sentryEnvelope } from './telemetryPayloads';

const ID_KEY = 'vivah-telemetry-id';
const FLUSH_MS = 20_000;
const BATCH = 20;
/** Events kept while offline; older ones are dropped first. */
const MAX_QUEUE = 200;

const release = `${Constants.expoConfig?.slug ?? 'vivah'}@${Constants.expoConfig?.version ?? '0.0.0'}`;
const environment = __DEV__ ? 'development' : ENV.backend === 'supabase' ? 'production' : 'demo';

let queue: PosthogEvent[] = [];
let anonId: string | null = null;
let userId: string | null = null;
let analyticsOn = true;
let people: Props = {};
let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastScreen = '';

const newId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4) | 8) | 0).toString(16));

const base = (): Props => ({ $os: Platform.OS, $app_version: Constants.expoConfig?.version, $lib: 'vivah-http', environment, ...people });
const distinctId = () => userId ?? anonId ?? 'anonymous';

/** True when this build reports anywhere at all. */
export const telemetryConfigured = () => !!ENV.posthogKey || (!!ENV.sentryDsn && !__DEV__);

function enqueue(event: PosthogEvent) {
  if (!ENV.posthogKey) return;
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= BATCH) void flush();
}

/** Sends waiting events; they go back in the queue if the network fails. */
export async function flush() {
  if (!ENV.posthogKey || !queue.length) return;
  const sending = queue;
  queue = [];
  try {
    const res = await fetch(`${ENV.posthogHost.replace(/\/$/, '')}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posthogBatch(ENV.posthogKey, sending)),
    });
    if (!res.ok && res.status >= 500) queue = [...sending, ...queue].slice(-MAX_QUEUE);
  } catch {
    queue = [...sending, ...queue].slice(-MAX_QUEUE);
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface RNErrorUtils {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

/** Starts the flush timer and catches uncaught errors. Safe to call more than once. */
export function startTelemetry() {
  if (started || !telemetryConfigured()) return;
  started = true;
  AsyncStorage.getItem(ID_KEY)
    .then(async (stored) => {
      anonId = stored ?? newId();
      if (!stored) await AsyncStorage.setItem(ID_KEY, anonId);
      // Events captured before the id loaded were queued under 'anonymous'.
      queue = queue.map((e) => (e.properties.distinct_id === 'anonymous' ? { ...e, properties: { ...e.properties, distinct_id: distinctId() } } : e));
    })
    .catch(() => {
      anonId = newId();
    });

  timer = setInterval(() => void flush(), FLUSH_MS);
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flush();
  });

  const errorUtils = (globalThis as { ErrorUtils?: RNErrorUtils }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      reportError(error, { fatal: !!isFatal, handled: false });
      // A fatal error closes the app; try to get the report out first.
      if (isFatal) void flush();
      previous(error, isFatal);
    });
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => reportError(e.error ?? e.message, { handled: false }));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { handled: false }));
  }
}

/** Stops the timer (tests and hot reload). */
export function stopTelemetry() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

/** Who is using the app: the account id and persona fields only, never contact details. */
export function identify(account: { id: string; role: string; staffRole?: string; primaryService?: string; primarySkill?: string } | null) {
  if (!account) {
    userId = null;
    people = {};
    return;
  }
  if (userId === account.id) return;
  const previous = distinctId();
  userId = account.id;
  people = { role: account.role, staff_role: account.staffRole, trade: account.primaryService, craft: account.primarySkill };
  if (analyticsOn) enqueue(posthogEvent('$identify', account.id, { ...base(), $anon_distinct_id: previous }));
}

/** Follows the user's Settings choice; errors are still reported when it is off. */
export function setAnalyticsEnabled(on: boolean) {
  analyticsOn = on;
  if (!on) queue = queue.filter((e) => e.event === '$exception');
}

/** A product event, e.g. capture('plan_submitted', { occasion: 'WEDDING' }). */
export function capture(event: string, props: Props = {}) {
  if (!analyticsOn) return;
  enqueue(posthogEvent(event, distinctId(), { ...base(), ...props }));
}

/** A screen view, by route pattern (see routeName). */
export function screen(name: string) {
  if (!analyticsOn || name === lastScreen) return;
  lastScreen = name;
  enqueue(posthogEvent('$screen', distinctId(), { ...base(), $screen_name: name }));
}

/** An error, to PostHog (all builds) and Sentry (store and preview builds). */
export function reportError(error: unknown, opts: { fatal?: boolean; handled?: boolean; where?: string } = {}) {
  if (!telemetryConfigured()) return;
  enqueue(posthogException(error, distinctId(), { ...base(), where: opts.where, fatal: opts.fatal }, opts.handled ?? false));
  if (ENV.sentryDsn && !__DEV__) {
    const envelope = sentryEnvelope(ENV.sentryDsn, error, {
      release,
      environment,
      platform: Platform.OS,
      userId: userId ?? undefined,
      fatal: opts.fatal,
      handled: opts.handled,
      tags: { role: people.role as string | undefined, where: opts.where },
    });
    if (envelope) fetch(envelope.url, { method: 'POST', headers: { 'Content-Type': 'application/x-sentry-envelope' }, body: envelope.body }).catch(() => {});
  }
}
