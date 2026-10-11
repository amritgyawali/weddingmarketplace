/**
 * Help and support: request topics, limits, where each role reads its
 * requests, and the answers to common questions (per role). Pure data, used
 * by the help centre screens and the store actions in `store/db/support.ts`.
 */
import type { SupportPriority, SupportTicketStatus, SupportTopic, UserRole } from '@/types/platform';

export const SUPPORT_LIMITS = {
  subjectMin: 4,
  subjectMax: 120,
  bodyMin: 10,
  bodyMax: 4000,
  /** Open requests one person can have at once (the rest go into an existing one). */
  openPerPerson: 5,
} as const;

export const SUPPORT_TOPICS: { id: SupportTopic; label: string; icon: string; hint: string }[] = [
  { id: 'booking', label: 'A booking', icon: 'calendar-outline', hint: 'Dates, changes, cancellations' },
  { id: 'payment', label: 'Payments', icon: 'card-outline', hint: 'Receipts, refunds, payouts' },
  { id: 'account', label: 'My account', icon: 'person-circle-outline', hint: 'Sign-in, number, profile' },
  { id: 'vendor', label: 'A vendor or crew', icon: 'people-outline', hint: 'Someone you work with' },
  { id: 'technical', label: 'Something isn’t working', icon: 'construct-outline', hint: 'A screen or button' },
  { id: 'feedback', label: 'An idea', icon: 'bulb-outline', hint: 'Make Vivah better' },
  { id: 'other', label: 'Something else', icon: 'help-circle-outline', hint: 'Anything at all' },
];

export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = Object.fromEntries(SUPPORT_TOPICS.map((t) => [t.id, t.label])) as Record<SupportTopic, string>;

export const SUPPORT_PRIORITIES: { id: SupportPriority; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Within two working hours' },
  { id: 'high', label: 'Soon', hint: 'A function in the next week' },
  { id: 'urgent', label: 'Urgent', hint: 'A function today or tomorrow' },
];

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Waiting for Vivah',
  in_progress: 'Being looked at',
  waiting: 'Waiting for your reply',
  resolved: 'Solved',
  closed: 'Closed',
};

/** What staff call each status on the help desk. */
export const SUPPORT_DESK_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'New',
  in_progress: 'In progress',
  waiting: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Still needs someone: not solved or closed. */
export const isOpenTicket = (status: SupportTicketStatus) => status === 'open' || status === 'in_progress' || status === 'waiting';

/** Where a role reads its help centre, or one request in it. */
export function supportHref(role: UserRole, id?: string): string {
  const base = role === 'vendor' ? '/business/support' : role === 'freelancer' ? '/freelancer/support' : role === 'platform' ? '/platform/support' : '/support';
  return id ? `${base}/${id}` : base;
}

/** Where a role edits its profile. */
export function editProfileHref(role: UserRole): string {
  return role === 'vendor' ? '/business/edit-profile' : role === 'freelancer' ? '/freelancer/edit-profile' : role === 'platform' ? '/platform/edit-profile' : '/edit-profile';
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  topic: SupportTopic;
}

const SHARED: FaqItem[] = [
  { id: 'otp', topic: 'account', q: 'I didn’t get my sign-in code', a: 'Wait a minute and tap Resend. Check the number or email is right. If it still doesn’t come, call us and we’ll help you sign in.' },
  { id: 'number', topic: 'account', q: 'How do I change my mobile number?', a: 'Your number is how you sign in, so we change it for you after a quick check. Open a help request under My account with the new number.' },
  { id: 'dark', topic: 'technical', q: 'Can I use Vivah in dark mode or in Nepali?', a: 'Yes. Settings → Appearance switches between light, dark and the same as your phone. Settings → Language & dates switches English and नेपाली, and the Bikram Sambat or AD calendar.' },
  { id: 'bug', topic: 'technical', q: 'A screen isn’t working. What should I do?', a: 'Take a screenshot or hold three fingers on the screen: a report opens with the screenshot attached. Say what you tapped and what happened, and we’ll fix it.' },
  { id: 'delete', topic: 'account', q: 'How do I download or delete my data?', a: 'Settings → Your data. Download my data gives you everything we hold. Delete my account closes it once no booking, refund or payout is still open.' },
];

