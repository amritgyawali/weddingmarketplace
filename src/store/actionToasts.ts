/**
 * A short confirmation after every change a user makes — "Guest added",
 * "Task deleted", "Marked as done" — without touching each screen.
 *
 * Store actions are wrapped once at start-up. After an action runs, the
 * wrapper waits a tick: if the screen showed its own toast meanwhile, that
 * one stays; otherwise a message is built from the action's name. Actions
 * that return an error string show it in red. Background actions (logging,
 * notifications, presets, timers) are skipped. A super admin can switch this
 * off with the `app.notifications` feature.
 */
import { lastToastAt, toast, toastError } from '@/components/ui/Toast';
import { featureOn } from '@/data/features';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { actionDepth } from '@/store/quiet';

/** Never toast these: internal, automatic or called on every keystroke or drag. */
const SILENT = new Set([
  'log',
  'notify',
  'markNotificationRead',
  'markNotificationsRead',
  'markThreadRead',
  'markQuoteViewed',
  'recordWebsiteView',
  'openThread',
  'ensureToolPreset',
  'ensureCustomerProject',
  'seedVendorWorkspace',
  'submitForApproval',
  'moveSeatingElement',
  'movePortfolioItem',
  'freelancerPool',
  'sendMessage',
  'setToolState',
  'resetDemo',
  'bindOwner',
  'setRole',
  'setWeddingDate',
  'setCity',
  'setActiveProject',
  'markRead',
  'addRecentSearch',
  'openConversation',
  'signOut',
  'completeOnboarding',
  'resetOnboarding',
  'saveWeddingBasics',
  'updateProfile',
  'toggleLike',
  'joinWedding',
  'migrate',
  'partialize',
  'receiveSocialMessage',
  'markSocialThreadRead',
  'runDueSocialPosts',
  'syncSocialInbox',
  'mirrorSocialData',
  'submitBugReport',
]);

/** Exact messages for the most common actions. */
const MESSAGES: Record<string, string> = {
  addGuest: 'Guest added',
  setBugReportStatus: 'Bug report updated',
  removeBugReports: 'Bug report deleted',
  removeGuest: 'Guest removed',
  updateGuest: 'Guest updated',
  importGuests: 'Guests imported',
  checkInGuest: 'Guest checked in',
  addTask: 'Task added',
  removeTask: 'Task deleted',
  updateTask: 'Task updated',
  setTaskStatus: 'Task updated',
  toggleTask: 'Checklist updated',
  addToolEntry: 'Added',
  removeToolEntry: 'Deleted',
  updateToolEntry: 'Saved',
  toggleToolEntry: 'Updated',
  addBudgetLine: 'Budget line added',
  removeBudgetLine: 'Budget line deleted',
  updateBudgetLine: 'Budget updated',
  addRegistryItem: 'Gift added',
  removeRegistryItem: 'Gift removed',
  updateRegistryItem: 'Gift updated',
  addEvent: 'Function added',
  removeEvent: 'Function removed',
  updateEvent: 'Function updated',
  addNote: 'Note added',
  deleteNote: 'Note deleted',
  toggleNotePin: 'Note updated',
  addBoard: 'Board created',
  deleteBoard: 'Board deleted',
  renameBoard: 'Board renamed',
  toggleBoardItem: 'Board updated',
  toggleShortlist: 'Shortlist updated',
  addPortfolioItem: 'Added to portfolio',
  removePortfolioItem: 'Removed from portfolio',
  updatePortfolioItem: 'Portfolio updated',
  savePackage: 'Package saved',
  removePackage: 'Package deleted',
  saveStaff: 'Team member saved',
  removeStaff: 'Team member removed',
  saveQuote: 'Quotation saved',
  sendQuote: 'Quotation sent',
  reviseQuote: 'New version started',
  respondToQuote: 'Response sent',
  createLead: 'Enquiry sent',
  setLeadStatus: 'Lead updated',
  updateLead: 'Lead updated',
  addLeadNote: 'Note added',
  submitPlan: 'Plan submitted',
  payMilestone: 'Payment recorded',
  contribute: 'Contribution recorded',
  postGig: 'Gig posted',
  cancelGig: 'Gig cancelled',
  applyToGig: 'Application sent',
  withdrawApplication: 'Application withdrawn',
  inviteToGig: 'Invite sent',
  respondToInvite: 'Response sent',
  checkIn: 'Checked in',
  checkOut: 'Checked out',
  checkInAssignment: 'Checked in',
  checkOutAssignment: 'Checked out',
  submitReview: 'Review posted',
  replyToReview: 'Reply posted',
  addAvailabilityRule: 'Weekly rule added',
  removeAvailabilityRule: 'Weekly rule removed',
  setAvailability: 'Calendar updated',
  saveWebsite: 'Website saved',
  saveSeating: 'Seating saved',
  autoSeat: 'Guests seated',
  assignSeat: 'Seat assigned',
  addSeatingElement: 'Table added',
  removeSeatingElement: 'Table removed',
  sendInvites: 'Invitations sent',
  respondRsvp: 'RSVP sent',
  inviteCollaborator: 'Invite sent',
  removeCollaborator: 'Removed',
  signContract: 'Contract signed',
  saveContract: 'Contract saved',
  addFile: 'File added',
  removeFile: 'File removed',
  addVerificationDocument: 'Document uploaded',
  sendBroadcast: 'Broadcast sent',
  addOccasion: 'Occasion added',
  updateOccasion: 'Occasion saved',
  removeOccasion: 'Occasion deleted',
  updateSettings: 'Settings saved',
  setFeature: 'Feature updated',
  setFeatures: 'Features updated',
  resetFeatures: 'Every feature is on again',
  setTextOverride: 'Text updated',
  resetTextOverrides: 'Original text restored',
  addAnnouncement: 'Announcement published',
  updateAnnouncement: 'Announcement updated',
  removeAnnouncement: 'Announcement deleted',
  adminSaveRecord: 'Record saved',
  adminInsertRecord: 'Record added',
  adminDeleteRecords: 'Deleted',
  adminSaveAccount: 'Account saved',
  adminCreateAccount: 'Account created',
  adminDeleteAccount: 'Account deleted',
  setProviderPersona: 'Services saved',
  setFreelancerPersona: 'Craft saved',
  addBooking: 'Enquiry sent',
  setBookingStatus: 'Booking updated',
  addReview: 'Review posted',
  clearRecentSearches: 'Searches cleared',
  connectSocialAccount: 'Account connected',
  disconnectSocialAccount: 'Account disconnected',
  reconnectSocialAccount: 'Account reconnected',
  sendSocialReply: 'Reply sent',
  addSocialNote: 'Note added',
  setSocialThreadStatus: 'Conversation updated',
  toggleSocialThreadStar: 'Conversation updated',
  setSocialThreadLabels: 'Labels saved',
  assignSocialThread: 'Conversation assigned',
  createLeadFromSocialThread: 'Lead created',
  saveSocialPost: 'Draft saved',
  scheduleSocialPost: 'Post scheduled',
  publishSocialPost: 'Publishing',
  retrySocialPost: 'Trying again',
  duplicateSocialPost: 'Copied as a draft',
  deleteSocialPost: 'Post deleted',
  updateSocialSettings: 'Settings saved',
  setSocialOptIn: 'WhatsApp updates saved',
};

