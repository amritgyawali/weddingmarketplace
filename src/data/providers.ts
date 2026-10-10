import type { PhotoRef } from '@/constants/images';
import type { VerificationStatus } from '@/types/platform';
import { seeded } from '@/utils/random';

import { VENDORS } from './vendors';
import { VENUES } from './venues';

/**
 * One shape for every bookable business (venues and service vendors), used by
 * the matching engine, the quote builder and the coordinator console.
 * Reputation fields are public; `internal` holds marketplace signals that are
 * only shown to the platform team.
 */
export interface Provider {
  id: string;
  kind: 'venue' | 'vendor';
  name: string;
  serviceId: string;
  categoryId: string;
  city: string;
  locality?: string;
  serviceAreas: string[];
  travels: boolean;
  rating: number;
  reviewCount: number;
  startingPrice: number;
  priceUnit: string;
  capacity?: { min: number; max: number };
  image: PhotoRef;
  experienceYears: number;
  completedProjects: number;
  languages: string[];
  styles: string[];
  instantBook: boolean;
  verification: VerificationStatus;
  internal: {
    responseMinutes: number;
    responseRate: number;
    completionRate: number;
    cancellationRate: number;
    reliability: number;
    platformPriority: number;
    lateArrivals: number;
    disputes: number;
  };
}

function internals(id: string, rating: number): Provider['internal'] {
  const r = seeded(`${id}-internal`);
  const cancellationRate = Math.round(r.next() ** 3 * 0.25 * 100) / 100;
  const completionRate = Math.round((1 - cancellationRate * 0.6) * 100) / 100;
  const responseMinutes = r.pick([8, 15, 30, 45, 90, 180, 360, 720]);
  const responseRate = Math.round((0.7 + r.next() * 0.3) * 100) / 100;
  const lateArrivals = r.int(0, 4);
  const disputes = r.next() > 0.85 ? r.int(1, 2) : 0;
  const reliability = Math.round(
    Math.max(
      0,
      Math.min(100, 40 * completionRate + 20 * (rating / 5) + 10 * responseRate + 10 * r.next() + 20 - (lateArrivals * 2 + disputes * 5 + cancellationRate * 40)),
    ),
  );
  return { responseMinutes, responseRate, completionRate, cancellationRate, reliability, platformPriority: Math.round(r.next() * 100) / 100, lateArrivals, disputes };
}

/** Flagship listings used by the demo accounts are always verified. */
const ALWAYS_VERIFIED = new Set([VENUES[0]?.id, 'wedding-story-nepal-kathmandu']);

const verificationFor = (id: string): VerificationStatus => {
  if (ALWAYS_VERIFIED.has(id)) return 'VERIFIED';
  const x = seeded(`${id}-kyc`).next();
  return x > 0.18 ? 'VERIFIED' : x > 0.08 ? 'UNDER_REVIEW' : 'DOCUMENT_SUBMITTED';
};

export const PROVIDERS: Provider[] = [
  ...VENUES.map((v): Provider => {
    const r = seeded(`${v.id}-meta`);
    return {
      id: v.id,
      kind: 'venue',
      name: v.name,
      serviceId: 'venue',
      categoryId: 'venues',
      city: v.city,
      locality: v.locality,
      serviceAreas: [v.city],
      travels: false,
      rating: v.rating,
      reviewCount: v.reviewCount,
      startingPrice: v.rentalCost,
      priceUnit: 'per event',
      capacity: v.capacity,
      image: v.images[0],
      experienceYears: r.int(3, 25),
      completedProjects: r.int(40, 900),
      languages: ['Nepali', 'English', 'Hindi'],
      styles: [v.type],
      instantBook: r.next() > 0.8,
      verification: verificationFor(v.id),
      internal: internals(v.id, v.rating),
    };
  }),
  ...VENDORS.map(
    (v): Provider => ({
      id: v.id,
      kind: 'vendor',
      name: v.name,
      serviceId: v.subcategoryId,
      categoryId: v.categoryId,
      city: v.city,
      serviceAreas: v.serviceAreas ?? [v.city],
      travels: v.travels ?? false,
      rating: v.rating,
      reviewCount: v.reviewCount,
      startingPrice: v.startingPrice,
      priceUnit: v.priceUnit,
      image: v.images[0],
      experienceYears: v.experience,
      completedProjects: v.eventsDone,
      languages: v.languages ?? ['Nepali', 'English'],
      styles: v.styles ?? [],
      instantBook: v.instantBook ?? false,
      verification: verificationFor(v.id),
      internal: internals(v.id, v.rating),
    }),
  ),
];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));
export const findProvider = (id: string) => BY_ID.get(id);
export const providersFor = (serviceId: string) => PROVIDERS.filter((p) => p.serviceId === serviceId);
