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

export const photo = (key: PhotoKey) => photos[key];
