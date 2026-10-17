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
import { formatMoney } from '@/utils/format';
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
  'setHomeOrder',
  'mirrorSupportTickets',
]);

/**
 * Exact messages for the actions people take. Each one says what happened in
 * plain words and, where it helps, what happens next ("…we'll let you know").
 * Keep them short (one line on a phone), sentence case, no emoji.
 */
const MESSAGES: Record<string, string> = {
  // Guests, RSVPs and seating
  addGuest: 'Guest added to your list',
  removeGuest: 'Guest removed from your list',
  updateGuest: 'Guest details saved',
  importGuests: 'Guests imported. Check the list for any duplicates',
  checkInGuest: 'Guest checked in. Welcome them in!',
  sendInvites: 'Invitations sent. RSVPs will appear here as guests reply',
  respondRsvp: 'Thank you! Your RSVP has reached the couple',
  saveSeating: 'Seating plan saved',
  autoSeat: 'Guests seated by family and side. Drag anyone to change',
  assignSeat: 'Seat assigned',
  addSeatingElement: 'Table added to the floor plan',
  removeSeatingElement: 'Table removed from the floor plan',
  // Planning: tasks, checklist, budget, functions, timeline
  addTask: 'Task added to your plan',
  removeTask: 'Task deleted',
  updateTask: 'Task saved',
  setTaskStatus: 'Task updated',
  toggleTask: 'Checklist updated',
  regenerateChecklist: 'Checklist refreshed for your date and services',
  addBudgetLine: 'Budget item added',
  removeBudgetLine: 'Budget item deleted',
  updateBudgetLine: 'Budget saved',
  addEvent: 'Function added to your celebration',
  removeEvent: 'Function removed',
  updateEvent: 'Function details saved',
  addTimelineEntry: 'Added to your timeline',
  toggleTimelineEntry: 'Timeline updated',
  addRunItem: 'Added to the run sheet',
  addNote: 'Note saved',
  deleteNote: 'Note deleted',
  toggleNotePin: 'Note pinned status changed',
  addBoard: 'Board created. Start saving ideas to it',
  deleteBoard: 'Board deleted',
  renameBoard: 'Board renamed',
  toggleBoardItem: 'Idea board updated',
  toggleShortlist: 'Shortlist updated',
  updateShortlist: 'Shortlist updated',
  saveWebsite: 'Wedding website saved',
  addRegistryItem: 'Gift added to your registry',
  removeRegistryItem: 'Gift removed from your registry',
  updateRegistryItem: 'Gift details saved',
  markContributionThanked: 'Marked as thanked',
  inviteCollaborator: 'Invite sent. They can join with the code you shared',
  removeCollaborator: 'Removed from your planning team',
  submitPlan: 'Plan sent! Your coordinator will be in touch within a day',
  // Enquiries, quotations and bookings
  createLead: 'Enquiry sent. The vendor usually replies within a few hours',
  addBooking: 'Enquiry sent. The vendor usually replies within a few hours',
  setLeadStatus: 'Lead status updated',
  updateLead: 'Lead details saved',
  addLeadNote: 'Note added to the lead',
  saveQuote: 'Quotation saved as a draft',
  sendQuote: 'Quotation sent. The couple will be notified right away',
  reviseQuote: 'New version started. The sent version stays unchanged',
  draftProjectQuote: 'Draft quotation ready to review',
  proposeBooking: 'Booking proposed. Waiting for the provider to confirm',
  confirmBooking: 'Booking confirmed. Payments and calendar are set up',
  cancelBooking: 'Booking cancelled',
  setBookingStatus: 'Booking updated',
  updateBooking: 'Booking details saved',
  signContract: 'Contract signed. A copy is saved in Contracts',
  saveContract: 'Contract saved',
  redeemDeal: 'Deal saved to your plan. Mention it when you book',
  saveDeal: 'Deal saved',
  // Money
  contribute: 'Thank you! Your gift has reached the couple',
  waiveMilestone: 'Payment waived. The couple no longer owes it',
  requestRefund: 'Refund requested. Our finance team will reply within 3 working days',
  raiseDispute: 'Dispute opened. Our team will look into it and get back to you',
  updateDispute: 'Dispute updated',
  holdPayable: 'Payout put on hold',
  markPayableReady: 'Payout marked ready to release',
  releasePayable: 'Payout released to the provider',
  saveInvoice: 'Invoice saved',
  // Vendor business
  addPortfolioItem: 'Added to your portfolio',
  removePortfolioItem: 'Removed from your portfolio',
  updatePortfolioItem: 'Portfolio photo saved',
  savePackage: 'Package saved. Couples can see it on your listing',
  removePackage: 'Package deleted',
  saveStaff: 'Team member saved',
  removeStaff: 'Team member removed',
  addAvailabilityRule: 'Weekly rule added to your calendar',
  removeAvailabilityRule: 'Weekly rule removed',
  setAvailability: 'Calendar updated',
  setProviderPersona: 'Your services are saved. Your tools now match them',
  setFreelancerPersona: 'Your craft is saved. Your gig feed now matches it',
  addVerificationDocument: 'Document uploaded. We usually review it within 2 working days',
  replyToReview: 'Reply posted under the review',
  // Freelancer gigs and crew
  postGig: 'Gig posted. Matching freelancers will be notified',
  cancelGig: 'Gig cancelled. Applicants have been told',
  applyToGig: 'Application sent. You’ll hear back once the poster decides',
  withdrawApplication: 'Application withdrawn',
  inviteToGig: 'Invite sent to the freelancer',
  askGigQuestion: 'Question sent to the poster',
  answerGigQuestion: 'Answer posted',
  setApplicationStatus: 'Applicant updated',
  setCrew: 'Crew plan saved',
  assignWorker: 'Crew member assigned',
  checkIn: 'Checked in. Have a great event!',
  checkOut: 'Checked out. Thank you for your work today',
  checkInAssignment: 'Checked in. Have a great event!',
  checkOutAssignment: 'Checked out. Thank you for your work today',
  confirmAssignmentWork: 'Work confirmed. The payout moves forward',
  // Wedding day and operations
  reportIncident: 'Issue reported. The coordinator has been alerted',
  resolveIncident: 'Issue marked as resolved',
  startEmergencyReplacement: 'Emergency replacement started. Nearby freelancers are being invited',
  assignCoordinator: 'Coordinator assigned',
  runMatching: 'Matching done. Ranked providers are ready to review',
  addRequirement: 'Service added to the plan',
  removeRequirement: 'Service removed from the plan',
  updateRequirement: 'Service details saved',
  addDeliverable: 'Deliverable added',
  updateDeliverable: 'Deliverable updated',
  patchProject: 'Celebration details saved',
  updateProject: 'Celebration details saved',
  // Reviews
  submitReview: 'Thank you! Your review helps other couples',
  addReview: 'Thank you! Your review helps other couples',
  toggleHelpful: 'Thanks for the feedback',
  flagReview: 'Review reported. Our team will check it',
  // Messages and support
  addThreadMember: 'Added to the conversation',
  toggleThreadFlag: 'Conversation flag changed',
  reportThread: 'Conversation reported. Our team will review it',
  openSupportTicket: 'Request sent. Our team usually replies within a few hours',
  replySupportTicket: 'Reply sent',
  setSupportTicketStatus: 'Request updated',
  assignSupportTicket: 'Request assigned',
  rateSupportTicket: 'Thank you for rating our help',
  updateMyProfile: 'Profile updated',
  addFile: 'File added',
  removeFile: 'File removed',
  // Tools
  addToolEntry: 'Added',
  removeToolEntry: 'Deleted',
  updateToolEntry: 'Saved',
  toggleToolEntry: 'Updated',
  // Staff and super admin
  sendBroadcast: 'Broadcast sent to everyone in that group',
  addOccasion: 'Occasion added',
  updateOccasion: 'Occasion saved',
  removeOccasion: 'Occasion deleted',
  updateSettings: 'Settings saved',
  setFeature: 'Feature switch saved',
  setFeatures: 'Feature switches saved',
  resetFeatures: 'Every feature is back to its default',
  setTextOverride: 'Text updated in the app',
  setContentImage: 'Photo updated',
  saveContentEntry: 'Saved. It shows in the app now',
  setContentHidden: 'Visibility saved',
  restoreContentEntry: 'Original restored',
  setHomeTitle: 'Heading saved',
  saveBanner: 'Banner saved',
  removeBanner: 'Banner deleted',
  setBrandField: 'Brand details saved',
  resetContent: 'Original content restored',
  resetTextOverrides: 'Original text restored',
  addAnnouncement: 'Announcement published',
  updateAnnouncement: 'Announcement updated',
  removeAnnouncement: 'Announcement deleted',
  adminSaveRecord: 'Record saved',
  adminInsertRecord: 'Record added',
  adminDeleteRecords: 'Records deleted',
  adminSaveAccount: 'Account saved',
  adminCreateAccount: 'Account created',
  adminDeleteAccount: 'Account deleted',
  setBugReportStatus: 'Bug report updated',
  removeBugReports: 'Bug report deleted',
  setVerificationCheck: 'Check saved',
  clearRecentSearches: 'Recent searches cleared',
  // Social hub
  connectSocialAccount: 'Account connected. New messages will arrive in your inbox',
  disconnectSocialAccount: 'Account disconnected',
  reconnectSocialAccount: 'Account reconnected',
  sendSocialReply: 'Reply sent',
  addSocialNote: 'Note added for your team',
  setSocialThreadStatus: 'Conversation updated',
  toggleSocialThreadStar: 'Conversation starred status changed',
  setSocialThreadLabels: 'Labels saved',
  assignSocialThread: 'Conversation assigned',
  createLeadFromSocialThread: 'Lead created. Find it in your leads',
  saveSocialPost: 'Draft saved',
  scheduleSocialPost: 'Post scheduled. It will go out at the time you picked',
  publishSocialPost: 'Publishing your post now',
  retrySocialPost: 'Trying again',
  duplicateSocialPost: 'Copied as a new draft',
  deleteSocialPost: 'Post deleted',
  updateSocialSettings: 'Settings saved',
  setSocialOptIn: 'WhatsApp updates preference saved',
};

