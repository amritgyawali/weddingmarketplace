/**
 * The public legal pages (/legal/terms, /legal/privacy, /legal/refunds,
 * /legal/delete-account). The Play Store listing, the payment gateways and the
 * sign-in screens link here, so the web build must serve them signed out.
 *
 * Every statement here describes what the app and backend actually do (see
 * AGENTS.md §6a item 13b). When behaviour changes, change the text and bump
 * LEGAL_VERSION: users are asked to accept the new version at their next
 * sign-in (rpc_accept_legal).
 */
import { BRAND } from '@/constants/brand';

/** The date of the current Terms and Privacy policy; stored with each acceptance. */
export const LEGAL_VERSION = '2026-10-01';

export type LegalDocId = 'terms' | 'privacy' | 'refunds' | 'delete-account';

export interface LegalSection {
  heading: string;
  /** Paragraphs; a paragraph starting with "- " is shown as a bullet. */
  body: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  /** One line for search results and link previews. */
  summary: string;
  updated: string;
  sections: LegalSection[];
}

const who = `${BRAND.legalEntity} ("${BRAND.name}", "we", "us"), ${BRAND.registeredAddress}`;
const contact = `${BRAND.supportEmail} or ${BRAND.supportPhone}`;

const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Privacy policy',
  summary: `What ${BRAND.name} collects, why, who it is shared with, how long it is kept and how to download or delete it.`,
  updated: LEGAL_VERSION,
  sections: [
    {
      heading: 'Who we are',
      body: [
        `This policy covers the ${BRAND.name} app and website, run by ${who}. ${BRAND.name} is a marketplace in Nepal that plans and manages weddings and other celebrations with couples and families, the businesses that provide the services, and the freelancers who work on the day.`,
        `We handle personal information in line with Nepal's Individual Privacy Act, 2075 (2018). Questions about this policy go to ${contact}.`,
      ],
    },
    {
      heading: 'What we collect',
      body: [
        '- Account details: your name, email address, mobile number and city. We sign you in with a code sent to your email; we never ask for a password.',
        '- Couples and families: the celebration you plan (dates, city, venue, guest count, budget and the services you need), your partner’s or family members’ names if you add them, and the guest list you build. When you pick guests from your contacts, only the names and numbers you select are added.',
        '- Businesses: business name, PAN or VAT number, services, prices, packages, portfolio photos and videos, and the verification documents you upload (for example a registration certificate or citizenship card).',
        '- Freelancers: skills, rates, equipment, travel radius and portfolio. On a booked gig, your location when you check in at the venue.',
        '- Payments: the amount, method, date and the gateway’s transaction reference. Card numbers, wallet PINs and bank logins are entered on Khalti’s, eSewa’s or your bank’s own pages; we never see or store them.',
        '- Messages, quotations, contracts, reviews and files you send or receive in the app.',
        '- Device and usage: a push notification token, app version, device model, the screens you open and crash reports. Location is used only while the app is open and only when you allow it.',
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        '- To run your account and sign you in.',
        '- To match you with providers, prepare quotations, confirm bookings, take payments and pay providers and freelancers.',
        '- To send the notifications you choose (push and email) about quotations, bookings, payments and your event days. Emergency alerts on an event day are always sent.',
        '- To verify businesses and freelancers before they are shown to couples, and to keep the marketplace safe (rate limits, fraud checks and resolving disputes).',
        '- To keep tax, invoice and payment records, as Nepal’s laws require.',
        '- To find and fix bugs and understand which features are used, so we can improve them. You can turn usage analytics off in Settings.',
        '- To send offers and planning tips only if you turn them on in Settings.',
      ],
    },
    {
      heading: 'Who sees your information',
      body: [
        '- Providers you enquire with or book see what they need to quote and deliver: your event dates, city, venue, guest count and requirements. Your phone number is shared only once a booking is confirmed. You can hide your celebration details from providers in Settings.',
        '- Freelancers booked for your event see the venue, times and the run sheet for their work.',
        `- ${BRAND.name} staff (coordinators, finance, support and verification) see what their role needs. Access is limited by role and every change to money or status is logged.`,
        '- Couples never see a provider’s cost price or margin.',
        '- Guests who open your wedding website or RSVP page see only what you publish there.',
      ],
    },
    {
      heading: 'Services that process data for us',
      body: [
        'We use these companies to run the service. They process data only on our instructions:',
        '- Supabase: database, sign-in and private file storage.',
        '- Cloudinary: portfolio and gallery photos and videos.',
        '- Resend: email (sign-in codes, receipts, quotations).',
        '- Expo, Google Firebase Cloud Messaging and Apple Push Notification service: push notifications.',
        '- Khalti and eSewa: online payments.',
        '- PostHog: usage analytics and error reports. Sentry: crash reports from the app.',
        '- Google Maps: maps and place search.',
        '- Cloudflare: website hosting, security and encrypted backups. Upstash: short-lived counters that limit repeated sign-in attempts.',
        'Some of these services store data outside Nepal. We choose providers that protect data in transit and at rest.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        '- Your account data is kept while your account is open.',
        '- Read notifications are removed after 90 days, and each account keeps at most its latest 300. Push tokens not used for 6 months are removed.',
        '- When you delete your account, your profile, contact details, devices, notifications and private documents (including verification documents) are removed, and your name is replaced with "Deleted user" on anything that remains.',
        '- Bookings, payments, invoices, contracts and reviews that other people rely on are kept for as long as Nepal’s tax and accounting laws require, without your name.',
        '- Encrypted database backups are kept for up to 12 months, then deleted.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        '- See and correct your details in your profile.',
        '- Download your data: Settings → Download my data.',
        '- Delete your account: Settings → Delete my account, or see the account deletion page.',
        '- Choose notifications, turn usage analytics or offers off, and hide your details from providers in Settings.',
        `- Ask us anything about your data, or complain about how we handled it, at ${contact}. We reply within 30 days.`,
      ],
    },
    {
      heading: 'Security',
      body: [
        'Data travels encrypted (HTTPS). Every table in our database has row-level access rules, so each person can read only what their role allows. Verification documents, contracts and invoices are kept in a private store and opened through links that expire after five minutes. Payments are confirmed with the gateway before they are recorded.',
      ],
    },
    {
      heading: 'Children',
      body: [
        `You must be 18 or older to create a ${BRAND.name} account. Parents planning a child’s ceremony (for example a Pasni) may add their child’s name and date; that information is handled like the rest of the parent’s celebration.`,
      ],
    },
    {
      heading: 'Changes',
      body: [
        'When we change this policy we update the date at the top and ask you to accept the new version the next time you sign in. We will tell you in the app before any change that affects how your data is shared.',
      ],
    },
  ],
};