/** Past-tense verbs for the fallback message: removeThing → "Thing removed". */
const VERBS: [RegExp, string][] = [
  [/^(add|create|post|upload|import)/, 'added'],
  [/^(remove|delete|clear)/, 'deleted'],
  [/^(update|save|set|patch|rename|edit|move|regenerate)/, 'saved'],
  [/^(send|invite|share|ask|answer|reply|report|raise|request|submit|propose|draft)/, 'sent'],
  [/^(toggle|mark|flag)/, 'updated'],
  [/^(approve|accept|confirm|sign|activate|redeem)/, 'confirmed'],
  [/^(decline|reject|cancel|withdraw|hold|waive)/, 'updated'],
  [/^(complete|resolve|release|pay|record|assign|start|run|check|decide|moderate|respond|join|contribute)/, 'done'],
];

/** Where `setTaskStatus(projectId, taskId, status)` moved the task. */
const TASK_STATUS_MESSAGES: Record<string, string> = {
  TODO: 'Task moved back to To do',
  IN_PROGRESS: 'Task moved to In progress',
  WAITING: 'Task moved to Waiting',
  COMPLETED: 'Task marked as completed',
  CANCELLED: 'Task cancelled',
};

/** "addBudgetLine" → "Budget line added". */
export function messageFor(action: string, args: unknown[] = []): string | null {
  if (action === 'setTaskStatus' && typeof args[2] === 'string' && TASK_STATUS_MESSAGES[args[2]]) return TASK_STATUS_MESSAGES[args[2]];
  if (MESSAGES[action]) return MESSAGES[action];
  const rule = VERBS.find(([re]) => re.test(action));
  if (!rule) return null;
  const noun = action
    .replace(rule[0], '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  if (rule[1] === 'done') return 'Done';
  if (!noun) return rule[1] === 'saved' ? 'Saved' : rule[1] === 'deleted' ? 'Deleted' : 'Updated';
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${rule[1]}`;
}

/** Ids look like `gst_mfq3k2_ab12cd`; an error is a sentence. */
const isErrorText = (x: unknown): x is string => typeof x === 'string' && /\s/.test(x.trim()) && x.trim().length > 3;

function report(action: string, args: unknown[], result: unknown, startedAt: number) {
  if (!featureOn(useDb.getState().featureFlags, 'app.notifications')) return;
  // The screen showed its own message for this action: keep it.
  if (lastToastAt() >= startedAt) return;
  const error = isErrorText(result) ? result : result && typeof result === 'object' && 'error' in result && isErrorText((result as { error?: unknown }).error) ? (result as { error: string }).error : null;
  if (error) {
    toastError(error);
    return;
  }
  if (result === false) return;
  const message = messageFor(action, args);
  if (message) toast(message);
}

function wrapStore<S extends object>(store: { getState: () => S }) {
  const state = store.getState() as Record<string, unknown>;
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(state)) {
    if (typeof value !== 'function' || SILENT.has(name)) continue;
    const fn = value as (...args: unknown[]) => unknown;
    wrapped[name] = (...args: unknown[]) => {
      // Only the outermost call (the one a screen made) is announced.
      const top = actionDepth.current === 0;
      const startedAt = Date.now();
      actionDepth.current++;
      let result: unknown;
      try {
        result = fn(...args);
      } finally {
        actionDepth.current--;
      }
      if (top) setTimeout(() => report(name, args, result, startedAt), 0);
      return result;
    };
  }
  // Swapped in place, not with setState: a set before the store is rehydrated
  // would be persisted and overwrite the saved data with the initial state.
  // Every later state object is spread from this one, so the wrappers stay.
  Object.assign(store.getState() as Record<string, unknown>, wrapped);
}

let installed = false;

/** Wraps the store actions once (root layout). Timers that call actions use `quietly()`. */
export function installActionToasts() {
  if (installed) return;
  installed = true;
  wrapStore(useDb);
  wrapStore(useAppStore);
}
