/**
 * Shared domain model for the wedding-services orchestration marketplace.
 * Every role (couple, provider, freelancer, platform team) reads and writes
 * the same entities; see supabase/migrations for the matching SQL schema.
 *
 *   Customer ─ Project ─┬─ ProjectEvent (functions)
 *                       ├─ Requirement ── ServiceBooking ── Assignment ── Freelancer / staff
 *                       ├─ Quotation (versioned)
 *                       ├─ PaymentMilestone ── Payment      (customer money)
 *                       ├─ Payable / RevenueEntry            (payouts, kept separate)
 *                       ├─ ProjectTask, TimelineEntry, Deliverable
 *                       └─ Thread ── Message                 (InternalNote is separate)
 */
import type { PhotoKey } from '@/constants/images';

export type UserRole = 'customer' | 'vendor' | 'freelancer' | 'platform';
/** Platform-team roles (admin console permissions). */
export type StaffRole = 'coordinator' | 'admin' | 'support' | 'finance' | 'super_admin';
export type PlatformTeam = 'Wedding Coordination' | 'Wedding Operations' | 'Vendor Success' | 'Finance' | 'Admin';

export type VerificationStatus = 'UNVERIFIED' | 'DOCUMENT_SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface Equipment {
  kind: 'camera' | 'lens' | 'flash' | 'drone' | 'gimbal' | 'light' | 'audio' | 'vehicle' | 'kit' | 'other';
  name: string;
}

export interface AccountPrefs {
  /** Notification kinds the user muted (no badge; still listed). */
  muted: NonNullable<AppNotification['kind']>[];
  channels: { push: boolean; sms: boolean; whatsapp: boolean; email: boolean };
  language: 'en' | 'ne';
  /** How dates are shown: Gregorian (AD), Bikram Sambat (BS) or both. */
  calendar: 'AD' | 'BS' | 'both';
  showProfileToVendors: boolean;
  marketing: boolean;
}

export interface Account {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email?: string;
  city: string;
  createdAt: string;
  verified: boolean;
  /** Suspended accounts cannot sign in. */
  suspended?: boolean;
  /** vendor */
  businessName?: string;
  categoryId?: string;
  listingKind?: 'venue' | 'vendor';
  listingId?: string;
  panVat?: string;
  /** freelancer */
  skills?: string[];
  dayRate?: number;
  hourlyRate?: number;
  eventRate?: number;
  bio?: string;
  headline?: string;
  available?: boolean;
  rating?: number;
  equipment?: Equipment[];
  travelRadiusKm?: number;
  languages?: string[];
  experienceYears?: number;
  ownVehicle?: boolean;
  /** Where payouts land (freelancers and providers). */
  payoutMethod?: { kind: 'esewa' | 'khalti' | 'bank'; detail: string };
  /** Notification, language and privacy preferences (every role). */
  prefs?: AccountPrefs;
  /** platform */
  team?: PlatformTeam;
  staffRole?: StaffRole;
}

// ── Reference ──────────────────────────────────────────────────────────

export type EventType =
  | 'WEDDING'
  | 'ENGAGEMENT'
  | 'PRE_WEDDING'
  | 'POST_WEDDING'
  | 'PASNI'
  | 'BRATABANDHA'
  | 'ANNIVERSARY'
  | 'RECEPTION'
  | 'MEHENDI'
  | 'HALDI'
  | 'SANGEET'
  | 'BACHELOR_PARTY'
  | 'BRIDAL_SHOWER'
  | 'WELCOME_DINNER'
  | 'AFTER_PARTY'
  | 'RELIGIOUS_CEREMONY'
  | 'BABY_SHOWER'
  | 'BIRTHDAY'
  | 'CORPORATE_EVENT'
  | 'OTHER';

export type ProjectStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'NEEDS_CLARIFICATION'
  | 'MATCHING_PROVIDERS'
  | 'QUOTE_PREPARED'
  | 'QUOTE_SENT'
  | 'CUSTOMER_NEGOTIATING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'QUOTE_REJECTED'
  | 'CANCELLED';

