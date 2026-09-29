import type { FreelancerProfile } from '@/types/platform';
import { seeded } from '@/utils/random';

/**
 * Directory of independent crew across Nepal. Freelancer accounts created in
 * the app are merged into this list by the store (see useFreelancerDirectory).
 */

const PEOPLE: [name: string, city: string, skills: string[]][] = [
  ['Sanjay Gurung', 'Kathmandu', ['Photographer', 'Drone Operator']],
  ['Pooja Shrestha', 'Lalitpur', ['Photographer', 'Assistant Photographer']],
  ['Bikash Tamang', 'Kathmandu', ['Videographer', 'Editor']],
  ['Anil Thapa', 'Bhaktapur', ['Videographer', 'Drone Operator']],
  ['Kiran Rai', 'Kathmandu', ['Drone Operator', 'Videographer']],
  ['Sarita Basnet', 'Lalitpur', ['Coordinator']],
  ['Manish Joshi', 'Kathmandu', ['Editor', 'Retoucher']],
  ['Laxmi Magar', 'Kathmandu', ['Makeup Artist', 'Hair Stylist']],
  ['Ritu Pradhan', 'Lalitpur', ['Makeup Artist']],
  ['Asmita Limbu', 'Kathmandu', ['Hair Stylist', 'Makeup Artist']],
  ['Gita Bajracharya', 'Bhaktapur', ['Mehendi Artist']],
  ['Sunita Adhikari', 'Kathmandu', ['Mehendi Artist']],
  ['Dinesh KC', 'Kathmandu', ['DJ', 'Sound Engineer']],
  ['Rohit Sherpa', 'Kathmandu', ['Lighting Technician', 'AV Technician']],
  ['Hari Bhattarai', 'Kathmandu', ['Driver']],
  ['Ram Thapa', 'Lalitpur', ['Driver']],
  ['Suresh Gurung', 'Kathmandu', ['Decor Staff', 'Decorator']],
  ['Kamal Rai', 'Bhaktapur', ['Decor Staff', 'Rigging Crew']],
  ['Nabin Shrestha', 'Kathmandu', ['Server', 'Event Staff']],
  ['Prakash Magar', 'Kathmandu', ['Chef']],
  ['Sabina Tamang', 'Kathmandu', ['Coordinator', 'Event Staff']],
  ['Bishal Karki', 'Kathmandu', ['MC']],
  ['Aarati Gurung', 'Pokhara', ['Photographer', 'Videographer']],
  ['Dipak Paudel', 'Pokhara', ['Drone Operator', 'Photographer']],
  ['Mina Gurung', 'Pokhara', ['Makeup Artist']],
  ['Santosh Thapa', 'Pokhara', ['Videographer', 'Editor']],
  ['Kumar Pun', 'Pokhara', ['Driver', 'Event Staff']],
  ['Roshni Chaudhary', 'Chitwan', ['Makeup Artist', 'Mehendi Artist']],
  ['Bijay Mahato', 'Chitwan', ['Photographer']],
  ['Sagar Neupane', 'Butwal', ['Photographer', 'Videographer']],
  ['Anjali Yadav', 'Biratnagar', ['Makeup Artist']],
  ['Rabin Limbu', 'Dharan', ['DJ', 'MC']],
  ['Pratik Shah', 'Birgunj', ['Photographer', 'Drone Operator']],
  ['Kabita Rana', 'Kathmandu', ['Florist', 'Decor Staff']],
  ['Umesh Dahal', 'Kathmandu', ['Streaming Technician', 'AV Technician']],
  ['Sagun Maharjan', 'Lalitpur', ['Bartender']],
  ['Nirmala Shrestha', 'Kathmandu', ['Booth Attendant', 'Event Staff']],
  ['Sujan Lama', 'Kathmandu', ['Photographer', 'Videographer', 'Drone Operator']],
  ['Priya Joshi', 'Lalitpur', ['Assistant Photographer', 'Editor']],
];

const CAMERAS = ['Sony A7 IV', 'Canon R6 II', 'Nikon Z6 II', 'Sony A7S III', 'Canon 5D IV'];
const LENSES = ['24-70mm f/2.8', '70-200mm f/2.8', '35mm f/1.4', '85mm f/1.8', '50mm f/1.2'];
const DRONES = ['DJI Mavic 3', 'DJI Air 3', 'DJI Mini 4 Pro'];

