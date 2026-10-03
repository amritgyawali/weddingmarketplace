/**
 * The four networks of the social hub and what each one allows, as the
 * networks' own APIs define it (Meta Graph API for Facebook, Instagram and
 * the WhatsApp Cloud API; TikTok's Content Posting API). The publisher checks
 * posts against these limits before anything is sent, and the inbox uses the
 * reply windows. Also the WhatsApp templates and a business's starter saved
 * replies and auto-replies.
 */
import type { SocialNetwork, SocialSettings } from '@/types/platform';

/** What one network allows: limits, inbox kinds, reply window, permissions. */
export interface NetworkDef {
  id: SocialNetwork;
  label: string;
  /** Ionicons name. */
  icon: 'logo-facebook' | 'logo-instagram' | 'logo-whatsapp' | 'logo-tiktok';
  /** What a post becomes on this network. */
  postAs: string;
  /** Longest caption the network takes. */
  captionLimit: number;
  hashtagLimit?: number;
  /** The network refuses a post without a photo or video. */
  needsMedia: boolean;
  maxMedia: number;
  /** What lands in the inbox from this network. */
  inbox: ('message' | 'comment')[];
  /**
   * Hours after the customer's last message during which any reply may be
   * sent. After it: Facebook and Instagram allow a human reply for 7 days
   * (the HUMAN_AGENT tag); WhatsApp needs an approved template.
   */
  replyWindowHours?: number;
  humanAgentDays?: number;
  /** Permissions asked for when connecting. */
  scopes: string[];
  /** What connecting needs on the network's side. */
  requirement: string;
  /** Typical audience of a Nepali wedding business, for the connect sheet. */
  handleHint: string;
}

/** Facebook, Instagram, WhatsApp and TikTok, in display order. */
export const NETWORKS: NetworkDef[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    postAs: 'Page post',
    captionLimit: 63_206,
    needsMedia: false,
    maxMedia: 10,
    inbox: ['message', 'comment'],
    replyWindowHours: 24,
    humanAgentDays: 7,
    scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_messaging', 'pages_manage_engagement'],
    requirement: 'A Facebook page you manage',
    handleHint: 'Page name, e.g. Everest Grand Party Palace',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'logo-instagram',
    postAs: 'Feed post or carousel',
    captionLimit: 2_200,
    hashtagLimit: 30,
    needsMedia: true,
    maxMedia: 10,
    inbox: ['message', 'comment'],
    replyWindowHours: 24,
    humanAgentDays: 7,
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'instagram_manage_comments'],
    requirement: 'An Instagram business or creator profile linked to your Facebook page',
    handleHint: '@yourbusiness',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'logo-whatsapp',
    postAs: 'Broadcast to customers who opted in',
    captionLimit: 1_024,
    needsMedia: false,
    maxMedia: 1,
    inbox: ['message'],
    replyWindowHours: 24,
    scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    requirement: 'A WhatsApp Business number (Cloud API)',
    handleHint: '98XXXXXXXX',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: 'logo-tiktok',
    postAs: 'Photo post or video',
    captionLimit: 2_200,
    needsMedia: true,
    maxMedia: 35,
    inbox: ['comment'],
    scopes: ['user.info.basic', 'user.info.stats', 'video.publish', 'video.list'],
    requirement: 'A TikTok business account',
    handleHint: '@yourbusiness',
  },
];

/** Each permission in plain words, for the connect sheet and the accounts tab. */
export const SCOPE_TEXT: Record<string, string> = {
  pages_show_list: 'See the pages you manage',
  pages_manage_posts: 'Publish posts to your page',
  pages_read_engagement: 'Read likes, comments and reach',
  pages_messaging: 'Read and answer Messenger messages',
  pages_manage_engagement: 'Reply to comments on your page',
  instagram_basic: 'See your profile and posts',
  instagram_content_publish: 'Publish posts and carousels',
  instagram_manage_messages: 'Read and answer direct messages',
  instagram_manage_comments: 'Read and reply to comments',
  whatsapp_business_messaging: 'Send and receive WhatsApp messages',
  whatsapp_business_management: 'Use your approved message templates',
  'user.info.basic': 'See your profile name and photo',
  'user.info.stats': 'See your follower count',
  'video.publish': 'Publish photos and videos',
  'video.list': 'See your posts and their comments',
};

