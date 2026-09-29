import type { City } from '@/types';

export const ALL_CITIES = 'All Cities';

/** Order matches the "Which city is your wedding in?" chips. */
export const ONBOARDING_CITIES = [
  'Delhi NCR',
  'Mumbai',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Jaipur',
  'Pune',
] as const;

const metro = (name: string, state: string): City => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  state,
  group: 'metro',
});

const popular = (name: string, state: string): City => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  state,
  group: 'popular',
});

const state = (name: string): City => ({
  id: `state-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  group: 'state',
});

const intl = (name: string): City => ({
  id: `intl-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  group: 'international',
});

export const CITIES: City[] = [
  { id: 'all', name: ALL_CITIES, group: 'metro' },
  metro('Delhi NCR', 'Delhi'),
  metro('Mumbai', 'Maharashtra'),
  metro('Bangalore', 'Karnataka'),
  metro('Hyderabad', 'Telangana'),
  metro('Chennai', 'Tamil Nadu'),
  metro('Kolkata', 'West Bengal'),
  metro('Jaipur', 'Rajasthan'),
  metro('Pune', 'Maharashtra'),
  metro('Lucknow', 'Uttar Pradesh'),
  popular('Udaipur', 'Rajasthan'),
  popular('Goa', 'Goa'),
  popular('Jim Corbett', 'Uttarakhand'),
  popular('Kerala', 'Kerala'),
  popular('Ahmedabad', 'Gujarat'),
  popular('Chandigarh', 'Punjab'),
  popular('Indore', 'Madhya Pradesh'),
  popular('Kochi', 'Kerala'),
  popular('Mussoorie', 'Uttarakhand'),
  popular('Rishikesh', 'Uttarakhand'),
  popular('Jodhpur', 'Rajasthan'),
  popular('Coorg', 'Karnataka'),
  popular('Mysore', 'Karnataka'),
  popular('Varanasi', 'Uttar Pradesh'),
  popular('Kathmandu', 'Bagmati'),
  state('Rajasthan'),
  state('Maharashtra'),
  state('Karnataka'),
  state('Kerala'),
  state('Goa'),
  state('Uttarakhand'),
  state('Himachal Pradesh'),
  state('Punjab'),
  state('Gujarat'),
  state('Tamil Nadu'),
  intl('Thailand'),
  intl('Dubai'),
  intl('Bali'),
  intl('Nepal'),
  intl('Mauritius'),
];

export const CITY_SECTIONS: { title: string; group: City['group'] }[] = [
  { title: 'Top Metros', group: 'metro' },
  { title: 'Popular Cities', group: 'popular' },
  { title: 'States', group: 'state' },
  { title: 'International', group: 'international' },
];
