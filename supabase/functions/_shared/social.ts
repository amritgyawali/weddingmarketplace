/**
 * Social hub logic shared by social-oauth, social-webhook, social-send and
 * social-publish (no dependencies, tested in Node by npm run test:functions):
 * the networks' consent URLs, a signed OAuth state, webhook signatures (Meta's
 * X-Hub-Signature-256 and TikTok's TikTok-Signature), turning webhook payloads
 * into one event shape, the reply window, the reply request for each network,
 * and publishing one post to Facebook, Instagram, WhatsApp or TikTok.
 *
 * APIs: Meta Graph API (Pages, Instagram content publishing and messaging,
 * WhatsApp Cloud API) and TikTok's Login Kit, Content Posting API and API for
 * Business (comment replies).
 */

/** The networks the hub connects. */
export type Network = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';
/** Every network id. */
export const NETWORKS: Network[] = ['facebook', 'instagram', 'whatsapp', 'tiktok'];
/** True for a known network id. */
export const isNetwork = (x: unknown): x is Network => typeof x === 'string' && (NETWORKS as string[]).includes(x);

/** Facebook Login permissions asked for each Meta network. */
export const META_SCOPES: Record<Exclude<Network, 'tiktok'>, string[]> = {
  facebook: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_messaging', 'pages_manage_engagement'],
  instagram: ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'instagram_manage_comments', 'business_management'],
  whatsapp: ['whatsapp_business_messaging', 'whatsapp_business_management', 'business_management'],
};
/** TikTok Login Kit scopes. */
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.stats', 'video.publish', 'video.list'];

/** TikTok Open API base URL. */
export const TIKTOK_API = 'https://open.tiktokapis.com';
/** TikTok API for Business base URL (comment replies). */
export const TIKTOK_BUSINESS_API = 'https://business-api.tiktok.com/open_api/v1.3';
/** Meta Graph API base URL for a version. */
export const graphBase = (version = 'v21.0') => `https://graph.facebook.com/${version}`;

// ─── Encoding and HMAC ──────────────────────────────────────────────────────────

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** HMAC-SHA256 of a message, as hex. */
export const hmacHex = async (secret: string, message: string) => hex(await hmac(secret, message));

const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// ─── OAuth ──────────────────────────────────────────────────────────────────────

/** What the signed OAuth state carries. */
export interface OAuthState {
  /** Supabase user id of the business owner connecting. */
  u: string;
  n: Network;
  /** Where to send the browser afterwards. */
  r: string;
  /** Expiry, ms since epoch. */
  exp: number;
}

/** A tamper-proof state for the consent round trip: base64url(JSON).base64url(HMAC). */
export async function signState(state: OAuthState, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(state)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

/** The state if the signature matches and it hasn't expired, else null. */
export async function readState(token: string | null, secret: string, nowMs = Date.now()): Promise<OAuthState | null> {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!sameText(sig, b64url(await hmac(secret, body)))) return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(fromB64url(body))) as OAuthState;
    return state.exp > nowMs && isNetwork(state.n) ? state : null;
  } catch {
    return null;
  }
}