export type LeadSource = 'plan_wizard' | 'enquiry' | 'concierge' | 'assistant' | 'phone' | 'referral';

// ── Provider CRM leads (direct marketplace enquiries) ──────────────────

export type LeadStatus = 'new' | 'contacted' | 'responded' | 'quoted' | 'negotiating' | 'meeting' | 'won' | 'lost' | 'archived';

export interface Lead {
  id: string;
  listingKind: 'venue' | 'vendor';
  listingId: string;
  listingName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  city: string;
  eventDate: string;
  guests?: number;
  functions: string[];
  services?: string[];
  message?: string;
  budget?: number;
  status: LeadStatus;
  source?: 'marketplace' | 'platform' | 'referral' | 'walk_in';
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
  followUp?: string;
  assignedTo?: string;
  notes?: { id: string; text: string; at: string; by: string }[];
  history?: { status: LeadStatus; at: string }[];
  createdAt: string;
}

// ── Quotations (versioned) ─────────────────────────────────────────────

export type PricingModel = 'COMMISSION' | 'MARKUP' | 'LEAD_FEE' | 'FREELANCER_MARGIN';
export type MilestoneRule = 'on_confirmation' | 'days_before_event' | 'on_event_day' | 'after_completion' | 'fixed_date';

export interface QuoteItem {
  id: string;
  title: string;
  description?: string;
  qty: number;
  rate: number;
  unit?: string;
  serviceId?: string;
  requirementId?: string;
  providerId?: string;
  providerName?: string;
  eventId?: string;
  /** Internal: provider cost per unit (never shown to customers). */
  cost?: number;
  pricingModel?: PricingModel;
  /** Commission %, markup % or lead fee depending on the model. */
  modelRate?: number;
}

