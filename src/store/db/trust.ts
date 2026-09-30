/** Reviews (category ratings, replies, moderation) and provider/freelancer verification. */
import { findCategory } from '@/data/categories';
import { useSession } from '@/store/useSession';
import type { Account, CheckState, ReviewRecord, VerificationCase, VerificationStatus } from '@/types/platform';
import { addDays, formatMoney, uid } from '@/utils/format';

import { accountById, currentActor, type GetDb, now, ownersOf, type SetDb, today } from './helpers';
import { staffOnly } from './personas';

export interface TrustActions {
  submitReview: (input: Omit<ReviewRecord, 'id' | 'at' | 'status' | 'helpful' | 'verifiedBooking'>) => ReviewRecord;
  replyToReview: (id: string, text: string) => void;
  toggleHelpful: (id: string, accountId: string) => void;
  flagReview: (id: string, reason: string) => void;
  /** Staff with `provider.verify` or `incident.manage`. Returns an error to show, or null. */
  moderateReview: (id: string, keep: boolean) => string | null;

  submitForApproval: (account: Account) => void;
  setVerificationCheck: (caseId: string, check: keyof VerificationCase['checks'], state: CheckState) => string | null;
  /** Vendor Success, admins (`provider.verify`). Returns an error to show, or null. */
  decideVerification: (caseId: string, status: VerificationStatus, note?: string) => string | null;
  addVerificationDocument: (caseId: string, doc: { kind: string; name: string; path?: string }) => void;
  /** Admins (`user.suspend`). Returns an error to show, or null. */
  setAccountSuspended: (accountId: string, suspended: boolean, reason?: string) => string | null;
}

const SPAM = /(\d{7,}|98x+|call me|whatsapp me|http|www\.)/i;

