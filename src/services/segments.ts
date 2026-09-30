/**
 * Segments for the operations console (master plan §4.4): every list can be
 * cut by occasion × trade × city, so Vendor Success can open "decorators in
 * Pokhara" and a coordinator "pasni projects this month". Pure functions, no
 * React and no store.
 */
import { type OccasionDef } from '@/data/occasions';
import { SERVICES_BY_CREW_ROLE, tradeOf, type TradeId } from '@/data/trades';
import type { Project } from '@/types/platform';

import { occasionOf } from './experience';

/** A segment; unset keys match everything. */
export interface Segment {
  occasion?: string;
  trade?: TradeId;
  city?: string;
}

/** What a record looks like to a segment. */
export interface SegmentFacts {
  occasion?: string;
  trades: TradeId[];
  city?: string;
}

const tradesOf = (services: string[]) => [...new Set(services.map((s) => tradeOf(s)?.id).filter((t): t is TradeId => !!t))];

/** A project: its occasion, the trades it needs and its city. */
export const projectFacts = (p: Pick<Project, 'occasion' | 'eventType' | 'requirements' | 'city'>, occasions?: OccasionDef[]): SegmentFacts => ({
  occasion: occasionOf(p, occasions).id,
  trades: tradesOf(p.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId)),
  city: p.city,
});

/** A provider listing: its service's trade and city. */
export const providerFacts = (p: { serviceId: string; city: string }): SegmentFacts => ({ trades: tradesOf([p.serviceId]), city: p.city });

/** A freelancer: the trades of their crew roles and city. */
export const freelancerFacts = (f: { skills: string[]; city: string }): SegmentFacts => ({ trades: tradesOf(f.skills.flatMap((s) => SERVICES_BY_CREW_ROLE[s] ?? [])), city: f.city });

/** Does a record fall in the segment? */
export const inSegment = (seg: Segment, facts: SegmentFacts) =>
  (!seg.occasion || facts.occasion === seg.occasion) && (!seg.trade || facts.trades.includes(seg.trade)) && (!seg.city || facts.city === seg.city);

/** Human label for a segment ("Decor and floral · Pokhara"), or null when it is empty. */
export const segmentLabel = (seg: Segment, names: { occasion?: string; trade?: string }) => [names.occasion, names.trade, seg.city].filter(Boolean).join(' · ') || null;