const COUPLE: FaqItem[] = [
  { id: 'pay-how', topic: 'payment', q: 'How do I pay, and is my money safe?', a: 'Pay each step in My Wedding → Payments with eSewa, Khalti, Fonepay QR, ConnectIPS, IME Pay, card or bank transfer. Vivah holds the money and pays vendors after each stage of the work, so you are covered if something goes wrong.' },
  { id: 'schedule', topic: 'payment', q: 'When are payments due?', a: 'Usually 30% when you confirm, 50% fifteen days before the function and 20% after it. The exact dates and amounts are in My Wedding → Payments, and we remind you a week before each one.' },
  { id: 'receipt', topic: 'payment', q: 'Where are my receipts?', a: 'My Wedding → Payments. Tap a payment to share or print its receipt.' },
  { id: 'quote-change', topic: 'booking', q: 'Can I change my quotation after it is sent?', a: 'Yes. Ask your coordinator in Messages or here. They send a new version; the earlier versions stay so you can compare them before you accept.' },
  { id: 'cancel', topic: 'booking', q: 'What happens if a vendor cancels or falls sick?', a: 'Your coordinator finds a replacement of the same standard, usually within hours, at no extra cost to you. On the day itself the control room handles it.' },
  { id: 'refund', topic: 'payment', q: 'How do refunds work?', a: 'It depends on how close the function is. The Cancellation and refunds page in Settings → Legal has the full rules; open a request under Payments and finance will work it out with you.' },
  { id: 'family', topic: 'account', q: 'Can my family help plan?', a: 'Yes. Share your wedding code from My Wedding: family members join with Join a wedding and can see the plan, guests and tasks.' },
];

const VENDOR: FaqItem[] = [
  { id: 'payout-when', topic: 'payment', q: 'When do I get paid for a booking?', a: '40% of your amount is paid a week before the function and 60% three days after it, to the payout account in Finance. A dispute on the booking can put a payment on hold until it is settled.' },
  { id: 'commission', topic: 'payment', q: 'How much does Vivah keep?', a: 'For most bookings 10% of the price the couple pays. Your quotation shows what you receive before you accept.' },
  { id: 'verify', topic: 'account', q: 'How do I get the Verified badge?', a: 'Business → Verification: add your PAN or VAT and registration documents. The Vendor Success team reviews them, usually within two working days.' },
  { id: 'leads', topic: 'booking', q: 'How do I get more leads?', a: 'Reply quickly (response time affects matching), keep your calendar up to date, add three portfolio albums and a package with clear prices.' },
  { id: 'calendar', topic: 'booking', q: 'A date shows booked by mistake', a: 'Open Calendar and tap the date to free it. If it came from a confirmed booking, open a request and we’ll check it with you.' },
  { id: 'services', topic: 'account', q: 'I offer more services now', a: 'Business → Your services. Add the new services and your tools and listing change to match.' },
];

const FREELANCER: FaqItem[] = [
  { id: 'gig-pay', topic: 'payment', q: 'When are gig payments made?', a: 'After you check out and the job is marked complete, finance releases it to the eSewa, Khalti or bank account in Earnings. Each payment and its due date is listed there.' },
  { id: 'checkin', topic: 'booking', q: 'Check-in says I am too far away', a: 'Turn on location and stand at the venue entrance, then try again. If it still won’t work, message your coordinator from the job and they will sort it out.' },
  { id: 'no-gigs', topic: 'booking', q: 'Why don’t I see many gigs?', a: 'You only see gigs for the skills on your profile. Add skills in Profile → Your craft, keep your calendar open and widen your travel distance.' },
  { id: 'sick', topic: 'booking', q: 'I can’t make it to a job', a: 'Tell your coordinator as early as you can from the job screen. We find cover; missing a job without notice lowers your reliability score.' },
  { id: 'payout-number', topic: 'account', q: 'How do I change my payout number?', a: 'Open a request under My account with the new eSewa, Khalti or bank details. We confirm it is yours by phone before the next payout.' },
];

const STAFF: FaqItem[] = [
  { id: 'sla', topic: 'other', q: 'How fast should we answer?', a: 'Normal within two working hours, Soon the same day, Urgent at once (call the person). Pick up a request with Assign to me so others know.' },
  { id: 'internal', topic: 'other', q: 'Can the customer see internal notes?', a: 'No. Internal notes are for the team only; replies are sent to the person and notify them.' },
];

/** Common questions for a role, most useful first. */
export function faqFor(role: UserRole): FaqItem[] {
  const own = role === 'vendor' ? VENDOR : role === 'freelancer' ? FREELANCER : role === 'platform' ? STAFF : COUPLE;
  return [...own, ...SHARED];
}
