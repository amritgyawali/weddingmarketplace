/**
 * Project threads, service threads and direct enquiries shared by every role.
 * Customer-visible conversation is kept apart from staff-only internal notes.
 */
import type { PhotoKey } from '@/constants/images';
import type { FileRef, InternalNote, Message, MessageKind, Thread, ThreadMember } from '@/types/platform';
import { uid } from '@/utils/format';

import { accountById, type GetDb, now, type SetDb } from './helpers';

export interface ChatActions {
  openThread: (input: { kind: Thread['kind']; title: string; members: ThreadMember[]; projectId?: string; bookingId?: string; gigId?: string; listingId?: string; image?: PhotoKey }) => string;
  sendMessage: (threadId: string, sender: ThreadMember, text: string, kind?: MessageKind, meta?: Message['meta'], opts?: { silent?: boolean }) => void;
  markThreadRead: (threadId: string, accountId: string) => void;
  toggleThreadFlag: (threadId: string, accountId: string, flag: 'archivedBy' | 'mutedBy' | 'blockedBy') => void;
  reportThread: (threadId: string, reporter: ThreadMember, reason: string) => void;
  addThreadMember: (threadId: string, member: ThreadMember) => void;

  addNote: (projectId: string, author: { id: string; name: string }, text: string) => void;
  toggleNotePin: (id: string) => void;
  deleteNote: (id: string) => void;

  addFile: (file: Omit<FileRef, 'id' | 'at'>) => void;
  removeFile: (id: string) => void;
}

const AUTO_REPLIES = [
  'Namaste! Thank you for reaching out. Could you share your event date and approximate guest count?',
  'Thanks for your interest! We’ll share our brochure and package prices shortly.',
  'Great to hear from you! A few dates are still open in your season — shall we schedule a site visit or a quick call?',
];

/** Timers for simulated replies from unclaimed listings (cleared on reset). */
const replyTimers = new Set<ReturnType<typeof setTimeout>>();
export const clearReplyTimers = () => {
  replyTimers.forEach(clearTimeout);
  replyTimers.clear();
};

const hrefFor = (thread: Thread, memberRole: ThreadMember['role']) =>
  memberRole === 'vendor' ? `/business/inbox/${thread.id}` : memberRole === 'freelancer' ? `/freelancer/inbox/${thread.id}` : memberRole === 'platform' ? `/platform/inbox/${thread.id}` : `/inbox/${thread.id}`;

export const chatActions = (set: SetDb, get: GetDb): ChatActions => ({
  openThread: (input) => {
    const existing = get().threads.find(
      (t) =>
        t.kind === input.kind &&
        (input.projectId ? t.projectId === input.projectId : true) &&
        (input.bookingId ? t.bookingId === input.bookingId : !t.bookingId) &&
        (input.gigId ? t.gigId === input.gigId : true) &&
        (input.listingId ? t.listingId === input.listingId : true) &&
        input.members.every((m) => t.members.some((x) => x.id === m.id)),
    );
    if (existing) return existing.id;
    const thread: Thread = { id: uid('th'), ...input, lastAt: now(), archivedBy: [], mutedBy: [], blockedBy: [] };
    set((s) => ({ threads: [thread, ...s.threads] }));
    return thread.id;
  },

  sendMessage: (threadId, sender, text, kind = 'text', meta, opts = {}) => {
    const trimmed = text.trim();
    if (!trimmed && kind === 'text') return;
    const thread = get().threads.find((t) => t.id === threadId);
    if (!thread || thread.blockedBy.length) return;
    const message: Message = { id: uid('msg'), threadId, senderId: sender.id, senderName: sender.name, senderRole: sender.role, kind, text: trimmed, meta, at: now(), readBy: [sender.id] };
    set((s) => ({
      messages: [...s.messages, message],
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, lastAt: message.at, archivedBy: [], typing: undefined } : t)),
    }));
    if (!opts.silent) {
      thread.members
        .filter((m) => m.id !== sender.id && accountById(m.id) && !thread.mutedBy.includes(m.id))
        .forEach((m) => get().notify(m.id, sender.name, kind === 'text' ? trimmed : `Sent a ${kind}`, hrefFor(thread, m.role), 'message'));
    }

    // Enquiry to an unclaimed listing: simulate the business replying.
    const others = thread.members.filter((m) => m.id !== sender.id);
    const unclaimed = thread.kind === 'direct' && sender.role === 'customer' && others.length > 0 && others.every((m) => !accountById(m.id));
    if (unclaimed) {
      const other = others[0];
      const isFirst = !get().messages.some((m) => m.threadId === threadId && m.senderId === sender.id && m.id !== message.id);
      const typing = setTimeout(() => {
        replyTimers.delete(typing);
        set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, typing: { id: other.id, name: other.name, at: now() } } : t)) }));
      }, 700);
      const timer = setTimeout(() => {
        replyTimers.delete(timer);
        const reply: Message = {
          id: uid('msg'),
          threadId,
          senderId: other.id,
          senderName: other.name,
          senderRole: other.role,
          kind: 'text',
          text: isFirst ? AUTO_REPLIES[0] : AUTO_REPLIES[1 + Math.floor(Math.random() * (AUTO_REPLIES.length - 1))],
          at: now(),
          readBy: [other.id],
        };
        set((s) => ({ messages: [...s.messages, reply], threads: s.threads.map((t) => (t.id === threadId ? { ...t, lastAt: reply.at, typing: undefined } : t)) }));
        get().notify(sender.id, other.name, reply.text, `/inbox/${threadId}`, 'message');
      }, 2200);
      replyTimers.add(typing);
      replyTimers.add(timer);
    }
  },

  markThreadRead: (threadId, accountId) =>
    set((s) => ({ messages: s.messages.map((m) => (m.threadId === threadId && !m.readBy.includes(accountId) ? { ...m, readBy: [...m.readBy, accountId] } : m)) })),

  toggleThreadFlag: (threadId, accountId, flag) =>
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, [flag]: t[flag].includes(accountId) ? t[flag].filter((x) => x !== accountId) : [...t[flag], accountId] } : t)),
    })),

  reportThread: (threadId, reporter, reason) => {
    const thread = get().threads.find((t) => t.id === threadId);
    get().notify('platform', 'Conversation reported', `${reporter.name}: ${reason} (${thread?.title ?? threadId})`, `/platform/inbox/${threadId}`, 'system');
  },

  addThreadMember: (threadId, member) =>
    set((s) => ({ threads: s.threads.map((t) => (t.id === threadId && !t.members.some((m) => m.id === member.id) ? { ...t, members: [...t.members, member] } : t)) })),

  addNote: (projectId, author, text) => {
    const note: InternalNote = { id: uid('note'), projectId, authorId: author.id, authorName: author.name, text: text.trim(), pinned: false, at: now() };
    if (!note.text) return;
    set((s) => ({ notes: [note, ...s.notes] }));
  },
  toggleNotePin: (id) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) })),
  deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  addFile: (file) => set((s) => ({ files: [{ ...file, id: uid('f'), at: now() }, ...s.files] })),
  removeFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
});
