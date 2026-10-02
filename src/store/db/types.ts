import type { TextOverrides } from '@/i18n/runtime';
import type {
  Announcement,
  AppNotification,
  AuditEntry,
  AvailabilityEntry,
  AvailabilityRule,
  Broadcast,
  BudgetLine,
  Contract,
  Deal,
  Dispute,
  FileRef,
  Gig,
  Guest,
  InspirationBoard,
  InternalNote,
  Invoice,
  Lead,
  Message,
  OccasionDef,
  Payable,
  Payment,
  PlatformSettings,
  PortfolioItem,
  ProviderPackage,
  Project,
  Quotation,
  Refund,
  RegistryItem,
  RevenueEntry,
  ReviewRecord,
  SeatingLayout,
  ShortlistEntry,
  SocialAccount,
  SocialMessage,
  SocialPost,
  SocialSettings,
  SocialThread,
  StaffMember,
  Thread,
  ToolEntry,
  ToolState,
  VerificationCase,
  WeddingWebsite,
} from '@/types/platform';

/** Everything the shared on-device "backend" persists. Mirrors the SQL schema. */
export interface DbData {
  projects: Project[];
  quotes: Quotation[];
  leads: Lead[];
  gigs: Gig[];
  // money
  payments: Payment[];
  payables: Payable[];
  revenue: RevenueEntry[];
  refunds: Refund[];
  disputes: Dispute[];
  invoices: Invoice[];
  // calendars
  availability: AvailabilityEntry[];
  availabilityRules: AvailabilityRule[];
  // communication
  threads: Thread[];
  messages: Message[];
  notes: InternalNote[];
  files: FileRef[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  // trust
  reviews: ReviewRecord[];
  verifications: VerificationCase[];
  // couple planning tools
  guests: Guest[];
  seating: SeatingLayout[];
  budget: BudgetLine[];
  websites: WeddingWebsite[];
  registry: RegistryItem[];
  boards: InspirationBoard[];
  contracts: Contract[];
  shortlists: Record<string, ShortlistEntry[]>;
  // business
  deals: Deal[];
  staff: StaffMember[];
  packages: ProviderPackage[];
  portfolio: PortfolioItem[];
  settings: PlatformSettings;
  // role toolkits
  toolEntries: ToolEntry[];
  /** Keyed `${ownerId}:${tool}`. */
  toolState: Record<string, ToolState>;
  broadcasts: Broadcast[];
  // personas
  /** Occasions customers can plan; seeded from the built-ins, editable by a super admin. */
  occasions: OccasionDef[];
  // super admin
  /** Feature switches by id (`data/features.ts`); a missing id is on. */
  featureFlags: Record<string, boolean>;
  /** Replacement text for any English source string, per language. */
  textOverrides: TextOverrides;
  /** Notices shown at the top of a role's home. */
  announcements: Announcement[];
  // social hub (business app)
  /** Facebook pages, Instagram profiles, WhatsApp numbers and TikTok accounts a business connected. */
  socialAccounts: SocialAccount[];
  /** The unified inbox: direct messages and comments from every connected network. */
  socialThreads: SocialThread[];
  socialMessages: SocialMessage[];
  /** Posts sent (or scheduled) to several networks at once. */
  socialPosts: SocialPost[];
  /** Saved replies, auto-replies and away message, keyed by the business account id. */
  socialSettings: Record<string, SocialSettings>;
}