/** The network's consent page. Facebook Login covers Facebook, Instagram and WhatsApp; TikTok has its own. */
export function authorizeUrl(network: Network, cfg: { metaAppId?: string; metaConfigId?: string; tiktokClientKey?: string; graphVersion?: string }, redirectUri: string, state: string): string | null {
  if (network === 'tiktok') {
    if (!cfg.tiktokClientKey) return null;
    const q = new URLSearchParams({ client_key: cfg.tiktokClientKey, scope: TIKTOK_SCOPES.join(','), response_type: 'code', redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }
  if (!cfg.metaAppId) return null;
  const q = new URLSearchParams({ client_id: cfg.metaAppId, redirect_uri: redirectUri, state, response_type: 'code', scope: META_SCOPES[network].join(',') });
  // WhatsApp Embedded Signup uses a Facebook Login for Business configuration.
  if (network === 'whatsapp' && cfg.metaConfigId) q.set('config_id', cfg.metaConfigId);
  return `https://www.facebook.com/${cfg.graphVersion ?? 'v21.0'}/dialog/oauth?${q}`;
}

/** Return addresses the consent round trip may send the browser back to. */
export function allowedReturn(url: unknown, appUrl: string, extraHosts: string[] = []): url is string {
  if (typeof url !== 'string' || url.length > 500) return false;
  if (/^(vivah|exp|exps):\/\//.test(url)) return true;
  try {
    const u = new URL(url);
    const app = new URL(appUrl);
    return (u.protocol === 'https:' && (u.host === app.host || extraHosts.includes(u.host))) || (u.protocol === 'http:' && u.hostname === 'localhost');
  } catch {
    return false;
  }
}

/** Adds query values to a return address (custom schemes included). */
export function withQuery(url: string, values: Record<string, string>): string {
  const q = new URLSearchParams(values).toString();
  return `${url}${url.includes('?') ? '&' : '?'}${q}`;
}

// ─── Webhooks ───────────────────────────────────────────────────────────────────

/** Meta signs the raw body with the app secret: `X-Hub-Signature-256: sha256=<hex>`. */
export async function verifyMetaSignature(raw: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;
  return sameText(header.slice(7).toLowerCase(), await hmacHex(appSecret, raw));
}

/** TikTok signs `<timestamp>.<raw body>` with the client secret: `TikTok-Signature: t=<ts>,s=<hex>`. */
export async function verifyTikTokSignature(raw: string, header: string | null, clientSecret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!parts.s || !Number.isFinite(t) || Math.abs(nowSec - t) > toleranceSec) return false;
  return sameText(parts.s.toLowerCase(), await hmacHex(clientSecret, `${parts.t}.${raw}`));
}

/** One inbound happening, in the shape vivah_social_ingest takes. */
export interface InboundEvent {
  type: 'message' | 'comment' | 'status';
  network?: Network;
  /** Our side: page id, Instagram user id or WhatsApp phone number id. */
  account?: string;
  /** The network's message or comment id. */
  id: string;
  contact?: string;
  contactName?: string;
  contactHandle?: string;
  contactPhone?: string;
  text?: string;
  media?: { kind: 'image' | 'video'; uri?: string }[];
  postId?: string;
  commentId?: string;
  postCaption?: string;
  at?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

/** The parts of Meta's webhook payloads read here (Messenger, Instagram, WhatsApp Cloud API). Everything is optional: payloads are read defensively. */
interface MetaAttachment {
  type?: string;
  payload?: { url?: string };
}
interface MetaMessaging {
  sender?: { id?: string };
  timestamp?: number;
  message?: { mid: string; text?: string; is_echo?: boolean; attachments?: MetaAttachment[] };
  delivery?: { mids?: string[] };
}
interface WaMessage {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
}
interface MetaChangeValue {
  item?: string;
  verb?: string;
  comment_id?: string;
  post_id?: string;
  message?: string;
  created_time?: number | string;
  from?: { id?: string; name?: string; username?: string };
  id?: string;
  text?: string;
  media?: { id?: string };
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
  statuses?: { id: string; status: string }[];
}
/** Meta webhook payload (the parts read). */
export interface MetaWebhook {
  object?: string;
  entry?: { id?: string; time?: number; messaging?: MetaMessaging[]; changes?: { field?: string; value?: MetaChangeValue }[] }[];
}
/** TikTok webhook payload (the parts read). */
export interface TikTokWebhook {
  event?: string;
  content?: string | { publish_id?: string; reason?: string };
}
/** What the networks answer to API calls (the fields read here). */
interface NetJson {
  id?: string;
  post_id?: string;
  message_id?: string;
  status_code?: string;
  permalink?: string;
  messages?: { id?: string }[];
  data?: { publish_id?: string; comment_id?: string; reply_id?: string };
  error?: { code?: number | string; message?: string; error_user_msg?: string };
  message?: string;
}

const iso = (msOrSec: number | string | undefined) => {
  if (msOrSec === undefined) return undefined;
  const n = Number(msOrSec);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const d = Date.parse(String(msOrSec));
  return Number.isFinite(d) ? new Date(d).toISOString() : undefined;
};

const attachments = (list: MetaAttachment[] | undefined) =>
  (list ?? []).filter((a) => a?.type === 'image' || a?.type === 'video').map((a) => ({ kind: a.type === 'video' ? ('video' as const) : ('image' as const), uri: a.payload?.url }));

/** Messenger, Instagram and WhatsApp Cloud API webhook payloads → events. Our own echoes and comments are dropped. */
export function parseMetaWebhook(body: MetaWebhook | null | undefined): InboundEvent[] {
  const out: InboundEvent[] = [];
  const object = body?.object;
  for (const entry of body?.entry ?? []) {
    if (object === 'page' || object === 'instagram') {
      const network: Network = object === 'page' ? 'facebook' : 'instagram';
      for (const m of entry.messaging ?? []) {
        if (m.message && !m.message.is_echo) {
          const media = attachments(m.message.attachments);
          const text = m.message.text ?? (media.length ? (media[0].kind === 'video' ? 'Sent a video' : 'Sent a photo') : '');
          if (text) out.push({ type: 'message', network, account: String(entry.id), id: m.message.mid, contact: String(m.sender?.id), text, media, at: iso(m.timestamp) });
        }
        for (const mid of m.delivery?.mids ?? []) out.push({ type: 'status', id: mid, status: 'delivered' });
      }
      for (const c of entry.changes ?? []) {
        const v: MetaChangeValue = c.value ?? {};
        if (network === 'facebook' && c.field === 'feed' && v.item === 'comment' && v.verb === 'add' && v.comment_id && String(v.from?.id) !== String(entry.id)) {
          out.push({ type: 'comment', network, account: String(entry.id), id: v.comment_id, commentId: v.comment_id, contact: String(v.from?.id), contactName: v.from?.name, text: v.message, postId: v.post_id, at: iso(v.created_time) });
        }
        if (network === 'instagram' && c.field === 'comments' && v.id && String(v.from?.id) !== String(entry.id)) {
          out.push({ type: 'comment', network, account: String(entry.id), id: v.id, commentId: v.id, contact: String(v.from?.id), contactName: v.from?.username, contactHandle: v.from?.username ? `@${v.from.username}` : undefined, text: v.text, postId: v.media?.id, at: iso(entry.time) });
        }
      }
    }
    if (object === 'whatsapp_business_account') {
      for (const c of entry.changes ?? []) {
        const v: MetaChangeValue = c.value ?? {};
        const phoneId = v.metadata?.phone_number_id;
        const names = new Map((v.contacts ?? []).map((x) => [String(x.wa_id), x.profile?.name]));
        for (const m of v.messages ?? []) {
          const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.image?.caption ?? m.video?.caption ?? (m.type === 'image' ? 'Sent a photo' : m.type === 'video' ? 'Sent a video' : m.type === 'audio' ? 'Sent a voice message' : '');
          if (!text) continue;
          const from = String(m.from);
          out.push({ type: 'message', network: 'whatsapp', account: String(phoneId), id: m.id, contact: from, contactName: names.get(from) ?? `+${from}`, contactHandle: `+${from}`, contactPhone: from.replace(/^977/, ''), text, at: iso(m.timestamp) });
        }
        for (const s of v.statuses ?? []) if (s.status === 'sent' || s.status === 'delivered' || s.status === 'read' || s.status === 'failed') out.push({ type: 'status', id: s.id, status: s.status });
      }
    }
  }
  return out;
}

/** TikTok webhook → how a post TikTok was pulling went. */
export function parseTikTokWebhook(body: TikTokWebhook | null | undefined): { publishId: string; status: 'published' | 'failed'; error?: string }[] {
  const event = String(body?.event ?? '');
  if (!event.startsWith('post.publish.')) return [];
  let content: { publish_id?: string; reason?: string } | undefined;
  try {
    content = typeof body?.content === 'string' ? JSON.parse(body.content) : body?.content;
  } catch {
    return [];
  }
  const publishId = content?.publish_id;
  if (!publishId) return [];
  if (event === 'post.publish.failed') return [{ publishId, status: 'failed', error: content?.reason ?? 'TikTok could not publish this post' }];
  if (event === 'post.publish.complete' || event === 'post.publish.publicly_available') return [{ publishId, status: 'published' }];
  return [];
}

// ─── Replies ────────────────────────────────────────────────────────────────────

/** Same rule as the app (src/services/social.ts replyWindow). */
export function replyWindowState(network: Network, kind: 'message' | 'comment', lastInboundAt: string | null, nowMs = Date.now()): 'open' | 'human_agent' | 'template' | 'closed' {
  if (kind === 'comment' || network === 'tiktok' || !lastInboundAt) return 'open';
  const hours = (nowMs - Date.parse(lastInboundAt)) / 3_600_000;
  if (hours < 24) return 'open';
  if (network !== 'whatsapp' && hours < 7 * 24) return 'human_agent';
  return network === 'whatsapp' ? 'template' : 'closed';
}

/** Everything needed to send one reply on its network. */
export interface ReplyInput {
  network: Network;
  kind: 'message' | 'comment';
  accountExternalId: string;
  contact: string;
  commentId?: string | null;
  postId?: string | null;
  text: string;
  token: string;
  meta?: Record<string, string>;
  humanAgent?: boolean;
  template?: { name: string; language: string; params: string[] } | null;
}

/** A request to a network, built without sending it (testable). */
export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

const jsonPost = (url: string, token: string, body: unknown, header = 'Authorization'): HttpRequest => ({
  url,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', [header]: header === 'Authorization' ? `Bearer ${token}` : token },
  body: JSON.stringify(body),
});

/** The one HTTP request that sends a reply on its network. */
export function replyRequest(input: ReplyInput, graphVersion = 'v21.0'): HttpRequest {
  const graph = graphBase(graphVersion);
  const { network, kind, token } = input;
  if (kind === 'comment') {
    if (network === 'facebook') return jsonPost(`${graph}/${input.commentId}/comments`, token, { message: input.text });
    if (network === 'instagram') return jsonPost(`${graph}/${input.commentId}/replies`, token, { message: input.text });
    if (network === 'tiktok') return jsonPost(`${TIKTOK_BUSINESS_API}/business/comment/reply/create/`, token, { business_id: input.accountExternalId, video_id: input.postId, comment_id: input.commentId, text: input.text }, 'Access-Token');
  }
  if (network === 'whatsapp') {
    const body = input.template
      ? { messaging_product: 'whatsapp', recipient_type: 'individual', to: input.contact, type: 'template', template: { name: input.template.name, language: { code: input.template.language }, components: [{ type: 'body', parameters: input.template.params.map((text) => ({ type: 'text', text })) }] } }
      : { messaging_product: 'whatsapp', recipient_type: 'individual', to: input.contact, type: 'text', text: { body: input.text, preview_url: false } };
    return jsonPost(`${graph}/${input.accountExternalId}/messages`, token, body);
  }
  // Messenger and Instagram messages go through the page.
  const pageId = input.meta?.pageId ?? input.accountExternalId;
  return jsonPost(`${graph}/${pageId}/messages`, token, {
    recipient: { id: input.contact },
    messaging_type: input.humanAgent ? 'MESSAGE_TAG' : 'RESPONSE',
    ...(input.humanAgent ? { tag: 'HUMAN_AGENT' } : {}),
    message: { text: input.text },
  });
}

/** The id the network gave the reply. */
export function replyId(network: Network, json: NetJson | null | undefined): string | undefined {
  if (network === 'whatsapp') return json?.messages?.[0]?.id;
  if (network === 'tiktok') return json?.data?.comment_id ?? json?.data?.reply_id;
  return json?.message_id ?? json?.id;
}

/** The network's own words when it refuses. */
export function networkError(json: NetJson | null | undefined, status: number): string {
  return json?.error?.error_user_msg || json?.error?.message || json?.message || `Request failed (${status})`;
}

/** True when the answer is a refusal. TikTok answers every call with an `error` object whose code is "ok" on success. */
export const refusedBy = (res: { ok: boolean }, json: NetJson) => !res.ok || (json.error !== undefined && json.error.code !== undefined && json.error.code !== 'ok');

// ─── Publishing ─────────────────────────────────────────────────────────────────

/** A public photo or video URL the network can fetch. */
export interface PublishMedia {
  kind: 'image' | 'video';
  url: string;
}

/** The post as one network receives it. */
export interface PublishPost {
  id: string;
  caption: string;
  media: PublishMedia[];
  link?: string | null;
  firstComment?: string | null;
}

/** The connected account a post goes to, with its token. */
export interface PublishTarget {
  network: Network;
  accountExternalId: string;
  handle?: string;
  token: string;
  meta?: Record<string, string>;
}

/** Per-deployment publishing settings (Graph version, TikTok privacy, WhatsApp template and contacts). */
export interface PublishOptions {
  graphVersion?: string;
  /** TikTok privacy until the app passes TikTok's audit: SELF_ONLY. */
  tiktokPrivacy?: string;
  /** Approved WhatsApp marketing template with an image header and one body parameter. */
  whatsappTemplate?: string;
  whatsappLanguage?: string;
  /** wa_ids of customers who agreed to broadcasts. */
  whatsappContacts?: string[];
  /** Waits between status checks for Instagram videos (injectable for tests). */
  sleep?: (ms: number) => Promise<void>;
}

/** How one network took a post. */
export interface PublishResult {
  /** `publishing`: the network finishes later and tells us by webhook (TikTok). */
  status: 'published' | 'publishing' | 'failed';
  externalId?: string;
  url?: string;
  error?: string;
}

type Http = (url: string, init: RequestInit) => Promise<Response>;

class NetworkRefused extends Error {}

async function call(http: Http, req: HttpRequest): Promise<NetJson> {
  const res = await http(req.url, { method: req.method, headers: req.headers, body: req.body });
  const json = ((await res.json().catch(() => ({}))) ?? {}) as NetJson;
  if (refusedBy(res, json)) throw new NetworkRefused(networkError(json, res.status));
  return json;
}

/** The id a call returned; a missing one counts as a refusal. */
async function idFrom(http: Http, req: HttpRequest, key: 'id' | 'post_id' = 'id'): Promise<string> {
  const value = (await call(http, req))[key];
  if (!value) throw new NetworkRefused('The network did not return an id');
  return value;
}

const get = (url: string, token: string): HttpRequest => ({ url, method: 'GET', headers: { Authorization: `Bearer ${token}` } });

/** Publishes one post to one network, following that network's own steps. Never throws. */
export async function publishTo(target: PublishTarget, post: PublishPost, http: Http, opts: PublishOptions = {}): Promise<PublishResult> {
  const graph = graphBase(opts.graphVersion);
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const { token } = target;
  const images = post.media.filter((m) => m.kind === 'image');
  const video = post.media.find((m) => m.kind === 'video');
  try {
    if (target.network === 'facebook') {
      const page = target.accountExternalId;
      let id: string;
      if (video) id = await idFrom(http, jsonPost(`${graph}/${page}/videos`, token, { file_url: video.url, description: post.caption }));
      else if (images.length === 1) id = await idFrom(http, jsonPost(`${graph}/${page}/photos`, token, { url: images[0].url, caption: post.caption }), 'post_id');
      else if (images.length > 1) {
        const ids: string[] = [];
        for (const img of images) ids.push(await idFrom(http, jsonPost(`${graph}/${page}/photos`, token, { url: img.url, published: false })));
        id = await idFrom(http, jsonPost(`${graph}/${page}/feed`, token, { message: post.caption, attached_media: ids.map((media_fbid) => ({ media_fbid })) }));
      } else id = await idFrom(http, jsonPost(`${graph}/${page}/feed`, token, { message: post.caption, ...(post.link ? { link: post.link } : {}) }));
      if (post.firstComment) await call(http, jsonPost(`${graph}/${id}/comments`, token, { message: post.firstComment })).catch(() => null);
      return { status: 'published', externalId: id, url: `https://www.facebook.com/${id}` };
    }

    if (target.network === 'instagram') {
      const ig = target.accountExternalId;
      if (!post.media.length) return { status: 'failed', error: 'Instagram needs a photo or video' };
      const item = (m: PublishMedia, carousel: boolean) =>
        m.kind === 'video' ? { media_type: carousel ? 'VIDEO' : 'REELS', video_url: m.url, ...(carousel ? { is_carousel_item: true } : {}) } : { image_url: m.url, ...(carousel ? { is_carousel_item: true } : {}) };
      let container: string;
      if (post.media.length === 1) container = await idFrom(http, jsonPost(`${graph}/${ig}/media`, token, { ...item(post.media[0], false), caption: post.caption }));
      else {
        const children: string[] = [];
        for (const m of post.media.slice(0, 10)) children.push(await idFrom(http, jsonPost(`${graph}/${ig}/media`, token, item(m, true))));
        container = await idFrom(http, jsonPost(`${graph}/${ig}/media`, token, { media_type: 'CAROUSEL', children: children.join(','), caption: post.caption }));
      }
      if (video) {
        for (let i = 0; i < 10; i++) {
          const state = (await call(http, get(`${graph}/${container}?fields=status_code`, token))).status_code;
          if (state === 'FINISHED') break;
          if (state === 'ERROR' || state === 'EXPIRED') return { status: 'failed', error: 'Instagram could not process the video' };
          await sleep(3000);
        }
      }
      const media = await idFrom(http, jsonPost(`${graph}/${ig}/media_publish`, token, { creation_id: container }));
      const permalink = (await call(http, get(`${graph}/${media}?fields=permalink`, token)).catch((): NetJson => ({}))).permalink;
      if (post.firstComment) await call(http, jsonPost(`${graph}/${media}/comments`, token, { message: post.firstComment })).catch(() => null);
      return { status: 'published', externalId: media, url: permalink };
    }

    if (target.network === 'whatsapp') {
      const to = opts.whatsappContacts ?? [];
      if (!opts.whatsappTemplate) return { status: 'failed', error: 'Set WHATSAPP_BROADCAST_TEMPLATE to an approved template first' };
      if (!to.length) return { status: 'failed', error: 'No customers have agreed to WhatsApp updates yet' };
      const header = images[0] ? [{ type: 'header', parameters: [{ type: 'image', image: { link: images[0].url } }] }] : [];
      let sent = 0;
      let lastError = '';
      for (const wa of to) {
        try {
          await call(http, jsonPost(`${graph}/${target.accountExternalId}/messages`, token, {
            messaging_product: 'whatsapp',
            to: wa,
            type: 'template',
            template: { name: opts.whatsappTemplate, language: { code: opts.whatsappLanguage ?? 'en' }, components: [...header, { type: 'body', parameters: [{ type: 'text', text: post.caption.slice(0, 1024) }] }] },
          }));
          sent++;
        } catch (e) {
          lastError = (e as Error).message;
        }
      }
      return sent ? { status: 'published', externalId: `broadcast:${post.id}:${sent}` } : { status: 'failed', error: lastError || 'WhatsApp refused the broadcast' };
    }

    // TikTok: TikTok pulls the files from our URLs and tells us by webhook when the post is live.
    if (!post.media.length) return { status: 'failed', error: 'TikTok needs a photo or video' };
    const privacy = opts.tiktokPrivacy ?? 'SELF_ONLY';
    const req = video
      ? jsonPost(`${TIKTOK_API}/v2/post/publish/video/init/`, token, { post_info: { title: post.caption.slice(0, 2200), privacy_level: privacy, disable_comment: false }, source_info: { source: 'PULL_FROM_URL', video_url: video.url } })
      : jsonPost(`${TIKTOK_API}/v2/post/publish/content/init/`, token, {
          post_info: { title: post.caption.split('\n')[0].slice(0, 90), description: post.caption.slice(0, 4000), privacy_level: privacy, disable_comment: false, auto_add_music: true },
          source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: images.slice(0, 35).map((m) => m.url) },
          post_mode: 'DIRECT_POST',
          media_type: 'PHOTO',
        });
    const json = await call(http, req);
    return { status: 'publishing', externalId: json.data?.publish_id };
  } catch (e) {
    return { status: 'failed', error: e instanceof NetworkRefused ? e.message : 'Could not reach the network. Try again.' };
  }
}

/** A post's media as public URLs: uploaded files are Cloudinary public ids, others already URLs. */
export function mediaUrls(media: { kind?: string; publicId?: string; uri?: string }[], cloudName?: string): PublishMedia[] {
  return media
    .map((m) => {
      const kind = m.kind === 'video' ? ('video' as const) : ('image' as const);
      if (m.publicId && cloudName) return { kind, url: `https://res.cloudinary.com/${cloudName}/${kind}/upload/t_full/${m.publicId}` };
      return m.uri && /^https:\/\//.test(m.uri) ? { kind, url: m.uri } : null;
    })
    .filter((m): m is PublishMedia => !!m);
}