export const trustActions = (set: SetDb, get: GetDb): TrustActions => ({
  submitReview: (input) => {
    const verifiedBooking = get().projects.some(
      (p) => p.customerId === input.authorId && p.bookings.some((b) => (b.providerId === input.targetId || b.assignments.some((a) => a.workerId === input.targetId)) && b.status !== 'CANCELLED'),
    ) || input.authorRole !== 'customer';
    const flagged = SPAM.test(input.text);
    const review: ReviewRecord = {
      ...input,
      id: uid('rv'),
      at: now(),
      helpful: [],
      verifiedBooking,
      status: flagged ? 'flagged' : 'published',
      flagReason: flagged ? 'Auto-flagged: contact details or links' : undefined,
    };
    set((s) => ({ reviews: [review, ...s.reviews] }));
    const owner = input.targetKind === 'provider' ? ownersOf(input.targetId)[0]?.id : input.targetKind === 'freelancer' && accountById(input.targetId) ? input.targetId : undefined;
    if (owner && !flagged) get().notify(owner, `New ${review.overall}★ review`, `${input.authorName}: “${input.text.slice(0, 80)}”`, input.targetKind === 'provider' ? '/business/reviews' : '/freelancer/profile', 'review');
    if (flagged) get().notify('platform', 'Review flagged for moderation', `${input.targetName}: ${review.flagReason}`, '/platform/approvals?tab=reviews', 'review');
    return review;
  },

  replyToReview: (id, text) => set((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, reply: { text, at: now() } } : r)) })),

  toggleHelpful: (id, accountId) =>
    set((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, helpful: r.helpful.includes(accountId) ? r.helpful.filter((x) => x !== accountId) : [...r.helpful, accountId] } : r)) })),

  flagReview: (id, reason) => {
    set((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, status: 'flagged', flagReason: reason } : r)) }));
    get().notify('platform', 'Review reported', reason, '/platform/approvals?tab=reviews', 'review');
  },

  moderateReview: (id, keep) => {
    const denied = staffOnly(['provider.verify', 'incident.manage'], get);
    if (denied) return denied;
    set((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, status: keep ? 'published' : 'removed' } : r)) }));
    get().log(currentActor(), keep ? 'review.keep' : 'review.remove', 'review', id);
    return null;
  },

  submitForApproval: (account) => {
    const vc: VerificationCase = {
      id: uid('vc'),
      subjectKind: account.role === 'vendor' ? 'provider' : 'freelancer',
      subjectId: account.role === 'vendor' ? (account.listingId ?? account.id) : account.id,
      title: account.businessName ?? account.name,
      subtitle: account.role === 'vendor' ? `${findCategory(account.categoryId ?? '')?.title ?? 'Vendor'} · ${account.city}` : `${(account.skills ?? []).join(', ')} · ${account.city}`,
      status: 'DOCUMENT_SUBMITTED',
      checks: { business: account.role === 'vendor' && account.panVat ? 'pending' : account.role === 'vendor' ? 'pending' : 'passed', identity: 'pending', phone: 'passed', bank: 'pending', portfolio: 'pending' },
      documents: [
        ...(account.role === 'vendor' ? [{ kind: 'PAN/VAT certificate', name: account.panVat ? `pan-${account.panVat}.pdf` : 'Not uploaded', status: 'pending' as const }] : []),
        { kind: 'Citizenship / ID', name: 'id-front.jpg', status: 'pending' },
        ...(account.role === 'freelancer' ? [{ kind: 'Day rate', name: formatMoney(account.dayRate ?? 0), status: 'passed' as const }] : []),
      ],
      submittedAt: now(),
    };
    set((s) => ({ verifications: [vc, ...s.verifications] }));
    get().notify('platform', 'New verification request', `${vc.title} · ${vc.subtitle}`, '/platform/approvals', 'system');
  },

  setVerificationCheck: (caseId, check, state) => {
    const denied = staffOnly('provider.verify', get);
    if (denied) return denied;
    set((s) => ({
      verifications: s.verifications.map((v) => (v.id === caseId ? { ...v, status: v.status === 'DOCUMENT_SUBMITTED' ? 'UNDER_REVIEW' : v.status, checks: { ...v.checks, [check]: state } } : v)),
    }));
    return null;
  },

  addVerificationDocument: (caseId, doc) =>
    set((s) => ({
      verifications: s.verifications.map((v) => (v.id === caseId ? { ...v, status: v.status === 'REJECTED' || v.status === 'UNVERIFIED' ? 'DOCUMENT_SUBMITTED' : v.status, documents: [...v.documents, { ...doc, status: 'pending' }] } : v)),
    })),

  decideVerification: (caseId, status, note) => {
    const denied = staffOnly('provider.verify', get);
    if (denied) return denied;
    const vc = get().verifications.find((v) => v.id === caseId);
    if (!vc) return 'This case no longer exists';
    set((s) => ({
      verifications: s.verifications.map((v) => (v.id === caseId ? { ...v, status, notes: note ?? v.notes, decidedAt: now(), expiresAt: status === 'VERIFIED' ? addDays(today(), 365) : v.expiresAt } : v)),
    }));
    const account = useSession.getState().accounts.find((a) => a.id === vc.subjectId || (a.listingId && a.listingId === vc.subjectId));
    if (account) {
      useSession.getState().updateAccount(account.id, { verified: status === 'VERIFIED', suspended: status === 'SUSPENDED' ? true : account.suspended });
      get().notify(
        account.id,
        status === 'VERIFIED' ? 'You’re verified' : status === 'SUSPENDED' ? 'Account suspended' : 'Verification needs attention',
        status === 'VERIFIED' ? 'The Verified badge now shows on your profile and you rank higher in matching.' : (note ?? 'Please re-upload your documents and resubmit.'),
        account.role === 'vendor' ? '/business/verification' : '/freelancer/profile',
        'system',
      );
    }
    get().log(currentActor(), 'verification.decide', 'verification', caseId, status);
    return null;
  },

  setAccountSuspended: (accountId, suspended, reason) => {
    const denied = staffOnly('user.suspend', get);
    if (denied) return denied;
    if (accountId === currentActor().id) return 'You can’t suspend your own account';
    useSession.getState().updateAccount(accountId, { suspended });
    get().log(currentActor(), suspended ? 'account.suspend' : 'account.restore', 'account', accountId, reason);
    return null;
  },
});
