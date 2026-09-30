/**
 * Matching engine. Scores providers for a requirement and freelancers for a
 * crew slot / gig. Weights mirror supabase/migrations/0003 so on-device and
 * database recommendations agree. The engine only recommends — a coordinator
 * always confirms the award.
 */
import { cityDistanceKm, sameServiceArea } from '@/data/cities';
import { FREELANCER_DIRECTORY } from '@/data/freelancers';
import { PROVIDERS, type Provider } from '@/data/providers';
import { findService } from '@/data/services';
import type {
  AvailabilityEntry,
  AvailabilityRule,
  AvailabilityStatus,
  FreelancerProfile,
  MatchCandidate,
  Project,
  Requirement,
  ScoreBreakdown,
} from '@/types/platform';
import { formatMoneyCompact, formatShortDate } from '@/utils/format';
import { hashString } from '@/utils/random';

export const MATCH_WEIGHTS: ScoreBreakdown = {
  availability: 30,
  location: 15,
  budget: 15,
  experience: 10,
  rating: 10,
  completion: 5,
  response: 5,
  quality: 5,
  priority: 3,
  repeat: 2,
};

export const MATCH_FACTORS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'availability', label: 'Availability' },
  { key: 'location', label: 'Location' },
  { key: 'budget', label: 'Budget fit' },
  { key: 'experience', label: 'Category experience' },
  { key: 'rating', label: 'Rating' },
  { key: 'completion', label: 'Completion rate' },
  { key: 'response', label: 'Response speed' },
  { key: 'quality', label: 'Previous work quality' },
  { key: 'priority', label: 'Platform priority' },
  { key: 'repeat', label: 'Repeat provider' },
];

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

// Availability
/**
 * Demo calendars: static catalogue providers/freelancers are "busy" on a
 * deterministic ~12% of dates (peak-season Saturdays more often) so the
 * engine visibly excludes some candidates. Real calendars override this.
 */
export function syntheticStatus(ownerId: string, date: string): AvailabilityStatus {
  const d = new Date(`${date}T00:00:00`);
  const saturday = d.getDay() === 6;
  const x = (hashString(`${ownerId}|${date}`) % 1000) / 1000;
  if (x < (saturday ? 0.22 : 0.09)) return 'BOOKED';
  if (x < (saturday ? 0.3 : 0.13)) return 'TENTATIVE';
  return 'AVAILABLE';
}

const STATUS_RANK: Record<AvailabilityStatus, number> = { AVAILABLE: 0, TENTATIVE: 1, HELD: 2, BOOKED: 3, UNAVAILABLE: 4 };

/** Effective status for an owner on a date: explicit entries beat the synthetic calendar. */
export function statusOn(ownerId: string, date: string, entries: AvailabilityEntry[], synthetic = true, rules: AvailabilityRule[] = []): AvailabilityStatus {
  const own = entries.filter((e) => e.ownerId === ownerId && e.date === date);
  if (own.length) return own.reduce<AvailabilityStatus>((worst, e) => (STATUS_RANK[e.status] > STATUS_RANK[worst] ? e.status : worst), 'AVAILABLE');
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const rule = rules.find((r) => r.ownerId === ownerId && r.weekday === weekday && r.part === 'full');
  if (rule) return rule.status;
  // Owners that manage a real calendar on this device are not simulated.
  const managed = entries.some((e) => e.ownerId === ownerId) || rules.some((r) => r.ownerId === ownerId);
  return synthetic && !managed ? syntheticStatus(ownerId, date) : 'AVAILABLE';
}

export const isBlocking = (s: AvailabilityStatus) => s === 'BOOKED' || s === 'UNAVAILABLE';

/** Dates a requirement covers (dated events only). */
export function requirementDates(project: Project, requirement: Pick<Requirement, 'eventIds'>): string[] {
  const events = project.events.filter((e) => requirement.eventIds.includes(e.id) && e.date);
  const dates = events.map((e) => e.date!);
  return [...new Set(dates.length ? dates : [project.weddingDate])];
}

// Providers
export interface RankedProvider {
  provider: Provider;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  warnings: string[];
  /** Set when the provider cannot take the job (not just ranked low). */
  excluded?: string;
  estimate: number;
}