const RATES: Record<string, number> = {
  Photographer: 8_000,
  'Assistant Photographer': 4_000,
  Videographer: 9_000,
  'Drone Operator': 8_000,
  Editor: 6_000,
  Retoucher: 5_000,
  Coordinator: 5_000,
  'Makeup Artist': 10_000,
  'Hair Stylist': 5_000,
  'Mehendi Artist': 3_500,
  DJ: 12_000,
  MC: 10_000,
  Driver: 2_500,
};

function equipmentFor(skills: string[], r: ReturnType<typeof seeded>): FreelancerProfile['equipment'] {
  const out: FreelancerProfile['equipment'] = [];
  if (skills.some((s) => ['Photographer', 'Videographer', 'Assistant Photographer'].includes(s))) {
    out.push({ kind: 'camera', name: r.pick(CAMERAS) });
    r.pickMany(LENSES, r.int(1, 3)).forEach((name) => out.push({ kind: 'lens', name }));
    if (r.next() > 0.4) out.push({ kind: 'flash', name: 'Godox V1' });
    if (skills.includes('Videographer')) out.push({ kind: 'gimbal', name: 'DJI RS 3' });
  }
  if (skills.includes('Drone Operator')) out.push({ kind: 'drone', name: r.pick(DRONES) });
  if (skills.includes('Makeup Artist')) out.push({ kind: 'kit', name: r.pick(['MAC + Huda pro kit', 'Airbrush kit', 'HD makeup kit']) });
  if (skills.includes('DJ')) out.push({ kind: 'audio', name: 'Pioneer DDJ-1000 controller' });
  if (skills.includes('Driver') || r.next() > 0.7) out.push({ kind: 'vehicle', name: r.pick(['Scooter', 'Hatchback car', 'SUV']) });
  return out;
}

export const FREELANCER_DIRECTORY: FreelancerProfile[] = PEOPLE.map(([name, city, skills], i) => {
  const id = `fl_${name.toLowerCase().replace(/\W+/g, '_')}`;
  const r = seeded(id);
  const primary = skills[0];
  const dayRate = r.roundTo((RATES[primary] ?? 3_000) * (0.8 + r.next() * 0.6), 500);
  const completed = r.int(3, 140);
  const cancellationRate = Math.round(r.next() ** 3 * 0.2 * 100) / 100;
  const rating = r.rating(4.0);
  const lateArrivals = r.int(0, 5);
  const noShows = r.next() > 0.9 ? 1 : 0;
  const responseRate = Math.round((0.65 + r.next() * 0.35) * 100) / 100;
  return {
    id,
    name,
    city,
    skills,
    headline: `${primary}${skills[1] ? ` · ${skills[1]}` : ''} — ${r.int(1, 12)} yrs`,
    bio: `${primary} based in ${city}. Worked ${completed}+ weddings and events across Nepal.`,
    experienceYears: r.int(1, 12),
    dayRate,
    hourlyRate: Math.round(dayRate / 8 / 50) * 50,
    eventRate: r.roundTo(dayRate * 1.2, 500),
    travelRadiusKm: r.pick([15, 25, 50, 100, 200]),
    languages: r.pick([['Nepali', 'English'], ['Nepali', 'Hindi', 'English'], ['Nepali', 'Newari'], ['Nepali']]),
    equipment: equipmentFor(skills, r),
    ownVehicle: r.next() > 0.5,
    rating,
    ratingCount: Math.round(completed * 0.6),
    completedGigs: completed,
    cancellationRate,
    responseRate,
    lateArrivals,
    noShows,
    reliability: Math.round(Math.max(0, Math.min(100, 40 * (1 - cancellationRate) + 20 * (rating / 5) + 10 * responseRate + 10 * Math.min(1, completed / 40) + 20 - lateArrivals * 2 - noShows * 10))),
    verification: i % 9 === 4 ? 'UNDER_REVIEW' : 'VERIFIED',
    available: r.next() > 0.12,
    portfolio: [],
  };
});

export const findFreelancer = (id: string) => FREELANCER_DIRECTORY.find((f) => f.id === id);
