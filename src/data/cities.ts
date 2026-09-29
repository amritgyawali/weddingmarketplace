import type { City } from '@/types';

export const ALL_CITIES = 'All Nepal';

/** Order matches the "Where is your wedding?" chips. */
export const ONBOARDING_CITIES = [
  'Kathmandu',
  'Lalitpur',
  'Bhaktapur',
  'Pokhara',
  'Chitwan',
  'Butwal',
  'Biratnagar',
  'Dharan',
] as const;

const city = (name: string, province: string, group: City['group'], lat: number, lng: number): City => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  state: province,
  group,
  lat,
  lng,
});

const province = (name: string, lat: number, lng: number): City => ({
  id: `province-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  group: 'state',
  lat,
  lng,
});

export const CITIES: City[] = [
  { id: 'all', name: ALL_CITIES, group: 'metro' },
  // Kathmandu Valley
  city('Kathmandu', 'Bagmati', 'metro', 27.7172, 85.324),
  city('Lalitpur', 'Bagmati', 'metro', 27.6644, 85.3188),
  city('Bhaktapur', 'Bagmati', 'metro', 27.671, 85.4298),
  city('Kirtipur', 'Bagmati', 'metro', 27.6788, 85.2775),
  // Major cities
  city('Pokhara', 'Gandaki', 'popular', 28.2096, 83.9856),
  city('Chitwan', 'Bagmati', 'popular', 27.6833, 84.4333),
  city('Butwal', 'Lumbini', 'popular', 27.7006, 83.4484),
  city('Biratnagar', 'Koshi', 'popular', 26.4525, 87.2718),
  city('Dharan', 'Koshi', 'popular', 26.8125, 87.2836),
  city('Birgunj', 'Madhesh', 'popular', 27.0104, 84.8773),
  city('Nepalgunj', 'Lumbini', 'popular', 28.05, 81.6167),
  city('Janakpur', 'Madhesh', 'popular', 26.7288, 85.9263),
  city('Hetauda', 'Bagmati', 'popular', 27.4284, 85.0322),
  city('Dhangadhi', 'Sudurpashchim', 'popular', 28.7014, 80.5895),
  city('Itahari', 'Koshi', 'popular', 26.6646, 87.2718),
  // Provinces
  province('Koshi', 26.8, 87.3),
  province('Madhesh', 26.9, 85.9),
  province('Bagmati', 27.7, 85.3),
  province('Gandaki', 28.2, 84.0),
  province('Lumbini', 27.7, 83.4),
  province('Karnali', 28.9, 81.9),
  province('Sudurpashchim', 29.0, 80.6),
  // Destination wedding spots
  city('Nagarkot', 'Bagmati', 'international', 27.7154, 85.5206),
  city('Dhulikhel', 'Bagmati', 'international', 27.6219, 85.5424),
  city('Bandipur', 'Gandaki', 'international', 27.9365, 84.4062),
  city('Sauraha', 'Bagmati', 'international', 27.5747, 84.4955),
  city('Lumbini', 'Lumbini', 'international', 27.4833, 83.2767),
  city('Begnas', 'Gandaki', 'international', 28.1733, 84.0939),
];

export const CITY_SECTIONS: { title: string; group: City['group'] }[] = [
  { title: 'Kathmandu Valley', group: 'metro' },
  { title: 'Major Cities', group: 'popular' },
  { title: 'Provinces', group: 'state' },
  { title: 'Destination Weddings', group: 'international' },
];

export const findCity = (name: string) => CITIES.find((c) => c.name === name);

/** Great-circle distance between two cities in km (null when unknown). */
export function cityDistanceKm(a: string, b: string): number | null {
  if (a === b) return 0;
  const ca = findCity(a);
  const cb = findCity(b);
  if (ca?.lat == null || ca.lng == null || cb?.lat == null || cb.lng == null) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(cb.lat - ca.lat);
  const dLng = rad(cb.lng - ca.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(ca.lat)) * Math.cos(rad(cb.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}

/** Cities inside the Kathmandu valley are treated as one service area. */
export const VALLEY = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Kirtipur'];
export const sameServiceArea = (a: string, b: string) => a === b || (VALLEY.includes(a) && VALLEY.includes(b));