export interface MatchContext {
  availability: AvailabilityEntry[];
  rules?: AvailabilityRule[];
  /** Provider ids this customer booked and completed before. */
  repeatProviderIds?: string[];
  /** Providers already booked on this requirement (skip them). */
  skipProviderIds?: string[];
  includeUnverified?: boolean;
}

/** Rough price of one booking of this provider for the requirement, in NPR. */
export function estimateFor(provider: Provider, requirement: Requirement, project: Project): number {
  const def = findService(provider.serviceId);
  const guests = project.events.filter((e) => requirement.eventIds.includes(e.id)).reduce((m, e) => Math.max(m, e.guests), 0) || project.guests;
  const events = Math.max(1, requirement.eventIds.length);
  switch (def?.unit) {
    case 'per plate':
    case 'per person':
      return provider.startingPrice * guests;
    case 'per card':
      return provider.startingPrice * Number(requirement.details.cards ?? guests);
    case 'per car':
      return provider.startingPrice * Math.max(1, Number(requirement.details.cars ?? 1) + Number(requirement.details.buses ?? 0));
    case 'per event':
    case 'per day':
      return provider.startingPrice * events;
    default:
      return provider.startingPrice;
  }
}

/** Budget comparison happens in the service's own unit (e.g. per plate for catering). */
function budgetScore(price: number, min?: number, max?: number): number {
  if (!max) return 0.6;
  if (price >= (min ?? 0) && price <= max) return 1;
  if (price < (min ?? 0)) return 0.8;
  return clamp(1 - ((price - max) / max) * 1.5);
}