/** Network definitions by id. */
export const NETWORK_BY_ID =Object.fromEntries(NETWORKS.map((n) => [n.id, n])) as Record<SocialNetwork, NetworkDef>;

/** The network ids in display order. */
export const NETWORK_IDS = NETWORKS.map((n) => n.id);

/** WhatsApp message templates (approved in WhatsApp Manager) for replies after the 24-hour window. `{1}` is the customer's first name. */
export const WHATSAPP_TEMPLATES: { id: string; title: string; body: string }[] = [
  { id: 'follow_up', title: 'Follow up', body: 'Namaste {1}! Just checking in on your celebration plans. Shall we hold your date or share a fresh quotation?' },
  { id: 'quote_ready', title: 'Quotation ready', body: 'Namaste {1}, your quotation is ready. Reply here and we will send the details.' },
  { id: 'visit_reminder', title: 'Visit reminder', body: 'Namaste {1}, a reminder about your visit with us. Reply to confirm the time or pick another day.' },
];

/** Labels offered in the inbox; businesses can type their own too. */
export const SOCIAL_LABELS = ['Hot lead', 'Price asked', 'Date check', 'Booked', 'Follow up', 'Complaint'];

/** Starter saved replies, auto-replies and away message for a new business. `{price}`, `{city}` and `{business}` are filled in when sent. */
export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  savedReplies: [
    { id: 'sr_price', title: 'Price list', text: 'Namaste! Our packages start at {price}. Share your date and guest count and we will send an exact quotation.' },
    { id: 'sr_date', title: 'Check the date', text: 'Thank you for asking! Which date (BS or AD) and how many guests? We will check the calendar right away.' },
    { id: 'sr_visit', title: 'Invite to visit', text: 'You are welcome to visit us in {city}. Which day suits you? We are open 9 am to 7 pm, Sunday to Friday.' },
    { id: 'sr_thanks', title: 'Thank you', text: 'Dhanyabad! It was lovely to be part of your celebration. A review on Vivah would mean a lot to us.' },
  ],
  rules: [
    { id: 'ar_price', keywords: ['price', 'rate', 'kati', 'कति', 'cost', 'package'], reply: 'Namaste! Packages at {business} start at {price}. Tell us your date and guest count for an exact quotation.', networks: [], active: true, hits: 0 },
    { id: 'ar_location', keywords: ['location', 'kaha', 'कहाँ', 'address', 'where'], reply: 'We are in {city}. Send us a message to get the map pin and visiting hours.', networks: [], active: false, hits: 0 },
  ],
  away: { active: true, from: '21:00', to: '08:00', text: 'Namaste! We are away for the night and will reply first thing in the morning. Dhanyabad for your patience.' },
};

/** Messages the simulated networks deliver in the demo (`receiveSocialMessage` is what a real webhook calls). */
export const SAMPLE_INBOUND: { network: SocialNetwork; kind: 'message' | 'comment'; name: string; handle: string; text: string; phone?: string }[] = [
  { network: 'instagram', kind: 'message', name: 'Prerana Shakya', handle: '@prerana.shakya', text: 'Namaste! Is Mangsir 18 free for a 350 guest reception? Rate kati ho?' },
  { network: 'facebook', kind: 'message', name: 'Bishal Thapa', handle: 'Bishal Thapa', text: 'Hi, do you do packages for a mehendi and wedding together? Budget around 5 lakh.' },
  { network: 'whatsapp', kind: 'message', name: 'Sushma Gurung', handle: '+977 9841234567', phone: '9841234567', text: 'Hello, can we come and see the hall this Saturday?' },
  { network: 'tiktok', kind: 'comment', name: 'kathmandu.brides', handle: '@kathmandu.brides', text: 'This setup is so pretty! How much for something like this?' },
  { network: 'instagram', kind: 'comment', name: 'Rojina Maharjan', handle: '@rojina.mhrzn', text: 'Wow 😍 DM me the price please' },
  { network: 'facebook', kind: 'comment', name: 'Anup Karki', handle: 'Anup Karki', text: 'Where exactly is this? Is parking available?' },
];