/** Messages that depend on what was chosen: accepted or declined, which status, how much. */
function detailedMessage(action: string, args: unknown[]): string | null {
  const [, a1, a2] = args;
  switch (action) {
    case 'payMilestone':
      return typeof a2 === 'number' && a2 > 0 ? `Payment of ${formatMoney(a2)} received. Your receipt is in Payments` : 'Payment received. Your receipt is in Payments';
    case 'contribute':
      return typeof a2 === 'number' && a2 > 0 ? `Thank you! Your gift of ${formatMoney(a2)} has reached the couple` : null;
    case 'respondToQuote':
      return a1 === 'accept' ? 'Quotation accepted. Your bookings and payment plan are ready' : a1 === 'decline' ? 'Quotation declined. Your coordinator has been told' : a1 === 'revision' ? 'Changes requested. You’ll get a new version to compare' : null;
    case 'respondToBooking':
      return a2 === true ? 'Booking accepted. It’s on your calendar now' : a2 === false ? 'Booking declined. The coordinator has been told' : null;
    case 'respondToInvite':
      return a2 === true ? 'Invite accepted. The gig is in your jobs' : a2 === false ? 'Invite declined' : null;
    case 'decideRefund':
      return a1 === true ? 'Refund approved. The couple will be notified' : a1 === false ? 'Refund declined. The couple will be notified' : null;
    case 'moderateReview':
      return a1 === true ? 'Review kept on the listing' : a1 === false ? 'Review hidden from the listing' : null;
    case 'setAccountSuspended':
      return a1 === true ? 'Account suspended. They can’t sign in until you lift it' : a1 === false ? 'Suspension lifted. They can sign in again' : null;
    case 'decideVerification':
      return a1 === 'VERIFIED' ? 'Verified. The listing now shows the verified badge' : a1 === 'REJECTED' ? 'Verification rejected. The provider has been told why' : a1 === 'SUSPENDED' ? 'Provider suspended' : null;
    case 'setLeadStatus':
      return a1 === 'won' ? 'Lead marked as won. Congratulations!' : a1 === 'lost' ? 'Lead marked as lost' : a1 === 'archived' ? 'Lead archived' : typeof a1 === 'string' ? `Lead moved to ${LEAD_STATUS_LABEL[a1] ?? a1}` : null;
    case 'setBookingStatus':
      return a1 === 'CONFIRMED' ? 'Booking confirmed' : a1 === 'CANCELLED' ? 'Booking cancelled' : a1 === 'COMPLETED' ? 'Booking marked as completed' : null;
    case 'setSupportTicketStatus':
      return a1 === 'resolved' ? 'Marked as solved. Reopen it any time if you need more help' : a1 === 'closed' ? 'Request closed' : a1 === 'open' ? 'Request reopened. Our team will pick it up' : null;
    default:
      return null;
  }
}

/** Lead statuses as people say them. */
const LEAD_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  responded: 'Responded',
  quoted: 'Quoted',
  negotiating: 'Negotiating',
  meeting: 'Meeting',
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
  const detailed = detailedMessage(action, args);
  if (detailed) return detailed;
  if (MESSAGES[action]) return MESSAGES[action];
  const rule = VERBS.find(([re]) => re.test(action));
  if (!rule) return null;
  const noun = action
    .replace(rule[0], '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  if (rule[1] === 'done') return noun ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} done` : 'Done';
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
  // Shortlist toggles return whether the item is now saved.
  if (action === 'toggleShortlist' && typeof result === 'boolean') {
    toast(result ? 'Saved to your shortlist' : 'Removed from your shortlist', result ? 'heart' : 'heart-dislike-outline');
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