export function scoreProvider(provider: Provider, project: Project, requirement: Requirement, ctx: MatchContext): RankedProvider {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let excluded: string | undefined;

  // Availability (30)
  const dates = requirementDates(project, requirement);
  const statuses = dates.map((d) => ({ d, s: statusOn(provider.id, d, ctx.availability, true, ctx.rules) }));
  const blocked = statuses.filter((x) => isBlocking(x.s));
  const soft = statuses.filter((x) => x.s === 'TENTATIVE' || x.s === 'HELD');
  if (blocked.length) excluded = `Booked on ${blocked.map((b) => formatShortDate(b.d)).join(', ')}`;
  const availability = dates.length ? clamp(1 - (soft.length * 0.5) / dates.length) : 0.8;
  if (!blocked.length && !soft.length) reasons.push(dates.length > 1 ? `Free on all ${dates.length} dates` : 'Free on your date');
  soft.forEach((x) => warnings.push(`${x.s === 'HELD' ? 'Held' : 'Tentative'} on ${formatShortDate(x.d)}`));

  // Location (15)
  let location: number;
  const km = cityDistanceKm(provider.city, project.city);
  if (provider.city === project.city) {
    location = 1;
    reasons.push(`Based in ${provider.city}`);
  } else if (sameServiceArea(provider.city, project.city) || provider.serviceAreas.includes(project.city)) {
    location = 0.85;
    reasons.push(`Serves ${project.city}`);
  } else if (provider.travels && km !== null && km <= 250) {
    location = clamp(0.7 - km / 1000);
    warnings.push(`Travels ${km} km — travel costs may apply`);
  } else if (provider.kind === 'venue') {
    location = 0;
    excluded ??= `Venue is in ${provider.city}`;
  } else {
    location = 0.1;
    warnings.push(`Based in ${provider.city}`);
  }

  // Budget (15)
  const unitPrice = provider.startingPrice;
  const budget = budgetScore(unitPrice, requirement.budgetMin, requirement.budgetMax);
  if (requirement.budgetMax) {
    if (budget === 1) reasons.push(`Within budget (from ${formatMoneyCompact(unitPrice)})`);
    else if (unitPrice > requirement.budgetMax) warnings.push(`${Math.round(((unitPrice - requirement.budgetMax) / requirement.budgetMax) * 100)}% above budget`);
  }

  // Category experience (10): volume + style overlap
  const volume = clamp(Math.log10(1 + provider.completedProjects) / Math.log10(301));
  const wanted = requirement.styles.map((s) => s.toLowerCase());
  const overlap = wanted.length ? provider.styles.filter((s) => wanted.includes(s.toLowerCase())).length / wanted.length : 0.5;
  const experience = clamp(volume * 0.7 + overlap * 0.3);
  if (overlap >= 0.5 && wanted.length) reasons.push(`Specialises in ${provider.styles.filter((s) => wanted.includes(s.toLowerCase())).join(', ')}`);
  if (provider.completedProjects >= 150) reasons.push(`${provider.completedProjects}+ events done`);

  // Capacity (venues): hard filter
  if (provider.capacity) {
    const guests = project.events.filter((e) => requirement.eventIds.includes(e.id)).reduce((m, e) => Math.max(m, e.guests), 0) || project.guests;
    if (guests > provider.capacity.max) excluded ??= `Holds ${provider.capacity.max} guests (need ${guests})`;
    else if (guests < provider.capacity.min * 0.6) warnings.push(`Large for ${guests} guests`);
    else reasons.push(`Fits ${guests} guests`);
  }

  // Rating (10): Bayesian average so 5★ from 2 reviews doesn't beat 4.8★ from 200.
  const bayes = (provider.rating * provider.reviewCount + 4.2 * 10) / (provider.reviewCount + 10);
  const rating = clamp(bayes / 5);
  if (provider.rating >= 4.6 && provider.reviewCount >= 20) reasons.push(`${provider.rating}★ from ${provider.reviewCount} reviews`);

  const i = provider.internal;
  const completion = clamp(i.completionRate);
  const response = clamp(1 - i.responseMinutes / 720);
  if (i.responseMinutes <= 30) reasons.push(`Replies in ~${i.responseMinutes} min`);
  const quality = clamp(provider.rating / 5 - i.disputes * 0.1);
  const priority = clamp(i.platformPriority * 0.6 + (provider.verification === 'VERIFIED' ? 0.4 : 0));
  const repeat = ctx.repeatProviderIds?.includes(provider.id) ? 1 : 0;
  if (repeat) reasons.push('Worked with this family before');
  if (i.cancellationRate >= 0.15) warnings.push(`Cancellation rate ${Math.round(i.cancellationRate * 100)}%`);
  if (provider.verification !== 'VERIFIED') {
    if (!ctx.includeUnverified) excluded ??= 'Not verified yet';
    else warnings.push('Verification pending');
  }

  const raw: ScoreBreakdown = { availability, location, budget, experience, rating, completion, response, quality, priority, repeat };
  const breakdown = Object.fromEntries(
    (Object.keys(MATCH_WEIGHTS) as (keyof ScoreBreakdown)[]).map((k) => [k, round1(raw[k] * MATCH_WEIGHTS[k])]),
  ) as unknown as ScoreBreakdown;
  const score = round1(Object.values(breakdown).reduce((a, b) => a + b, 0));

  return { provider, score, breakdown, reasons: reasons.slice(0, 4), warnings, excluded, estimate: estimateFor(provider, requirement, project) };
}

export function rankProviders(
  project: Project,
  requirement: Requirement,
  ctx: MatchContext,
  opts: { limit?: number; includeExcluded?: boolean; pool?: Provider[] } = {},
): RankedProvider[] {
  const pool = (opts.pool ?? PROVIDERS).filter((p) => p.serviceId === requirement.serviceId && !ctx.skipProviderIds?.includes(p.id));
  const ranked = pool
    .map((p) => scoreProvider(p, project, requirement, ctx))
    .filter((r) => opts.includeExcluded || !r.excluded)
    .sort((a, b) => (a.excluded ? 1 : 0) - (b.excluded ? 1 : 0) || b.score - a.score);
  return ranked.slice(0, opts.limit ?? 10);
}

export const toCandidate = (r: RankedProvider, status: MatchCandidate['status'] = 'suggested'): MatchCandidate => ({
  providerId: r.provider.id,
  providerName: r.provider.name,
  score: r.score,
  breakdown: r.breakdown,
  reasons: r.reasons,
  status,
  quotedPrice: r.estimate,
  at: new Date().toISOString(),
});

/**
 * Package builder: best provider per requirement inside the budget, e.g.
 * "Kathmandu, 500 guests, NPR 800K, luxury" → Venue A + Photo B + Decor C.
 */