const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Terms of use',
  summary: `The agreement between ${BRAND.name} and the couples, families, businesses and freelancers who use it.`,
  updated: LEGAL_VERSION,
  sections: [
    {
      heading: 'About these terms',
      body: [
        `These terms are an agreement between you and ${who}. By creating an account or continuing to sign in, you accept them and our privacy policy. You must be 18 or older and able to enter a contract in Nepal.`,
      ],
    },
    {
      heading: `What ${BRAND.name} does`,
      body: [
        `${BRAND.name} is a marketplace. We help couples and families plan a celebration, find and book venues, vendors and freelancers, and we coordinate the bookings, payments and the event days. The services themselves (the venue, catering, photography, decoration and so on) are provided by the businesses and freelancers you book, who are responsible for delivering them as agreed.`,
      ],
    },
    {
      heading: 'Accounts',
      body: [
        '- Give accurate details and keep them up to date. You are responsible for what happens under your account, so keep access to your email secure.',
        '- Businesses and freelancers are checked before they are shown to couples. We may ask for documents and may refuse or remove a listing that fails verification.',
        '- We may suspend an account that breaks these terms, puts others at risk or is used for fraud. You can ask support to review a suspension.',
      ],
    },
    {
      heading: 'Quotations and bookings',
      body: [
        '- A quotation lists the services, prices, the service fee and 13% VAT. It is valid for 15 days unless it says otherwise.',
        '- Once a quotation is sent, that version never changes. Any change creates a new version, and you can compare all versions.',
        '- A booking is confirmed when you accept a quotation and the provider confirms the date. The accepted version, its payment schedule and its cancellation terms then apply to both sides.',
      ],
    },
    {
      heading: 'Payments',
      body: [
        '- You pay the schedule in your accepted quotation. Unless it says otherwise, that is 30% to confirm, 50% fifteen days before the event and the balance after the event.',
        '- You can pay with Khalti or eSewa in the app, or by the other methods shown. Cash and bank transfers are recorded by our finance team. A payment counts only once the gateway or our finance team confirms it; you get a receipt for each one.',
        `- ${BRAND.name} collects payments and pays providers and freelancers their share: for providers, 40% before the event and 60% after it. Payouts can be held while a dispute about that booking is open.`,
        '- Prices are in Nepali rupees. The gateway’s own terms apply to your payment with them.',
      ],
    },
    {
      heading: 'Cancellations, changes and refunds',
      body: [
        'Our cancellation and refund policy explains what happens when you or a provider cancel, change a date or pay twice. It forms part of these terms.',
      ],
    },
    {
      heading: 'Businesses and freelancers',
      body: [
        '- Describe your services, prices and availability truthfully, and keep your calendar current.',
        '- Hold the registrations, licences and PAN or VAT numbers your work needs, and issue the invoices the law requires.',
        '- Deliver what you confirmed, on the agreed date and time. Freelancers check in at the venue when the app asks. Late cancellations and no-shows affect your reliability score and may lead to removal.',
        '- Only upload photos and videos you have the right to use. You keep ownership; you allow us to show them on the app and website while your listing is live.',
      ],
    },
    {
      heading: 'Reviews and content',
      body: [
        '- Reviews must be honest and about a real experience. Reviews from confirmed bookings are marked as verified. We may remove reviews and content that are false, abusive, discriminatory, or that share someone else’s private information.',
        '- Do not use the app to harass anyone, to send spam, to get around our payment or safety checks, or to break the law.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        `We work to keep ${BRAND.name} available and accurate, but we can’t promise it will always be free of errors or interruptions. Providers are responsible for the services they deliver. To the extent the law allows, our liability for any claim is limited to the fees ${BRAND.name} received for the booking concerned. Nothing in these terms limits your rights under Nepal’s Consumer Protection Act, 2075 (2018).`,
      ],
    },
    {
      heading: 'Closing your account',
      body: [
        'You can delete your account at any time from Settings once your open bookings, refunds and payouts are settled. We may close accounts that break these terms.',
      ],
    },
    {
      heading: 'Changes and disputes',
      body: [
        '- We may update these terms. We update the date at the top and ask you to accept the new version at your next sign-in.',
        `- Tell us about any problem first at ${contact}; most issues are solved there. These terms are governed by the laws of Nepal, and the courts of Kathmandu decide any dispute we cannot settle together.`,
      ],
    },
  ],
};

