/**
 * Demo records for the social hub: Everest Grand Party Palace has Facebook,
 * Instagram and WhatsApp connected (TikTok left to connect in the demo), a
 * busy inbox and posts in every state; Wedding Story Nepal has Instagram,
 * Facebook and TikTok; Phoolbari Decor's Facebook access has expired.
 */
import type { PhotoKey } from '@/constants/images';
import { DEFAULT_SOCIAL_SETTINGS } from '@/data/social';
import { postUrl, projectedMetrics } from '@/services/social';
import type { SocialAccount, SocialMessage, SocialNetwork, SocialPost, SocialPostResult, SocialSettings, SocialThread } from '@/types/platform';

const at = (offset: number, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** Minutes before now: today's messages are always in the past, whatever time the demo opens. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const VENUE = 'acc_vendor_demo';
const STUDIO = 'acc_vendor_studio';
const DECOR = 'acc_vendor_decor';

const META_SCOPES = { facebook: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_messaging', 'pages_manage_engagement'], instagram: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'instagram_manage_comments'], whatsapp: ['whatsapp_business_messaging', 'whatsapp_business_management'], tiktok: ['user.info.basic', 'user.info.stats', 'video.publish', 'video.list'] };

const account = (id: string, ownerId: string, network: SocialNetwork, handle: string, name: string, followers: number, connectedAgo: number, status: SocialAccount['status'] = 'connected', renewsIn = 45): SocialAccount => ({
  id,
  ownerId,
  network,
  handle,
  name,
  status,
  followers,
  scopes: META_SCOPES[network],
  connectedAt: at(-connectedAgo),
  // Meta tokens last about 60 days; Instagram here needs renewing this week, Phoolbari's Facebook already ran out.
  expiresAt: network === 'tiktok' ? undefined : status === 'expired' ? at(-2) : at(renewsIn),
  lastSyncAt: ago(5),
});

type Msg = Omit<SocialMessage, 'id' | 'threadId'>;

function thread(base: Omit<SocialThread, 'lastAt' | 'unread' | 'lastInboundAt'>, msgs: Msg[]): { thread: SocialThread; messages: SocialMessage[] } {
  const messages = msgs.map((m, i) => ({ ...m, id: `${base.id}_m${i}`, threadId: base.id }));
  const inbound = messages.filter((m) => m.direction === 'in');
  const lastOut = messages.map((m) => m.direction).lastIndexOf('out');
  return {
    thread: {
      ...base,
      lastAt: messages[messages.length - 1].at,
      lastInboundAt: inbound[inbound.length - 1]?.at,
      unread: messages.filter((m, i) => m.direction === 'in' && i > lastOut).length,
    },
    messages,
  };
}

const media = (image: PhotoKey, i = 0) => ({ id: `md_${image}_${i}`, kind: 'image' as const, image });

function published(id: string, networks: SocialNetwork[], followers: Record<SocialNetwork, number>, handles: Record<SocialNetwork, string>, when: string, mediaCount: number, failed: Partial<Record<SocialNetwork, string>> = {}): Partial<Record<SocialNetwork, SocialPostResult>> {
  return Object.fromEntries(
    networks.map((n) => [
      n,
      failed[n] ? { status: 'failed', error: failed[n], at: when } : { status: 'published', at: when, url: postUrl(n, handles[n], `${id}${n}`), ...projectedMetrics(id, n, followers[n], mediaCount) },
    ]),
  );
}

/** Social accounts, threads, messages, posts and settings for the demo businesses. */
export function buildSocialSeed(): { socialAccounts: SocialAccount[]; socialThreads: SocialThread[]; socialMessages: SocialMessage[]; socialPosts: SocialPost[]; socialSettings: Record<string, SocialSettings> } {
  const socialAccounts = [
    account('sa_venue_fb', VENUE, 'facebook', 'Everest Grand Party Palace', 'Everest Grand Party Palace', 18_240, 300),
    account('sa_venue_ig', VENUE, 'instagram', '@everestgrand.np', 'Everest Grand', 9_410, 280, 'connected', 5),
    account('sa_venue_wa', VENUE, 'whatsapp', '+977 9801234567', 'Everest Grand Events', 1_240, 200),
    account('sa_studio_ig', STUDIO, 'instagram', '@weddingstorynepal', 'Wedding Story Nepal', 42_800, 500),
    account('sa_studio_fb', STUDIO, 'facebook', 'Wedding Story Nepal', 'Wedding Story Nepal', 27_300, 500),
    account('sa_studio_tt', STUDIO, 'tiktok', '@weddingstorynepal', 'Wedding Story Nepal', 61_500, 120),
    account('sa_decor_ig', DECOR, 'instagram', '@phoolbari.decor', 'Phoolbari Decor', 6_920, 150),
    account('sa_decor_fb', DECOR, 'facebook', 'Phoolbari Decor Lalitpur', 'Phoolbari Decor', 4_310, 90, 'expired'),
  ];
  const venueFollowers = { facebook: 18_240, instagram: 9_410, whatsapp: 1_240, tiktok: 0 };
  const venueHandles = { facebook: 'Everest Grand Party Palace', instagram: '@everestgrand.np', whatsapp: '+977 9801234567', tiktok: '' };
  const studioFollowers = { facebook: 27_300, instagram: 42_800, whatsapp: 0, tiktok: 61_500 };
  const studioHandles = { facebook: 'Wedding Story Nepal', instagram: '@weddingstorynepal', whatsapp: '', tiktok: '@weddingstorynepal' };

  const threads = [
    thread(
      { id: 'st_asmita', ownerId: VENUE, accountId: 'sa_venue_ig', network: 'instagram', kind: 'message', contactName: 'Asmita Karki', contactHandle: '@asmita.karki', status: 'open', labels: ['Date check'] },
      [{ direction: 'in', author: 'Asmita Karki', text: 'Namaste! Is Mangsir 22 available for our wedding reception? Around 400 guests.', at: ago(48) }],
    ),
    thread(
      { id: 'st_rohan', ownerId: VENUE, accountId: 'sa_venue_fb', network: 'facebook', kind: 'message', contactName: 'Rohan Shrestha', contactHandle: 'Rohan Shrestha', status: 'open', labels: ['Price asked', 'Hot lead'], firstResponseMins: 22 },
      [
        { direction: 'in', author: 'Rohan Shrestha', text: 'Hello, what is the per plate rate for a veg and non-veg buffet?', at: at(-1, 18, 40) },
        { direction: 'out', author: 'Rajesh Pradhan', text: 'Namaste Rohan! Our wedding buffet starts at NPR 1,250 per plate with three live counters and a Newari bhoj corner.', at: at(-1, 19, 2), status: 'read' },
        { direction: 'in', author: 'Rohan Shrestha', text: 'Can you do 1,100 for 500 guests? Wedding and reception on Falgun 5. My number is 9851098765.', at: ago(95) },
      ],
    ),
    thread(
      { id: 'st_nirmala', ownerId: VENUE, accountId: 'sa_venue_wa', network: 'whatsapp', kind: 'message', contactName: 'Nirmala Joshi', contactHandle: '+977 9841556677', contactPhone: '9841556677', status: 'open', labels: [] },
      [{ direction: 'in', author: 'Nirmala Joshi', text: 'Namaste, do you have a garden for a haldi function? About 120 people.', at: ago(12) }],
    ),
    thread(
      { id: 'st_sabina', ownerId: VENUE, accountId: 'sa_venue_fb', network: 'facebook', kind: 'comment', contactName: 'Sabina Lama', contactHandle: 'Sabina Lama', postId: 'sp_venue_mandap', postCaption: 'Mandap lighting for this season’s evening weddings', status: 'open', labels: ['Date check'] },
      [{ direction: 'in', author: 'Sabina Lama', text: 'Is this setup available in Poush?', at: ago(140) }],
    ),
    thread(
      { id: 'st_kabita', ownerId: VENUE, accountId: 'sa_venue_wa', network: 'whatsapp', kind: 'message', contactName: 'Kabita Tamang', contactHandle: '+977 9851012345', contactPhone: '9851012345', optedIn: true, status: 'pending', labels: ['Follow up'], firstResponseMins: 20 },
      [
        { direction: 'in', author: 'Kabita Tamang', text: 'Can we visit the hall on Saturday at 11 am?', at: at(-2, 16) },
        { direction: 'out', author: 'Rajesh Pradhan', text: 'Yes of course! See you on Saturday at 11 am at the main gate.', at: at(-2, 16, 20), status: 'read' },
        { direction: 'note', author: 'Rajesh Pradhan', text: 'Did not come on Saturday. Follow up with the template.', at: at(-1, 12) },
      ],
    ),
    thread(
      { id: 'st_pratik', ownerId: VENUE, accountId: 'sa_venue_ig', network: 'instagram', kind: 'comment', contactName: 'pratik.weds.puja', contactHandle: '@pratik.weds.puja', postId: 'sp_venue_bhoj', postCaption: 'The Newari bhoj corner is back for Mangsir', status: 'done', labels: ['Booked'], firstResponseMins: 35 },
      [
        { direction: 'in', author: 'pratik.weds.puja', text: 'We had our reception here, the food was amazing! 🙏', at: at(-3, 20, 10) },
        { direction: 'out', author: 'Rajesh Pradhan', text: 'Thank you, Pratik! Wishing you both a lifetime of happiness.', at: at(-3, 20, 45), status: 'sent' },
      ],
    ),
    thread(
      { id: 'st_studio_bina', ownerId: STUDIO, accountId: 'sa_studio_ig', network: 'instagram', kind: 'message', contactName: 'Bina Rai', contactHandle: '@bina.rai', status: 'open', labels: ['Price asked'] },
      [{ direction: 'in', author: 'Bina Rai', text: 'Hi! How much for a sunrise pre-wedding shoot at Nagarkot? Sometime in Magh.', at: ago(70) }],
    ),
    thread(
      { id: 'st_studio_tt', ownerId: STUDIO, accountId: 'sa_studio_tt', network: 'tiktok', kind: 'comment', contactName: 'pokhara.vibes', contactHandle: '@pokhara.vibes', postId: 'sp_studio_reel', postCaption: 'Sindoor-halne, Patan', status: 'open', labels: [] },
      [{ direction: 'in', author: 'pokhara.vibes', text: 'Do you also shoot in Pokhara? Need a team for Falgun.', at: at(-1, 21) }],
    ),
    thread(
      { id: 'st_studio_fb', ownerId: STUDIO, accountId: 'sa_studio_fb', network: 'facebook', kind: 'message', contactName: 'Sarina Karki', contactHandle: 'Sarina Karki', status: 'pending', labels: ['Complaint'], firstResponseMins: 48 },
      [
        { direction: 'in', author: 'Sarina Karki', text: 'Our album is still not ready. It has been more than 21 days.', at: at(-2, 11) },
        { direction: 'out', author: 'Anil Gurung', text: 'We are so sorry Sarina. The album is in final print and will reach you this week.', at: at(-2, 11, 48), status: 'read' },
      ],
    ),
  ];

  const now = new Date().toISOString();
  const socialPosts: SocialPost[] = [
    {
      id: 'sp_venue_mandap',
      ownerId: VENUE,
      caption: 'Mandap lighting for this season’s evening weddings. Warm gold, soft marigold and a 1,500-guest hall that still feels close. Mangsir dates are going fast.\n\n#PartyPalace #KathmanduWedding #NepaliWedding',
      overrides: {},
      media: [media('decorMandapNight'), media('venueLuxuryStage', 1)],
      networks: ['facebook', 'instagram'],
      status: 'published',
      publishedAt: at(-6, 19, 30),
      results: published('sp_venue_mandap', ['facebook', 'instagram'], venueFollowers, venueHandles, at(-6, 19, 30), 2),
      campaign: 'Mangsir season',
      createdAt: at(-7),
      updatedAt: at(-6, 19, 30),
    },
    {
      id: 'sp_venue_bhoj',
      ownerId: VENUE,
      caption: 'The Newari bhoj corner is back for Mangsir: samay baji, choila, bara and wo, served on leaf plates. Ask for it with any wedding buffet.\n\n#NepaliKhana #WeddingCatering #NepaliWedding',
      overrides: { whatsapp: 'Namaste! Our Newari bhoj corner is back for Mangsir weddings. Reply to this message for the menu and per-plate price.' },
      media: [media('ideaReceptionToast')],
      networks: ['facebook', 'instagram', 'whatsapp'],
      status: 'published',
      publishedAt: at(-12, 20),
      results: published('sp_venue_bhoj', ['facebook', 'instagram', 'whatsapp'], venueFollowers, venueHandles, at(-12, 20), 1),
      campaign: 'Mangsir season',
      createdAt: at(-13),
      updatedAt: at(-12, 20),
    },
    {
      id: 'sp_venue_garden',
      ownerId: VENUE,
      caption: 'Morning haldi in the garden pavilion, before the janti arrives. Shade, space for 200 and a separate entrance for the bride’s family.\n\n#HaldiCeremony #WeddingVenueNepal',
      overrides: {},
      media: [media('venueGardenPavilion')],
      networks: ['facebook', 'instagram'],
      status: 'published',
      publishedAt: at(-20, 11),
      results: published('sp_venue_garden', ['facebook', 'instagram'], venueFollowers, venueHandles, at(-20, 11), 1),
      createdAt: at(-21),
      updatedAt: at(-20, 11),
    },
    {
      id: 'sp_venue_floral',
      ownerId: VENUE,
      caption: 'Fresh floral jagge for a Lalitpur couple this weekend. Decor by our in-house team.\n\n#MandapDecor #NepaliWedding',
      overrides: {},
      media: [media('decorMandapFloral')],
      networks: ['facebook', 'instagram'],
      status: 'partial',
      publishedAt: at(-3, 19),
      results: published('sp_venue_floral', ['facebook', 'instagram'], venueFollowers, venueHandles, at(-3, 19), 1, { instagram: 'Instagram could not fetch the photo in time. Try again.' }),
      createdAt: at(-3, 18),
      updatedAt: at(-3, 19),
    },
    {
      id: 'sp_venue_open',
      ownerId: VENUE,
      caption: 'A few Mangsir and Poush dates are still open. Send us your date and guest count and we will hold it for 48 hours while you decide.\n\n#Mangsir #KathmanduWedding #PartyPalace',
      overrides: { whatsapp: 'Namaste! A few Mangsir and Poush dates are still open at Everest Grand. Reply with your date and guest count and we will hold it for 48 hours.' },
      media: [media('venueLuxuryStage')],
      networks: ['facebook', 'instagram', 'whatsapp'],
      status: 'scheduled',
      scheduledAt: at(2, 19, 30),
      results: { facebook: { status: 'queued' }, instagram: { status: 'queued' }, whatsapp: { status: 'queued' } },
      campaign: 'Mangsir season',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sp_venue_kitchen',
      ownerId: VENUE,
      caption: 'Behind the scenes: 38 people, 6 am, one kitchen.',
      overrides: {},
      media: [],
      networks: ['instagram'],
      status: 'draft',
      results: {},
      createdAt: at(-1),
      updatedAt: at(-1),
    },
    {
      id: 'sp_studio_reel',
      ownerId: STUDIO,
      caption: 'Sindoor-halne, Patan. One frame, a whole family holding its breath.\n\n#NepaliWeddingPhotography #PatanDurbarSquare',
      overrides: {},
      media: [media('photographerCeremony'), media('ideaCoupleGardenWalk', 1)],
      networks: ['instagram', 'facebook', 'tiktok'],
      status: 'published',
      publishedAt: at(-4, 20, 30),
      results: published('sp_studio_reel', ['instagram', 'facebook', 'tiktok'], studioFollowers, studioHandles, at(-4, 20, 30), 2),
      createdAt: at(-5),
      updatedAt: at(-4, 20, 30),
    },
  ];

  return {
    socialAccounts,
    socialThreads: threads.map((x) => x.thread),
    socialMessages: threads.flatMap((x) => x.messages),
    socialPosts,
    socialSettings: {
      [VENUE]: { ...DEFAULT_SOCIAL_SETTINGS, rules: DEFAULT_SOCIAL_SETTINGS.rules.map((r) => (r.id === 'ar_price' ? { ...r, hits: 14 } : r)), signature: '— Rajesh, Everest Grand' },
    },
  };
}