export function buildBestPackage(project: Project, ctx: MatchContext) {
  const picks = project.requirements
    .filter((r) => r.status !== 'CANCELLED')
    .map((req) => ({ req, best: rankProviders(project, req, ctx, { limit: 3 }) }));
  const lines = picks.map(({ req, best }) => ({ requirement: req, choice: best[0], alternatives: best.slice(1) }));
  const total = lines.reduce((sum, l) => sum + (l.choice?.estimate ?? 0), 0);
  return { lines, total, withinBudget: !project.budget || total <= project.budget };
}

// Freelancers
export interface RankedFreelancer {
  freelancer: FreelancerProfile;
  score: number;
  distanceKm: number | null;
  reasons: string[];
  warnings: string[];
  excluded?: string;
}

export interface CrewSlot {
  role: string;
  date: string;
  city: string;
  pay: number;
  equipment: string[];
  emergency?: boolean;
}

export function rankFreelancers(
  slot: CrewSlot,
  ctx: { availability: AvailabilityEntry[]; rules?: AvailabilityRule[]; skipIds?: string[]; pool?: FreelancerProfile[] },
  opts: { limit?: number; includeExcluded?: boolean } = {},
): RankedFreelancer[] {
  const pool = (ctx.pool ?? FREELANCER_DIRECTORY).filter((f) => f.skills.includes(slot.role) && !ctx.skipIds?.includes(f.id));
  return pool
    .map((f): RankedFreelancer => {
      const reasons: string[] = [];
      const warnings: string[] = [];
      let excluded: string | undefined;
      const status = statusOn(f.id, slot.date, ctx.availability, true, ctx.rules);
      if (isBlocking(status)) excluded = status === 'BOOKED' ? 'Already booked that day' : 'Marked unavailable';
      if (!f.available) excluded ??= 'Not taking gigs right now';
      if (f.verification !== 'VERIFIED') excluded ??= 'Verification pending';

      const km = cityDistanceKm(f.city, slot.city);
      const radius = f.travelRadiusKm * (slot.emergency ? 1.5 : 1);
      const distance = km === null ? 0.5 : km <= radius ? 1 - (km / Math.max(1, radius)) * 0.5 : 0;
      if (km !== null && km > radius) excluded ??= `${km} km away (travels ${f.travelRadiusKm} km)`;
      else if (km === 0 || sameServiceArea(f.city, slot.city)) reasons.push(`In ${f.city}`);
      else if (km !== null) reasons.push(`${km} km away`);

      const owned = f.equipment.map((e) => e.name.toLowerCase());
      const needed = slot.equipment.map((e) => e.toLowerCase());
      const hits = needed.filter((n) => owned.some((o) => o.includes(n.split(' ')[0]) || n.includes(o.split(' ')[0]))).length;
      const equipment = needed.length ? hits / needed.length : 1;
      if (needed.length && hits === needed.length) reasons.push('Has required equipment');
      else if (needed.length) warnings.push(`Missing ${needed.length - hits} equipment item(s)`);

      const reliability = f.reliability / 100;
      if (f.reliability >= 85) reasons.push(`Reliability ${f.reliability}`);
      if (f.noShows) warnings.push(`${f.noShows} no-show on record`);
      const rating = f.ratingCount ? f.rating / 5 : 0.6;
      const experience = clamp(f.completedGigs / 40);
      const rate = f.dayRate <= slot.pay ? 1 : slot.pay / f.dayRate;
      if (f.dayRate > slot.pay) warnings.push(`Usual rate ${formatMoneyCompact(f.dayRate)}`);

      const score = round1(
        30 * (excluded ? 0 : status === 'TENTATIVE' ? 0.5 : 1) + 20 * distance + 15 * equipment + (slot.emergency ? 20 : 15) * reliability + 10 * rating + 5 * experience + 5 * rate,
      );
      return { freelancer: f, score, distanceKm: km, reasons: reasons.slice(0, 3), warnings, excluded };
    })
    .filter((r) => opts.includeExcluded || !r.excluded)
    .sort((a, b) => (a.excluded ? 1 : 0) - (b.excluded ? 1 : 0) || b.score - a.score)
    .slice(0, opts.limit ?? 15);
}
