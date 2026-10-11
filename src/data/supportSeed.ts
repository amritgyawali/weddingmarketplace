/**
 * Demo help requests, one story per role: the couple asked about changing
 * the reception menu (the team asked a question back) and had a receipt
 * question answered; the venue is waiting on a payout answer; the
 * photographer's payout number change is being handled. Times are relative to
 * now, so the demo always looks recent.
 */
import type { SupportMessage, SupportTicket, UserRole } from '@/types/platform';

/** Minutes before now. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SITA = { id: 'acc_platform_demo', name: 'Sita Karki', role: 'platform' as const };
const PRAKASH = { id: 'acc_platform_vendor_success', name: 'Prakash Thapa', role: 'platform' as const };
const NISHA = { id: 'acc_platform_finance', name: 'Nisha Rai', role: 'platform' as const };

const msg = (id: string, minutesAgo: number, who: { id: string; name: string; role: UserRole }, body: string, internal?: boolean): SupportMessage => ({
  id,
  at: ago(minutesAgo),
  authorId: who.id,
  authorName: who.name,
  authorRole: who.role,
  body,
  ...(internal ? { internal: true } : {}),
});

export function buildSupportSeed(): { supportTickets: SupportTicket[] } {
  const aakriti = { id: 'acc_customer_demo', name: 'Aakriti Shrestha', role: 'customer' as const };
  const rajesh = { id: 'acc_vendor_demo', name: 'Rajesh Pradhan', role: 'vendor' as const };
  const raj = { id: 'acc_freelancer_demo', name: 'Raj Maharjan', role: 'freelancer' as const };
  const year = new Date().getFullYear();
  return {
    supportTickets: [
      {
        id: 'sup_menu',
        code: `SUP-${year}-0104`,
        accountId: aakriti.id,
        accountName: aakriti.name,
        role: 'customer',
        topic: 'booking',
        subject: 'Can we change the reception menu after confirming?',
        priority: 'normal',
        status: 'waiting',
        projectId: 'prj_1021',
        assignedTo: SITA.id,
        assignedName: SITA.name,
        createdAt: ago(60 * 26),
        updatedAt: ago(95),
        messages: [
          msg('sm_1', 60 * 26, aakriti, 'Namaste! Sujan’s family would like to add a live momo counter to the reception. The booking with Everest Grand is already confirmed. Can we still change the menu?'),
          msg('sm_2', 60 * 25, SITA, 'Everest Grand confirms menu changes up to 10 days before the function.', true),
          msg('sm_3', 95, SITA, 'Namaste Aakriti! Yes, you can. Everest Grand can add a live momo counter for about NPR 180 a plate. How many guests should we plan it for? I will send you a revised quotation to accept in the app.'),
        ],
      },
      {
        id: 'sup_receipt',
        code: `SUP-${year}-0101`,
        accountId: aakriti.id,
        accountName: aakriti.name,
        role: 'customer',
        topic: 'payment',
        subject: 'Receipt for our first payment',
        priority: 'normal',
        status: 'resolved',
        projectId: 'prj_1021',
        assignedTo: NISHA.id,
        assignedName: NISHA.name,
        createdAt: ago(60 * 24 * 9),
        updatedAt: ago(60 * 24 * 8),
        resolvedAt: ago(60 * 24 * 8),
        rating: 5,
        ratingNote: 'Quick and clear, thank you!',
        messages: [
          msg('sm_4', 60 * 24 * 9, aakriti, 'We paid the confirmation amount by Khalti. Where can we download the receipt for the family?'),
          msg('sm_5', 60 * 24 * 8 + 30, NISHA, 'Namaste! The receipt is in My Wedding → Payments. Tap the payment and choose Share or Print. Thank you!'),
        ],
      },
      {
        id: 'sup_payout',
        code: `SUP-${year}-0103`,
        accountId: rajesh.id,
        accountName: rajesh.name,
        role: 'vendor',
        topic: 'payment',
        subject: 'When is the advance for Sneha & Arjun released?',
        priority: 'high',
        status: 'open',
        createdAt: ago(180),
        updatedAt: ago(180),
        messages: [
          msg('sm_6', 180, rajesh, 'Namaste. The wedding is next month and we need to book the extra kitchen staff. When will the 40% advance reach our bank account?'),
          msg('sm_7', 179, { id: 'system', name: 'Vivah support', role: 'platform' }, 'Thank you, we have your request. The team replies within two working hours, 9am to 7pm.'),
        ],
      },
      {
        id: 'sup_esewa',
        code: `SUP-${year}-0102`,
        accountId: raj.id,
        accountName: raj.name,
        role: 'freelancer',
        topic: 'account',
        subject: 'Change my eSewa number for payouts',
        priority: 'normal',
        status: 'in_progress',
        assignedTo: PRAKASH.id,
        assignedName: PRAKASH.name,
        createdAt: ago(60 * 30),
        updatedAt: ago(60 * 5),
        messages: [
          msg('sm_8', 60 * 30, raj, 'I have a new eSewa number, 9812345678. Please send my next payouts there.'),
          msg('sm_9', 60 * 5, PRAKASH, 'Namaste Raj! We need to confirm the new number is yours before the next payout. We will call you from 01-5970000 today.'),
        ],
      },
    ],
  };
}
