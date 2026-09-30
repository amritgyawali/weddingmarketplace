/**
 * What the app sends to PostHog and Sentry, built as plain data (master plan
 * §14). No SDKs: both accept events over HTTP, which keeps the app in Expo Go
 * (AGENTS.md: no native libraries without the owner's approval) and costs no
 * bundle size. Pure functions, so `npm run test:telemetry` checks them in Node.
 *
 * Nothing personal goes out: the account id and persona fields only, never a
 * name, email or phone number, and routes are sent as patterns (/rsvp/[code]),
 * never with the ids or codes filled in.
 */

export interface StackFrame {
  function?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

export type Props = Record<string, string | number | boolean | null | undefined>;

export interface PosthogEvent {
  event: string;
  properties: Record<string, unknown> & { distinct_id: string };
  timestamp: string;
}

export interface ErrorInfo {
  type: string;
  message: string;
  frames: StackFrame[];
}

// "at fn (file:1:2)" (V8/Hermes), "fn@file:1:2" (JavaScriptCore/Firefox).
const V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/;

/** Stack frames, oldest call first (Sentry's order), at most 50. */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const m = V8.exec(line) ?? GECKO.exec(line);
    if (!m) continue;
    const filename = m[2];
    frames.push({
      function: m[1] || undefined,
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/node_modules|native code|\[native/.test(filename),
    });
  }
  return frames.slice(0, 50).reverse();
}

/** Any thrown value as a type, message and frames. */
export function describeError(error: unknown): ErrorInfo {
  if (error instanceof Error) return { type: error.name || 'Error', message: error.message || String(error), frames: parseStack(error.stack) };
  if (typeof error === 'string') return { type: 'Error', message: error, frames: [] };
  let message = 'Unknown error';
  try {
    message = JSON.stringify(error) ?? message;
  } catch {
    // circular values keep the default
  }
  return { type: 'Error', message, frames: [] };
}

/**
 * A screen's name from Expo Router's segments: the file pattern, so dynamic
 * values (quote ids, RSVP codes, website slugs) never leave the device.
 * Groups like (tabs) are dropped.
 */
export function routeName(segments: readonly string[]): string {
  const parts = segments.filter((s) => !/^\(.*\)$/.test(s));
  return `/${parts.join('/')}`;
}

/** Drops empty values so events stay small. */
const clean = (props: Props): Props => Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export function posthogEvent(event: string, distinctId: string, props: Props = {}, at = new Date()): PosthogEvent {
  return { event, properties: { ...clean(props), distinct_id: distinctId }, timestamp: at.toISOString() };
}

/** PostHog's own shape for errors ($exception), so they show in Error tracking. */
export function posthogException(error: unknown, distinctId: string, props: Props = {}, handled = false, at = new Date()): PosthogEvent {
  const info = describeError(error);
  return {
    event: '$exception',
    properties: {
      ...clean(props),
      distinct_id: distinctId,
      $exception_list: [{ type: info.type, value: info.message, mechanism: { handled, synthetic: false }, stacktrace: { type: 'raw', frames: info.frames } }],
    },
    timestamp: at.toISOString(),
  };
}

/** The body for POST {host}/batch/. */
export const posthogBatch = (apiKey: string, events: PosthogEvent[]) => ({ api_key: apiKey, batch: events });

export interface Dsn {
  key: string;
  host: string;
  projectId: string;
  protocol: string;
}

/** https://<key>@<host>/<project id>, or null when it isn't a DSN. */
export function parseDsn(dsn: string | undefined): Dsn | null {
  const m = dsn ? /^(https?):\/\/([^@/]+)@([^/]+)\/(?:.*\/)?(\d+)\/?$/.exec(dsn.trim()) : null;
  return m ? { protocol: m[1], key: m[2], host: m[3], projectId: m[4] } : null;
}

export interface SentryContext {
  release: string;
  environment: string;
  platform: string;
  userId?: string;
  tags?: Record<string, string | undefined>;
  fatal?: boolean;
  handled?: boolean;
}

const hex32 = (random: () => number) => Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16)).join('');

/** One error as a Sentry envelope: where to POST it and the body. */
export function sentryEnvelope(dsnText: string, error: unknown, ctx: SentryContext, at = new Date(), random = Math.random): { url: string; body: string } | null {
  const dsn = parseDsn(dsnText);
  if (!dsn) return null;
  const info = describeError(error);
  const eventId = hex32(random);
  const event = {
    event_id: eventId,
    timestamp: at.getTime() / 1000,
    platform: 'javascript',
    level: ctx.fatal ? 'fatal' : 'error',
    release: ctx.release,
    environment: ctx.environment,
    tags: { os: ctx.platform, ...Object.fromEntries(Object.entries(ctx.tags ?? {}).filter(([, v]) => !!v)) },
    user: ctx.userId ? { id: ctx.userId } : undefined,
    exception: { values: [{ type: info.type, value: info.message, stacktrace: info.frames.length ? { frames: info.frames } : undefined, mechanism: { type: 'generic', handled: ctx.handled ?? false } }] },
  };
  const body = [JSON.stringify({ event_id: eventId, sent_at: at.toISOString(), dsn: dsnText.trim() }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n') + '\n';
  return { url: `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_key=${dsn.key}&sentry_version=7`, body };
}