const REFUNDS: LegalDoc = {
  id: 'refunds',
  title: 'Cancellation and refund policy',
  summary: 'What happens to your money when a booking is cancelled or changed, or a payment goes through twice.',
  updated: LEGAL_VERSION,
  sections: [
    {
      heading: 'The short version',
      body: [
        '- A refund is never more than what you paid.',
        '- If a provider cancels, or can’t deliver and you don’t accept a replacement, you get back everything you paid for that service.',
        '- If you cancel, the cancellation terms on your accepted quotation decide what comes back.',
        '- A payment that went through twice, or after a milestone was already paid, is refunded in full.',
      ],
    },
    {
      heading: 'When a provider cancels',
      body: [
        'We first try to find a replacement of the same standard and price, and tell you who it is. If you don’t accept the replacement, or there isn’t one, the amount you paid for that service is refunded, including its share of the service fee.',
      ],
    },
    {
      heading: 'When you cancel or change a date',
      body: [
        '- Each confirmed booking carries cancellation terms, shown on the quotation you accepted. They reflect what the provider has already committed for your date (for example a venue that turned other events away, or materials bought).',
        '- A date change is free once if you ask 60 or more days before the event and the provider is free on the new date. Later changes are treated as a cancellation and a new booking.',
        '- To cancel, ask your coordinator in the app or contact support. We confirm in writing what will be refunded before anything is cancelled.',
      ],
    },
    {
      heading: 'Duplicate and extra payments',
      body: [
        'If a gateway charges you twice, or a payment arrives for a milestone that was already paid, the extra amount is marked for refund automatically and our finance team is told.',
      ],
    },
    {
      heading: 'How refunds are paid',
      body: [
        '- Our finance team reviews each request, usually within 2 working days.',
        '- Approved refunds go back to the method you paid with (your Khalti or eSewa wallet, or your bank account for bank transfers), usually within 7 working days. The gateway or bank may take longer to show it.',
        '- Your coordinator or our support team can tell you where a refund is at any time.',
      ],
    },
    {
      heading: 'Disputes',
      body: [
        `If something went wrong on the day, report it in the app or at ${contact} within 7 days of the event. While we look into it, we can hold the provider’s remaining payout.`,
      ],
    },
  ],
};

const DELETE_ACCOUNT: LegalDoc = {
  id: 'delete-account',
  title: `Delete your ${BRAND.name} account`,
  summary: `How to delete your ${BRAND.name} account and data, what is removed and what is kept.`,
  updated: LEGAL_VERSION,
  sections: [
    {
      heading: 'In the app',
      body: [
        `- Sign in and open Settings (couples and freelancers: Profile → Settings; businesses: Account → Settings; ${BRAND.name} staff: More → Settings).`,
        '- Tap "Delete my account" and confirm.',
        'If a booking, refund or payout is still open, the app tells you what to settle first.',
      ],
    },
    {
      heading: 'Without the app',
      body: [
        `Email ${BRAND.supportEmail} from the address you sign in with, with the subject "Delete my account". We confirm it is you, then delete the account within 30 days and email you when it is done.`,
      ],
    },
    {
      heading: 'What is deleted',
      body: [
        '- Your name, email, phone number, city and profile photo.',
        '- Your devices (push tokens), notifications and preferences.',
        '- Your private documents, including verification documents.',
        '- Business listings you own are taken offline; your freelancer profile is hidden.',
        '- You can no longer sign in with that email.',
      ],
    },
    {
      heading: 'What is kept, and for how long',
      body: [
        '- Bookings, payments, invoices and contracts, because the other people in them and Nepal’s tax and accounting laws depend on them. They are kept only as long as those laws require, and show "Deleted user" instead of your name.',
        '- Messages you sent in shared project threads stay visible to the other people in them, under "Deleted user".',
        '- Encrypted backups made before the deletion expire within 12 months.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = { terms: TERMS, privacy: PRIVACY, refunds: REFUNDS, 'delete-account': DELETE_ACCOUNT };

export const isLegalDoc = (x: unknown): x is LegalDocId => typeof x === 'string' && x in LEGAL_DOCS;