export interface ScheduleStep {
  label: string;
  percent: number;
  rule: MilestoneRule;
  days?: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'revision' | 'accepted' | 'declined' | 'expired' | 'superseded';

/** Frozen copy of a version that was sent — quotations are never overwritten. */
export interface QuoteVersion {
  version: number;
  items: QuoteItem[];
  discount: number;
  serviceFee: number;
  taxRate: number;
  notes: string;
  terms: string;
  validUntil: string;
  schedule: ScheduleStep[];
  total: number;
  sentAt: string;
  changeSummary?: string;
  response?: { action: 'accept' | 'decline' | 'revision'; note?: string; at: string };
}

export interface Quotation {
  id: string;
  number: string;
  fromKind: 'vendor' | 'platform';
  /** Vendor account id, or "platform". */
  fromId: string;
  fromName: string;
  listingId?: string;
  category: string;
  leadId?: string;
  projectId?: string;
  customerId: string;
  customerName: string;
  eventDate: string;
  city: string;
  title?: string;
  /** Current working version (== versions.length + 1 while drafting a change). */
  version: number;
  items: QuoteItem[];
  discount: number;
  /** Platform coordination fee (added before VAT). */
  serviceFee: number;
  taxRate: number;
  notes: string;
  terms: string;
  validUntil: string;
  schedule: ScheduleStep[];
  status: QuoteStatus;
  revisionNote?: string;
  versions: QuoteVersion[];
  acceptedVersion?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Project ────────────────────────────────────────────────────────────

export interface StatusChange {
  status: ProjectStatus;
  at: string;
  by: string;
  note?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  phone?: string;
  relation: string;
  permission: 'owner' | 'editor' | 'viewer';
  inviteCode: string;
  accountId?: string;
  joinedAt?: string;
}

export type RunStatus = 'pending' | 'in_progress' | 'done' | 'delayed';

export interface RunItem {
  id: string;
  time: string;
  title: string;
  owner: string;
  status: RunStatus;
  note?: string;
}

export type EventStatus = 'planned' | 'live' | 'done' | 'cancelled';

export interface ProjectEvent {
  id: string;
  type: EventType;
  name: string;
  /** yyyy-mm-dd, null while the date is not confirmed. */
  date: string | null;
  dateConfirmed: boolean;
  startTime: string;
  endTime?: string;
  venue: string;
  venueProviderId?: string;
  city: string;
  guests: number;
  budget?: number;
  status: EventStatus;
  private: boolean;
  notes?: string;
  runSheet: RunItem[];
}
/** @deprecated kept for older screens — use ProjectEvent. */
export type WeddingEvent = ProjectEvent;

export type RequirementStatus = 'OPEN' | 'MATCHING' | 'SHORTLISTED' | 'QUOTED' | 'CONFIRMED' | 'CANCELLED';

export interface ScoreBreakdown {
  availability: number;
  location: number;
  budget: number;
  experience: number;
  rating: number;
  completion: number;
  response: number;
  quality: number;
  priority: number;
  repeat: number;
}

export interface MatchCandidate {
  providerId: string;
  providerName: string;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  status: 'suggested' | 'shortlisted' | 'contacted' | 'available' | 'unavailable' | 'declined' | 'selected';
  quotedPrice?: number;
  note?: string;
  at: string;
}

export interface Requirement {
  id: string;
  serviceId: string;
  eventIds: string[];
  details: Record<string, string | number | boolean>;
  styles: string[];
  /** Budget in the service's unit (e.g. per plate for catering). */
  budgetMin?: number;
  budgetMax?: number;
  status: RequirementStatus;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  candidates: MatchCandidate[];
}

export type BookingStatus = 'PROPOSED' | 'HELD' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CrewRequirement {
  id: string;
  role: string;
  count: number;
  eventId?: string;
  pay: number;
  equipment: string[];
  /** in_house = provider's own team; marketplace = staffed through gigs (tracked for risk). */
  staffing: 'in_house' | 'marketplace';
}

export type AssignmentStatus =
  | 'INVITED'
  | 'ASSIGNED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'EMERGENCY_REPLACEMENT';

export interface Assignment {
  id: string;
  crewId?: string;
  workerKind: 'freelancer' | 'staff';
  workerId: string;
  workerName: string;
  role: string;
  eventId?: string;
  date: string;
  startTime: string;
  endTime: string;
  /** What the worker receives. */
  pay: number;
  /** Platform margin on top of the worker pay (model D). */
  margin: number;
  status: AssignmentStatus;
  gigId?: string;
  replacesId?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  checkInNote?: string;
  checkInCoords?: { lat: number; lng: number };
  proofNote?: string;
  proofUri?: string;
  lateMinutes?: number;
  confirmedByProvider?: boolean;
}

export type DeliverableStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'DELIVERED';

export interface Deliverable {
  id: string;
  title: string;
  kind: 'photos' | 'film' | 'highlight' | 'teaser' | 'album' | 'raw' | 'design' | 'other';
  quantity?: number;
  unit?: string;
  due: string;
  status: DeliverableStatus;
  progress: number;
  link?: string;
  revisions: number;
  revisionLimit: number;
  history: { status: DeliverableStatus; at: string; by: string; note?: string }[];
}

export interface ServiceBooking {
  id: string;
  requirementId?: string;
  serviceId: string;
  providerId: string;
  providerName: string;
  /** Vendor account that manages the provider listing, when claimed. */
  providerAccountId?: string;
  eventIds: string[];
  packageName?: string;
  /** Customer price for this service. */
  agreedPrice: number;
  /** What the provider charges (before platform fee / markup). */
  providerCost: number;
  platformFee: number;
  providerPayable: number;
  pricingModel: PricingModel;
  modelRate: number;
  status: BookingStatus;
  heldUntil?: string;
  confirmedAt?: string;
  cancelReason?: string;
  providerResponse?: 'pending' | 'accepted' | 'declined';
  crew: CrewRequirement[];
  assignments: Assignment[];
  deliverables: Deliverable[];
  quoteId?: string;
  contractId?: string;
  createdAt: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
export type TaskAssignee = 'customer' | 'partner' | 'family' | 'coordinator' | 'provider' | 'freelancer';

export interface ProjectTask {
  id: string;
  title: string;
  notes?: string;
  assigneeKind: TaskAssignee;
  assigneeId?: string;
  assigneeName: string;
  due: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  eventId?: string;
  bookingId?: string;
  visibility: 'shared' | 'internal';
  remind?: boolean;
  attachments?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  kind: 'milestone' | 'booking' | 'payment' | 'meeting' | 'event' | 'delivery' | 'task';
  done: boolean;
  internal?: boolean;
  refId?: string;
  time?: string;
  location?: string;
}

export type MilestoneStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';

export interface PaymentMilestone {
  id: string;
  label: string;
  percent?: number;
  amount: number;
  due: string;
  rule: MilestoneRule;
  status: MilestoneStatus;
  paidAmount: number;
  quoteId?: string;
}

export interface Incident {
  id: string;
  eventId: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  reportedBy: string;
  at: string;
}

export interface Project {
  id: string;
  code: string;
  title: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  partnerName?: string;
  eventType: EventType;
  city: string;
  area?: string;
  venueSelected?: string;
  /** Main event date — kept in sync with the events list. */
  weddingDate: string;
  guests: number;
  budget: number;
  budgetMode: 'overall' | 'per_service' | 'undecided';
  status: ProjectStatus;
  statusHistory: StatusChange[];
  source: LeadSource;
  managedBy: 'platform' | 'self';
  coordinatorId?: string;
  coordinatorName?: string;
  geniePackageId?: string;
  styles: Record<string, string[]>;
  priorities: string[];
  notes?: string;
  inspiration: PhotoKey[];
  events: ProjectEvent[];
  requirements: Requirement[];
  bookings: ServiceBooking[];
  tasks: ProjectTask[];
  timeline: TimelineEntry[];
  milestones: PaymentMilestone[];
  incidents: Incident[];
  collaborators: Collaborator[];
  driveFolder?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Money (customer payments never share records with payouts) ─────────

export type PaymentMethod = 'esewa' | 'khalti' | 'fonepay' | 'connect_ips' | 'ime_pay' | 'bank_transfer' | 'card' | 'cash';

export interface Payment {
  id: string;
  projectId: string;
  milestoneId?: string;
  registryItemId?: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  receiptNo: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  refunded: number;
  payerName: string;
  at: string;
}

export type PayableStatus = 'ACCRUED' | 'ON_HOLD' | 'READY' | 'PAID' | 'CANCELLED';

export interface Payable {
  id: string;
  payeeKind: 'provider' | 'freelancer';
  payeeId: string;
  payeeName: string;
  projectId?: string;
  bookingId?: string;
  assignmentId?: string;
  gigId?: string;
  label: string;
  amount: number;
  status: PayableStatus;
  release: 'on_confirmation' | 'before_event' | 'after_event' | 'on_delivery';
  due: string;
  paidAt?: string;
  reference?: string;
  holdReason?: string;
}

export type RevenueKind = 'COMMISSION' | 'MARKUP' | 'LEAD_FEE' | 'FREELANCER_MARGIN' | 'SERVICE_FEE' | 'SUBSCRIPTION' | 'FEATURED' | 'EMERGENCY_FEE';

export interface RevenueEntry {
  id: string;
  kind: RevenueKind;
  amount: number;
  projectId?: string;
  bookingId?: string;
  providerId?: string;
  note?: string;
  at: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  projectId: string;
  amount: number;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  requestedBy: string;
  at: string;
  processedAt?: string;
}

export interface Dispute {
  id: string;
  projectId: string;
  bookingId?: string;
  assignmentId?: string;
  raisedById: string;
  raisedByName: string;
  raisedByRole: UserRole;
  against: string;
  reason: string;
  amount?: number;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  resolution?: string;
  paymentFrozen: boolean;
  at: string;
  log: { at: string; by: string; text: string }[];
}

// ── Availability ───────────────────────────────────────────────────────

export type AvailabilityStatus = 'AVAILABLE' | 'TENTATIVE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE';
export type DayPart = 'full' | 'morning' | 'afternoon' | 'evening';

export interface AvailabilityEntry {
  id: string;
  ownerKind: 'provider' | 'freelancer';
  ownerId: string;
  date: string;
  part: DayPart;
  status: AvailabilityStatus;
  source: 'manual' | 'booking' | 'assignment' | 'hold' | 'recurring';
  refId?: string;
  note?: string;
}

export interface AvailabilityRule {
  id: string;
  ownerId: string;
  weekday: number;
  status: AvailabilityStatus;
  part: DayPart;
}

// ── Freelancers & gigs ─────────────────────────────────────────────────

export interface FreelancerProfile {
  id: string;
  name: string;
  city: string;
  skills: string[];
  headline: string;
  bio: string;
  experienceYears: number;
  dayRate: number;
  hourlyRate: number;
  eventRate: number;
  travelRadiusKm: number;
  languages: string[];
  equipment: Equipment[];
  ownVehicle: boolean;
  rating: number;
  ratingCount: number;
  completedGigs: number;
  cancellationRate: number;
  responseRate: number;
  lateArrivals: number;
  noShows: number;
  reliability: number;
  verification: VerificationStatus;
  available: boolean;
  portfolio: PhotoKey[];
}

export type GigStatus = 'open' | 'filled' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus =
  | 'invited'
  | 'applied'
  | 'shortlisted'
  | 'hired'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'declined'
  | 'rejected'
  | 'withdrawn'
  | 'no_show'
  | 'cancelled';

export interface GigApplication {
  id: string;
  freelancerId: string;
  freelancerName: string;
  skill: string;
  rating: number;
  message: string;
  expectedPay: number;
  status: ApplicationStatus;
  appliedAt: string;
  checkInAt?: string;
  checkOutAt?: string;
  /** Assignment created when hired against a booking crew slot. */
  assignmentId?: string;
}

export interface GigQuestion {
  id: string;
  freelancerId: string;
  freelancerName: string;
  question: string;
  answer?: string;
  at: string;
}

export interface Gig {
  id: string;
  title: string;
  skill: string;
  postedById: string;
  postedByName: string;
  postedByKind: 'vendor' | 'platform';
  projectId?: string;
  eventId?: string;
  bookingId?: string;
  crewId?: string;
  city: string;
  location?: string;
  date: string;
  startTime: string;
  hours: number;
  pay: number;
  description: string;
  requirements: string[];
  equipment?: string[];
  slots: number;
  status: GigStatus;
  emergency?: boolean;
  /** Emergency gigs: the assignment being replaced. */
  replacesAssignmentId?: string;
  deadline?: string;
  invited?: string[];
  questions?: GigQuestion[];
  applications: GigApplication[];
  createdAt: string;
}

// ── Communication, files, audit ────────────────────────────────────────

export interface ThreadMember {
  id: string;
  name: string;
  role: UserRole;
}

export interface Thread {
  id: string;
  kind: 'project' | 'service' | 'direct' | 'gig' | 'support';
  projectId?: string;
  bookingId?: string;
  gigId?: string;
  listingId?: string;
  title: string;
  image?: PhotoKey;
  members: ThreadMember[];
  lastAt: string;
  archivedBy: string[];
  mutedBy: string[];
  blockedBy: string[];
  typing?: { id: string; name: string; at: string };
}

export type MessageKind = 'text' | 'image' | 'file' | 'quote' | 'package' | 'location' | 'meeting' | 'system' | 'voice';

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  kind: MessageKind;
  text: string;
  meta?: {
    quoteId?: string;
    image?: PhotoKey;
    uri?: string;
    fileName?: string;
    location?: { label: string; lat?: number; lng?: number };
    meeting?: { at: string; title: string };
    packageName?: string;
    price?: number;
    durationSec?: number;
  };
  at: string;
  readBy: string[];
}

export interface InternalNote {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  text: string;
  pinned: boolean;
  at: string;
}

export interface FileRef {
  id: string;
  projectId: string;
  folder: string;
  name: string;
  kind: 'pdf' | 'image' | 'video' | 'doc' | 'link';
  size?: number;
  uri?: string;
  storage: 'device' | 'cloudinary' | 'drive' | 'link';
  visibility: 'customer' | 'provider' | 'internal';
  uploadedBy: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  detail?: string;
}

export interface AppNotification {
  id: string;
  /** Account id, or a role for broadcast notifications. */
  to: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  kind?: 'lead' | 'quote' | 'booking' | 'payment' | 'gig' | 'message' | 'task' | 'event' | 'review' | 'system' | 'emergency';
}

// ── Reviews & verification ─────────────────────────────────────────────

export interface ReviewRecord {
  id: string;
  targetKind: 'provider' | 'freelancer' | 'platform';
  targetId: string;
  targetName: string;
  projectId?: string;
  bookingId?: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  overall: number;
  criteria: Record<string, number>;
  text: string;
  photos: PhotoKey[];
  /** Photos the reviewer uploaded (Cloudinary URLs in production). */
  photoUris?: string[];
  verifiedBooking: boolean;
  status: 'published' | 'pending' | 'flagged' | 'removed';
  flagReason?: string;
  reply?: { text: string; at: string };
  helpful: string[];
  at: string;
}

export type CheckState = 'pending' | 'passed' | 'failed';

export interface VerificationCase {
  id: string;
  subjectKind: 'provider' | 'freelancer';
  subjectId: string;
  title: string;
  subtitle: string;
  status: VerificationStatus;
  checks: Record<'business' | 'identity' | 'phone' | 'bank' | 'portfolio', CheckState>;
  documents: { kind: string; name: string; status: CheckState }[];
  notes?: string;
  submittedAt: string;
  decidedAt?: string;
  expiresAt?: string;
}

// ── Couple planning tools ──────────────────────────────────────────────

export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe';

export interface GuestInvite {
  eventId: string;
  rsvp: RsvpStatus;
  attending: number;
  meal?: string;
  sentAt?: string;
  openedAt?: string;
  respondedAt?: string;
  checkedInAt?: string;
  tableId?: string;
}

export interface Guest {
  id: string;
  projectId: string;
  name: string;
  side: 'bride' | 'groom' | 'both';
  household?: string;
  category: string;
  vip: boolean;
  phone?: string;
  email?: string;
  address?: string;
  plusOnes: number;
  children: number;
  dietary: string[];
  accommodation: boolean;
  transport: boolean;
  gift?: string;
  thanked?: boolean;
  notes?: string;
  code: string;
  answers?: Record<string, string>;
  invites: GuestInvite[];
}

export interface SeatingElement {
  id: string;
  kind: 'round' | 'rect' | 'square' | 'stage' | 'dance' | 'dj' | 'buffet' | 'entrance' | 'bar';
  label: string;
  capacity: number;
  x: number;
  y: number;
  vip?: boolean;
}

export interface SeatingLayout {
  eventId: string;
  projectId: string;
  elements: SeatingElement[];
}

export interface BudgetLine {
  id: string;
  projectId: string;
  serviceId: string;
  eventId?: string;
  label: string;
  estimated: number;
  actual?: number;
  paid: number;
  due?: string;
  bookingId?: string;
  notes?: string;
}

export interface WeddingWebsite {
  projectId: string;
  slug: string;
  template: 'classic' | 'himalayan' | 'floral' | 'minimal';
  accent: string;
  font: 'serif' | 'sans';
  headline: string;
  story: string;
  cover: PhotoKey;
  gallery: PhotoKey[];
  sections: { schedule: boolean; travel: boolean; faq: boolean; registry: boolean; rsvp: boolean; gallery: boolean; dressCode: boolean; story: boolean };
  travel: string;
  dressCode: string;
  faqs: { q: string; a: string }[];
  rsvpDeadline?: string;
  rsvpQuestions: { id: string; q: string; kind: 'text' | 'choice' | 'song'; options?: string[] }[];
  password?: string;
  published: boolean;
  searchable: boolean;
  customDomain?: string;
  views: number;
  updatedAt: string;
}

export interface RegistryItem {
  id: string;
  projectId: string;
  kind: 'gift' | 'cash' | 'honeymoon' | 'experience' | 'charity' | 'external';
  title: string;
  note?: string;
  price?: number;
  target?: number;
  quantity?: number;
  link?: string;
  image?: PhotoKey;
  contributions: { id: string; name: string; amount: number; message?: string; at: string; thanked: boolean }[];
}

export interface InspirationBoard {
  id: string;
  projectId: string;
  name: string;
  items: string[];
  notes?: Record<string, string>;
}

export interface Contract {
  id: string;
  projectId: string;
  bookingId?: string;
  quoteId?: string;
  number: string;
  title: string;
  version: number;
  parties: { customer: string; provider: string; platform: string };
  sections: { heading: string; body: string }[];
  status: 'draft' | 'sent' | 'partially_signed' | 'signed' | 'void';
  signatures: { party: 'customer' | 'provider' | 'platform'; name: string; at: string; path?: string }[];
  createdAt: string;
}

export interface ShortlistEntry {
  providerId: string;
  status: 'saved' | 'contacted' | 'quote_received' | 'negotiating' | 'booked' | 'rejected';
  notes?: string;
  tags: string[];
  addedAt: string;
}

export interface Deal {
  id: string;
  providerId?: string;
  providerName?: string;
  serviceId?: string;
  title: string;
  description: string;
  kind: 'seasonal' | 'last_minute' | 'early_booking' | 'bundle' | 'referral' | 'promo_code';
  discountPct?: number;
  discountAmount?: number;
  code?: string;
  endsAt?: string;
  featured: boolean;
  active: boolean;
  redemptions: number;
}

export interface ProviderPackage {
  id: string;
  providerId: string;
  serviceId: string;
  title: string;
  price: number;
  unit: string;
  description: string;
  included: string[];
  excluded: string[];
  crew: Record<string, number>;
  hours?: number;
  deliverables: { title: string; qty?: number }[];
  deliveryDays?: number;
  addOns: { title: string; price: number }[];
  discountPct?: number;
  limitedSlots?: number;
  active: boolean;
}

export interface PortfolioItem {
  id: string;
  providerId: string;
  image?: PhotoKey;
  uri?: string;
  kind: 'image' | 'video';
  caption: string;
  tags: string[];
  eventType?: EventType;
  venue?: string;
  featured: boolean;
  order: number;
}

export interface StaffMember {
  id: string;
  orgAccountId: string;
  name: string;
  phone: string;
  role: string;
  permissions: ('leads' | 'quotes' | 'bookings' | 'finance' | 'calendar')[];
  active: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  issuerId: string;
  issuerName: string;
  projectId?: string;
  customerName: string;
  kind: 'deposit' | 'instalment' | 'balance' | 'tax';
  amount: number;
  vat: number;
  status: 'draft' | 'issued' | 'paid' | 'void';
  issuedAt: string;
  dueAt: string;
}

export interface PlatformSettings {
  commissionRate: number;
  markupRate: number;
  leadFee: number;
  freelancerMargin: number;
  serviceFeeRate: number;
  emergencyFee: number;
  autoAssignCoordinator: boolean;
  cities: string[];
  featuredProviderIds: string[];
  banners: { id: string; title: string; subtitle: string; href: string; active: boolean }[];
}
