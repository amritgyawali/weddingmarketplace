/**
 * Social hub (business app): the vendor's Facebook page, Instagram profile,
 * WhatsApp Business number and TikTok account in one place. Messages and
 * comments from every network land in one inbox; one post goes out to every
 * network. Mirrors supabase/migrations/0017_social_hub.sql.
 *
 * Access tokens never live on the device: the server keeps them in
 * `social_account_secrets` (service role only) and the app only ever sees
 * the account row.
 */
import type { PhotoRef } from '@/constants/images';

/** Networks a business can connect. */
export type SocialNetwork = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

/** `expired`: the token needs renewing before replies or posts go out. */
export type SocialAccountStatus = 'connected' | 'expired' | 'disconnected';

/** A connected Facebook page, Instagram profile, WhatsApp number or TikTok account. */
export interface SocialAccount {
  id: string;
  /** The vendor account that connected it. */
  ownerId: string;
  network: SocialNetwork;
  /** @handle, page name or WhatsApp number as the network shows it. */
  handle: string;
  name: string;
  status: SocialAccountStatus;
  followers: number;
  /** Permissions granted when connecting. */
  scopes: string[];
  connectedAt: string;
  /** When the access token must be renewed (Meta long-lived tokens last about 60 days). */
  expiresAt?: string;
  lastSyncAt?: string;
}

/** A direct message conversation, or the comments one person left on a post. */
export type SocialThreadKind = 'message' | 'comment';

/** `pending`: waiting on the customer (or snoozed); `done`: nothing left to do. */
export type SocialThreadStatus = 'open' | 'pending' | 'done';

/** A photo or video attached to a post or a message. */
export interface SocialMedia {
  id: string;
  kind: 'image' | 'video';
  image?: PhotoRef;
  uri?: string;
  /** Cloudinary public id (Supabase builds): the networks fetch the file from its public URL. */
  publicId?: string;
  alt?: string;
}

/** One conversation in the unified inbox. */
export interface SocialThread {
  id: string;
  ownerId: string;
  accountId: string;
  network: SocialNetwork;
  kind: SocialThreadKind;
  contactName: string;
  contactHandle: string;
  /** WhatsApp number, or one the customer typed into a message. */
  contactPhone?: string;
  /** WhatsApp: the customer agreed to receive broadcasts (said START, or the team recorded their consent). */
  optedIn?: boolean;
  /** For comments: the post the comment is on. */
  postId?: string;
  postCaption?: string;
  status: SocialThreadStatus;
  /** A snoozed thread returns to `open` at this time. */
  snoozedUntil?: string;
  starred?: boolean;
  labels: string[];
  /** Team member handling it (name). */
  assignee?: string;
  /** CRM lead made from this conversation. */
  leadId?: string;
  unread: number;
  lastAt: string;
  /** Last message from the customer; opens the networks' 24-hour reply window. */
  lastInboundAt?: string;
  /** Minutes the first reply took (inbox response-time stats). */
  firstResponseMins?: number;
}

/** Delivery state of a reply, as the network reports it. */
export type SocialMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** A message, a comment, or an internal note in a thread. */
export interface SocialMessage {
  id: string;
  threadId: string;
  /** `note` is internal: the customer never sees it. */
  direction: 'in' | 'out' | 'note';
  text: string;
  at: string;
  /** Who wrote it: the customer, or the team member who replied. */
  author?: string;
  media?: SocialMedia[];
  status?: SocialMessageStatus;
  /** Sent by an auto-reply rule or the away message. */
  auto?: boolean;
  /** Approved WhatsApp template used outside the 24-hour window. */
  template?: string;
  error?: string;
}

/** Where a post is: draft, scheduled, publishing, published, partly published or failed. */
export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed';

/** How one network took a post, and how it did there. */
export interface SocialPostResult {
  status: 'queued' | 'publishing' | 'published' | 'failed';
  url?: string;
  error?: string;
  at?: string;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}

/** One post sent to several networks at once (now or at a set time). */
export interface SocialPost {
  id: string;
  ownerId: string;
  caption: string;
  /** Caption for one network when it should differ from the main one. */
  overrides: Partial<Record<SocialNetwork, string>>;
  media: SocialMedia[];
  networks: SocialNetwork[];
  link?: string;
  /** Posted as the first comment (hashtags, a booking link). Facebook and Instagram. */
  firstComment?: string;
  status: SocialPostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  results: Partial<Record<SocialNetwork, SocialPostResult>>;
  /** Free label to group posts ("Mangsir offer"). */
  campaign?: string;
  createdAt: string;
  updatedAt: string;
}

/** Keyword auto-reply: when an incoming message contains a keyword, reply at once. */
export interface SocialAutoRule {
  id: string;
  keywords: string[];
  reply: string;
  /** Empty means every network. */
  networks: SocialNetwork[];
  active: boolean;
  hits: number;
}

/** Saved replies, auto-replies and the away message of one business. */
export interface SocialSettings {
  savedReplies: { id: string; title: string; text: string }[];
  rules: SocialAutoRule[];
  /** Outside these hours (Nepal time, HH:MM) new conversations get the away message once. */
  away: { active: boolean; from: string; to: string; text: string };
  /** Added under every reply when set ("— Rajesh, Everest Grand"). */
  signature?: string;
}
