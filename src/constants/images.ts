import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled photography (sourced from the Stitch design export). Referencing
 * images by key keeps mock data serialisable and lets a real API swap in
 * remote URLs without touching components.
 */
export const photos = {
  venueGardenEstate: require('@/assets/images/photos/venue-garden-estate.jpg'),
  venueGardenPavilion: require('@/assets/images/photos/venue-garden-pavilion.jpg'),
  venueResortSunset: require('@/assets/images/photos/venue-resort-sunset.jpg'),
  venueLuxuryStage: require('@/assets/images/photos/venue-luxury-stage.jpg'),
  venueOutdoorMandap: require('@/assets/images/photos/venue-outdoor-mandap.jpg'),
  venueDestinationBeach: require('@/assets/images/photos/venue-destination-beach.jpg'),
  venueLawn: require('@/assets/images/photos/venue-lawn.jpg'),
  venueCliffside: require('@/assets/images/photos/venue-cliffside.jpg'),
  decorMandapNight: require('@/assets/images/photos/decor-mandap-night.jpg'),
  decorMandapFloral: require('@/assets/images/photos/decor-mandap-floral.jpg'),
  photographerTeam: require('@/assets/images/photos/photographer-team.jpg'),
  photographerCeremony: require('@/assets/images/photos/photographer-ceremony.jpg'),
  makeupArtists: require('@/assets/images/photos/makeup-artists.jpg'),
  makeupBridePortrait: require('@/assets/images/photos/makeup-bride-portrait.jpg'),
  plannerTeam: require('@/assets/images/photos/planner-team.jpg'),
  virtualPlanningCouple: require('@/assets/images/photos/virtual-planning-couple.jpg'),
  mehndiHands: require('@/assets/images/photos/mehndi-hands.jpg'),
  ideaReceptionToast: require('@/assets/images/photos/idea-reception-toast.jpg'),
  ideaBrideParasol: require('@/assets/images/photos/idea-bride-parasol.jpg'),
  ideaCoupleGardenWalk: require('@/assets/images/photos/idea-couple-garden-walk.jpg'),
  ideaCeremonyHands: require('@/assets/images/photos/idea-ceremony-hands.jpg'),
  assistantAvatar: require('@/assets/images/photos/assistant-avatar.jpg'),
  assistantFace: require('@/assets/images/photos/assistant-face.jpg'),
  expertDesk: require('@/assets/images/photos/expert-desk.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type PhotoKey = keyof typeof photos;

/** A bundled photo's key, or the address of a photo a super admin supplied (Content studio). */
export type PhotoRef = PhotoKey | (string & {});

export const PHOTO_KEYS = Object.keys(photos) as PhotoKey[];

const KEY_BY_SOURCE = new Map<unknown, PhotoKey>(PHOTO_KEYS.map((key) => [photos[key], key]));

export const isPhotoKey = (ref: string): ref is PhotoKey => Object.hasOwn(photos, ref);

/** The bundled photo a source came from, so `Photo` can show its replacement. */
export const photoKeyOf = (source: unknown) => KEY_BY_SOURCE.get(source);

/** An image source for a bundled key or an address. Always go through this: catalogue records may carry either. */
export function photo(ref: PhotoRef | null | undefined): ImageSourcePropType | undefined {
  if (!ref) return undefined;
  return isPhotoKey(ref) ? photos[ref] : { uri: ref };
}
