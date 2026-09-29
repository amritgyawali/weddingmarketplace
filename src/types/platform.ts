/**
 * Shared domain model for the multi-role system. Every role reads and writes
 * the same entities, which is what connects the customer, vendor, freelancer
 * and platform apps into one workflow.
 */

export type UserRole = 'customer' | 'vendor' | 'freelancer' | 'platform';

export interface Account {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email?: string;
  city: string;
  createdAt: string;
  verified: boolean;
  /** vendor */
  businessName?: string;
  categoryId?: string;
  listingKind?: 'venue' | 'vendor';
  listingId?: string;
  /** freelancer */
  skills?: string[];
  dayRate?: number;
  bio?: string;
  available?: boolean;
  rating?: number;
  /** platform */
  team?: PlatformTeam;
}

export type PlatformTeam = 'Genie Planning' | 'Wedding Operations' | 'Vendor Success' | 'Admin';

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';

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
  message?: string;
  budget?: number;
  status: LeadStatus;
  createdAt: string;
}

export interface QuoteItem {
  id: string;
  title: string;
  description?: string;
  qty: number;
  rate: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'revision' | 'accepted' | 'declined';

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
  items: QuoteItem[];
  discount: number;
  taxRate: number;
  notes: string;
  terms: string;
  validUntil: string;
  status: QuoteStatus;
  revisionNote?: string;
  createdAt: string;
  updatedAt: string;
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

export type EventStatus = 'planned' | 'live' | 'done';

export interface WeddingEvent {
  id: string;
  name: string;
  date: string;
  startTime: string;
  venue: string;
  guests: number;
  status: EventStatus;
  runSheet: RunItem[];
}

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface ProjectTask {
  id: string;
  title: string;
  assignee: string;
  assigneeRole: 'customer' | 'vendor' | 'platform' | 'freelancer';
  due: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
}

export interface ProjectVendor {
  id: string;
  listingId?: string;
  vendorAccountId?: string;
  name: string;
  category: string;
  amount: number;
  status: 'shortlisted' | 'quoted' | 'booked';
  quoteId?: string;
}

export type MilestoneStatus = 'upcoming' | 'due' | 'paid';

export interface PaymentMilestone {
  id: string;
  title: string;
  payee: string;
  amount: number;
  due: string;
  status: MilestoneStatus;
  paidAt?: string;
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

export type ProjectStage = 'planning' | 'booked' | 'execution' | 'completed';

export interface Project {
  id: string;
  code: string;
  title: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  city: string;
  weddingDate: string;
  guests: number;
  budget: number;
  managedBy: 'platform' | 'self';
  plannerName?: string;
  geniePackageId?: string;
  stage: ProjectStage;
  vendors: ProjectVendor[];
  events: WeddingEvent[];
  tasks: ProjectTask[];
  payments: PaymentMilestone[];
  incidents: Incident[];
  createdAt: string;
}

export type GigStatus = 'open' | 'filled' | 'completed' | 'cancelled';
export type ApplicationStatus = 'applied' | 'shortlisted' | 'hired' | 'rejected' | 'completed';

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
  city: string;
  date: string;
  startTime: string;
  hours: number;
  pay: number;
  description: string;
  requirements: string[];
  slots: number;
  status: GigStatus;
  applications: GigApplication[];
  createdAt: string;
}

export interface Payout {
  id: string;
  freelancerId: string;
  gigId: string;
  title: string;
  amount: number;
  status: 'pending' | 'paid';
  date: string;
}

export interface Approval {
  id: string;
  kind: 'vendor' | 'freelancer' | 'review';
  subjectId: string;
  title: string;
  subtitle: string;
  details: string[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
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
}
