/**
 * Pure calculators behind the role toolkits. No React, no store: every
 * function takes plain values and returns plain values so it can move to the
 * server unchanged. Money is whole NPR; dates are yyyy-mm-dd.
 */
import { bsMonthLabel, isPeakSeason } from '@/data/events';
import { VALLEY } from '@/data/cities';
import { addDays, daysUntil, fromISODate, toISODate } from '@/utils/format';

const round = (n: number, to = 1) => Math.round(n / to) * to;

// ─── Dates ──────────────────────────────────────────────────────────────────

/** BS months in which Nepali wedding saits usually fall. */
export const SAIT_MONTHS = ['Mangsir', 'Magh', 'Falgun', 'Baisakh', 'Jestha'];

/** Deterministic 0–1 value for a date string (stable across renders and devices). */
function dateHash(iso: string) {
  let h = 2166136261;
  for (const ch of iso) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export interface SaitDate {
  date: string;
  bsMonth: string;
  weekday: string;
  saturday: boolean;
  peak: boolean;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Indicative wedding saits for the next `days` days: roughly six to eight a
 * month in the wedding months, none in Poush, Chaitra or the monsoon months.
 * The official list comes from the Nepali patro; couples confirm with their purohit.
 */
export function saitDates(fromIso: string, days = 365): SaitDate[] {
  const out: SaitDate[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(fromIso, i);
    const bsMonth = bsMonthLabel(date);
    if (!SAIT_MONTHS.includes(bsMonth.split(' ')[0])) continue;
    if (dateHash(date) > 0.24) continue;
    const wd = fromISODate(date).getDay();
    out.push({ date, bsMonth, weekday: WEEKDAYS[wd], saturday: wd === 6, peak: isPeakSeason(date) });
  }
  return out;
}

/** Nepal public holidays that affect weddings and operations (approximate; the patro is final). */
export const NEPAL_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-10-11', name: 'Ghatasthapana' },
  { date: '2026-10-18', name: 'Fulpati' },
  { date: '2026-10-20', name: 'Maha Ashtami' },
  { date: '2026-10-21', name: 'Vijaya Dashami' },
  { date: '2026-10-25', name: 'Kojagrat Purnima' },
  { date: '2026-11-08', name: 'Laxmi Puja' },
  { date: '2026-11-10', name: 'Bhai Tika' },
  { date: '2026-11-15', name: 'Chhath' },
  { date: '2026-12-30', name: 'Tamu Lhosar' },
  { date: '2027-01-15', name: 'Maghe Sankranti' },
  { date: '2027-02-06', name: 'Sonam Lhosar' },
  { date: '2027-02-19', name: 'Prajatantra Diwas' },
  { date: '2027-03-06', name: 'Maha Shivaratri' },
  { date: '2027-03-08', name: 'Gyalpo Lhosar' },
  { date: '2027-03-22', name: 'Holi' },
  { date: '2027-04-14', name: 'Nepali New Year' },
  { date: '2027-05-20', name: 'Buddha Jayanti' },
  { date: '2027-05-29', name: 'Ganatantra Diwas' },
];

/** Monday-first week start for an ISO date. */
export function weekStart(iso: string) {
  const d = fromISODate(iso);
  const diff = (d.getDay() + 6) % 7;
  return addDays(iso, -diff);
}

/** yyyy-mm for grouping. */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** The last `n` month keys ending with the month of `iso`, oldest first. */
export function lastMonths(iso: string, n: number): string[] {
  const d = fromISODate(iso);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return toISODate(x).slice(0, 7);
  });
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (key: string) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? key;

// ─── Weather ────────────────────────────────────────────────────────────────

type Region = 'valley' | 'pokhara' | 'terai' | 'hills';
const REGION_OF: Record<string, Region> = {
  Pokhara: 'pokhara',
  Begnas: 'pokhara',
  Bandipur: 'hills',
  Nagarkot: 'hills',
  Dhulikhel: 'hills',
  Chitwan: 'terai',
  Sauraha: 'terai',
  Butwal: 'terai',
  Biratnagar: 'terai',
  Birgunj: 'terai',
  Nepalgunj: 'terai',
  Janakpur: 'terai',
  Dhangadhi: 'terai',
  Itahari: 'terai',
  Lumbini: 'terai',
  Hetauda: 'terai',
  Dharan: 'terai',
};
export const regionFor = (city: string): Region => (VALLEY.includes(city) ? 'valley' : (REGION_OF[city] ?? 'valley'));

/** [min °C, max °C, rain days] per AD month, Jan → Dec. Long-run averages, rounded. */
const CLIMATE: Record<Region, [number, number, number][]> = {
  valley: [[2, 19, 1], [4, 21, 2], [8, 25, 3], [12, 28, 5], [16, 29, 10], [19, 29, 20], [20, 28, 26], [20, 28, 24], [18, 27, 16], [13, 26, 5], [7, 23, 1], [3, 20, 1]],
  pokhara: [[7, 20, 2], [8, 22, 2], [12, 26, 4], [15, 29, 7], [18, 30, 14], [20, 30, 22], [21, 29, 28], [21, 29, 27], [20, 28, 19], [16, 27, 6], [11, 24, 1], [8, 21, 1]],
  terai: [[8, 23, 1], [10, 26, 1], [14, 32, 1], [19, 36, 2], [23, 36, 6], [25, 35, 14], [25, 33, 22], [25, 33, 20], [24, 32, 13], [20, 31, 4], [14, 28, 1], [9, 24, 1]],
  hills: [[1, 14, 2], [2, 15, 3], [6, 19, 4], [9, 22, 6], [13, 23, 12], [15, 23, 21], [16, 22, 27], [16, 22, 26], [15, 21, 18], [11, 20, 6], [6, 17, 1], [2, 15, 1]],
};

export interface ClimateNote {
  min: number;
  max: number;
  rainDays: number;
  verdict: 'great' | 'good' | 'risky';
  tips: string[];
}

/** Typical weather for a city and date, with planning tips. */
export function climateFor(city: string, iso: string): ClimateNote {
  const region = regionFor(city);
  const month = fromISODate(iso).getMonth();
  const [min, max, rainDays] = CLIMATE[region][month];
  const tips: string[] = [];
  if (rainDays >= 14) tips.push('Monsoon month: book a covered mandap and a rain plan for every outdoor function.');
  else if (rainDays >= 6) tips.push('Pre-monsoon showers are common in the afternoon; keep outdoor rituals in the morning.');
  if (min <= 5) tips.push('Cold evenings: arrange heaters, shawls for elders and hot drinks at the reception.');
  if (max >= 33) tips.push('Very hot days: schedule the ceremony early, add fans or coolers and plenty of water.');
  if (region === 'terai' && (month === 11 || month === 0)) tips.push('Winter fog in the Terai can delay morning flights and road travel; add buffer time for the janti.');
  if (region === 'valley' && (month === 2 || month === 3)) tips.push('Spring dust and haze: ask the photographer about indoor backup portraits.');
  if (!tips.length) tips.push('Settled, dry weather — one of the best times of year for an outdoor function.');
  const verdict = rainDays >= 14 || max >= 35 ? 'risky' : rainDays >= 6 || min <= 3 ? 'good' : 'great';
  return { min, max, rainDays, verdict, tips };
}

// ─── Couple planning ────────────────────────────────────────────────────────

export const HONEYMOON_SPOTS: { id: string; name: string; perNight: [number, number, number]; travel: number; blurb: string }[] = [
  { id: 'pokhara', name: 'Pokhara', perNight: [4_500, 11_000, 28_000], travel: 12_000, blurb: 'Lakeside, Sarangkot sunrise, paragliding' },
  { id: 'chitwan', name: 'Chitwan (Sauraha)', perNight: [5_000, 12_000, 32_000], travel: 9_000, blurb: 'Jungle safari, Tharu culture, river sunsets' },
  { id: 'bandipur', name: 'Bandipur', perNight: [3_500, 8_000, 16_000], travel: 7_000, blurb: 'Newari hill town, quiet and romantic' },
  { id: 'ilam', name: 'Ilam', perNight: [3_000, 6_500, 12_000], travel: 22_000, blurb: 'Tea gardens and misty hills in the east' },
  { id: 'mustang', name: 'Mustang (Jomsom, Marpha)', perNight: [4_000, 9_000, 20_000], travel: 38_000, blurb: 'Apple orchards, Muktinath, dramatic landscapes' },
  { id: 'nagarkot', name: 'Nagarkot & Dhulikhel', perNight: [4_000, 10_000, 22_000], travel: 3_000, blurb: 'Himalayan views an hour from Kathmandu' },
  { id: 'rara', name: 'Rara Lake', perNight: [2_500, 5_000, 9_000], travel: 45_000, blurb: 'Remote, pristine, for adventurous couples' },
];

export const TIERS = ['Budget', 'Comfort', 'Luxury'] as const;
export type Tier = (typeof TIERS)[number];

/** Honeymoon estimate for two: stay, food and activities, travel. */
export function honeymoonEstimate(spotId: string, nights: number, tier: Tier) {
  const spot = HONEYMOON_SPOTS.find((s) => s.id === spotId) ?? HONEYMOON_SPOTS[0];
  const n = Math.max(1, Math.round(nights));
  const ti = TIERS.indexOf(tier);
  const stay = spot.perNight[ti] * n;
  const food = [2_500, 5_000, 10_000][ti] * n;
  const activities = [3_000, 8_000, 18_000][ti] + n * [500, 1_500, 3_000][ti];
  const travel = spot.travel * [1, 1.4, 2.2][ti];
  const total = round(stay + food + activities + travel, 500);
  return { spot, stay, food, activities: round(activities, 100), travel: round(travel, 100), total };
}

/** Vehicles for the janti (baraat): coaches first, then micro-buses, then cars. */
export function jantiVehicles(headcount: number, opts: { bus?: number; micro?: number; car?: number } = {}) {
  const seats = { bus: opts.bus ?? 35, micro: opts.micro ?? 14, car: opts.car ?? 4 };
  let left = Math.max(0, Math.round(headcount));
  const bus = Math.floor(left / seats.bus);
  left -= bus * seats.bus;
  const micro = Math.floor(left / seats.micro);
  left -= micro * seats.micro;
  const car = Math.ceil(left / seats.car);
  return { bus, micro, car, seats: bus * seats.bus + micro * seats.micro + car * seats.car };
}

/** Months left and monthly saving needed to hit a target by the wedding date. */
export function savingsPlan(target: number, saved: number, monthly: number, byIso: string) {
  const months = Math.max(0, Math.floor(daysUntil(byIso) / 30.4));
  const gap = Math.max(0, target - saved);
  const needed = months > 0 ? Math.ceil(gap / months) : gap;
  const projected = saved + monthly * months;
  return { months, gap, needed, projected, onTrack: projected >= target, progress: target > 0 ? Math.min(1, saved / target) : 0 };
}

/** Customary tips and dakshina by service, per person or per booking. */
export const TIP_GUIDE: Record<string, { label: string; amount: number; per: 'booking' | 'crew' }> = {
  priest: { label: 'Purohit dakshina', amount: 11_001, per: 'booking' },
  catering: { label: 'Kitchen and service staff', amount: 500, per: 'crew' },
  photography: { label: 'Photo and video team', amount: 1_000, per: 'crew' },
  makeup: { label: 'Makeup artist and assistant', amount: 1_000, per: 'crew' },
  decoration: { label: 'Decor crew', amount: 500, per: 'crew' },
  transport: { label: 'Drivers', amount: 1_000, per: 'crew' },
  band: { label: 'Panche baja / band', amount: 2_000, per: 'booking' },
  dj: { label: 'DJ and sound crew', amount: 1_000, per: 'booking' },
  mehendi: { label: 'Mehendi artists', amount: 500, per: 'crew' },
};
export const tipFor = (serviceId: string, crewCount: number) => {
  const g = TIP_GUIDE[serviceId];
  if (!g) return { label: 'Crew', amount: 500 * Math.max(1, crewCount) };
  return { label: g.label, amount: g.per === 'crew' ? g.amount * Math.max(1, crewCount) : g.amount };
};

// ─── Money and tax ──────────────────────────────────────────────────────────

/** Nepal resident individual income tax slabs (FY 2081/82; check the IRD for the current year). The first slab is the 1% social security tax. */
const SLABS_SINGLE: [number, number][] = [
  [500_000, 0.01],
  [200_000, 0.1],
  [300_000, 0.2],
  [1_000_000, 0.3],
  [3_000_000, 0.36],
  [Infinity, 0.39],
];
const SLABS_COUPLE: [number, number][] = [
  [600_000, 0.01],
  [200_000, 0.1],
  [300_000, 0.2],
  [900_000, 0.3],
  [3_000_000, 0.36],
  [Infinity, 0.39],
];

/** Estimated annual income tax on taxable income, with the slab-by-slab breakdown. */
export function nepalIncomeTax(taxable: number, married = false) {
  let left = Math.max(0, Math.round(taxable));
  const rows: { rate: number; amount: number; tax: number }[] = [];
  for (const [width, rate] of married ? SLABS_COUPLE : SLABS_SINGLE) {
    if (left <= 0) break;
    const amount = Math.min(left, width);
    rows.push({ rate, amount, tax: Math.round(amount * rate) });
    left -= amount;
  }
  const tax = rows.reduce((s, r) => s + r.tax, 0);
  return { tax, rows, effective: taxable > 0 ? tax / taxable : 0 };
}

/** VAT position for a VAT-registered business: output VAT on sales minus input credit on purchases. */
export function vatPosition(sales: number, vatablePurchases: number, rate = 0.13) {
  const output = Math.round(sales * rate);
  const input = Math.round(vatablePurchases * rate);
  return { output, input, payable: Math.max(0, output - input), credit: Math.max(0, input - output) };
}

/** Net Promoter Score from 0–10 ratings. */
export function nps(scores: number[]) {
  if (!scores.length) return { score: 0, promoters: 0, passives: 0, detractors: 0 };
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return { score: Math.round(((promoters - detractors) / scores.length) * 100), promoters, passives: scores.length - promoters - detractors, detractors };
}

// ─── Pricing helpers ────────────────────────────────────────────────────────

export interface PriceInput {
  base: number;
  date: string;
  guests?: number;
  includedGuests?: number;
  perExtraGuest?: number;
  peakPct?: number;
  saturdayPct?: number;
  lastMinutePct?: number;
}

/** Suggested price for a date: peak-season and Saturday uplifts, last-minute discount, extra guests. */
export function suggestPrice(i: PriceInput) {
  const lines: { label: string; amount: number }[] = [{ label: 'Base price', amount: i.base }];
  if (isPeakSeason(i.date) && i.peakPct) lines.push({ label: `Peak season (${bsMonthLabel(i.date).split(' ')[0]}) +${i.peakPct}%`, amount: Math.round((i.base * i.peakPct) / 100) });
  if (fromISODate(i.date).getDay() === 6 && i.saturdayPct) lines.push({ label: `Saturday +${i.saturdayPct}%`, amount: Math.round((i.base * i.saturdayPct) / 100) });
  const extra = Math.max(0, (i.guests ?? 0) - (i.includedGuests ?? 0));
  if (extra && i.perExtraGuest) lines.push({ label: `${extra} extra guests`, amount: extra * i.perExtraGuest });
  const days = daysUntil(i.date);
  if (days >= 0 && days <= 30 && i.lastMinutePct) {
    const sub = lines.reduce((s, l) => s + l.amount, 0);
    lines.push({ label: `Last-minute (${days} days away) −${i.lastMinutePct}%`, amount: -Math.round((sub * i.lastMinutePct) / 100) });
  }
  const total = round(Math.max(0, lines.reduce((s, l) => s + l.amount, 0)), 100);
  return { lines, total };
}

/** Square feet per guest by layout (industry rules of thumb). */
export const LAYOUTS: { id: string; label: string; sqft: number }[] = [
  { id: 'theatre', label: 'Theatre (rows)', sqft: 8 },
  { id: 'cocktail', label: 'Standing / cocktail', sqft: 10 },
  { id: 'banquet', label: 'Banquet (long tables)', sqft: 12 },
  { id: 'round', label: 'Round tables of 10', sqft: 14 },
  { id: 'buffet', label: 'Seated with buffet line', sqft: 16 },
];
export const hallCapacity = (areaSqft: number, sqftPerGuest: number) => (sqftPerGuest > 0 ? Math.floor(Math.max(0, areaSqft) / sqftPerGuest) : 0);

export interface RateInput {
  hours: number;
  hourlyRate: number;
  dayRate: number;
  travelKm: number;
  perKm?: number;
  freeKm?: number;
  assistants?: number;
  assistantRate?: number;
  rush?: boolean;
  overnight?: boolean;
}

/** Freelancer quote: hourly up to the day-rate cap, then overtime; travel, assistants, rush edit and overnight stay. */
export function freelancerQuote(i: RateInput) {
  const lines: { label: string; amount: number }[] = [];
  const hours = Math.max(0, i.hours);
  const baseHours = Math.min(hours, 10);
  const time = Math.min(baseHours * i.hourlyRate, i.dayRate || Infinity);
  lines.push({ label: hours > 0 && time === i.dayRate ? 'Day rate' : `${baseHours} h × hourly`, amount: Math.round(time) });
  if (hours > 10) lines.push({ label: `${hours - 10} h overtime (1.5×)`, amount: Math.round((hours - 10) * i.hourlyRate * 1.5) });
  const km = Math.max(0, i.travelKm - (i.freeKm ?? 20));
  if (km) lines.push({ label: `Travel ${km} km beyond ${i.freeKm ?? 20} km`, amount: Math.round(km * (i.perKm ?? 25)) });
  if (i.assistants) lines.push({ label: `${i.assistants} assistant${i.assistants > 1 ? 's' : ''}`, amount: i.assistants * (i.assistantRate ?? 3_000) });
  if (i.overnight) lines.push({ label: 'Overnight stay and food', amount: 3_500 });
  const sub = lines.reduce((s, l) => s + l.amount, 0);
  if (i.rush) lines.push({ label: 'Rush delivery (+20%)', amount: Math.round(sub * 0.2) });
  return { lines, total: round(lines.reduce((s, l) => s + l.amount, 0), 100) };
}

// ─── Operations ─────────────────────────────────────────────────────────────

/** Hours between two ISO timestamps (never negative). */
export const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000);

/** Bucket dated amounts into the next `weeks` weeks starting this week. */
export function weeklyBuckets(fromIso: string, weeks: number, items: { date: string; amount: number }[]) {
  const start = weekStart(fromIso);
  const buckets = Array.from({ length: weeks }, (_, i) => ({ week: addDays(start, i * 7), amount: 0 }));
  for (const it of items) {
    const idx = Math.floor((fromISODate(it.date).getTime() - fromISODate(start).getTime()) / (7 * 86_400_000));
    if (idx >= 0 && idx < weeks) buckets[idx].amount += it.amount;
  }
  return buckets;
}

/** Pairs weekly inflow and outflow buckets into net and running totals. */
export function netFlow(ins: { week: string; amount: number }[], outs: { week: string; amount: number }[]) {
  return ins.reduce<{ week: string; in: number; out: number; net: number; running: number }[]>((rows, w, i) => {
    const out = outs[i]?.amount ?? 0;
    const net = w.amount - out;
    return [...rows, { week: w.week, in: w.amount, out, net, running: (rows[rows.length - 1]?.running ?? 0) + net }];
  }, []);
}

/** Simple percent change, or null when there is no base. */
export const change = (current: number, previous: number) => (previous > 0 ? (current - previous) / previous : null);

// ─── Power ──────────────────────────────────────────────────────────────────

/** Standard diesel generator sizes hired in Nepal (kVA). */
export const GENERATOR_SIZES = [5, 7.5, 10, 15, 20, 25, 30, 40, 50, 62.5, 75, 100, 125, 160, 200, 250];

/**
 * Generator for a connected load: kW at a 0.8 power factor, plus 25% headroom
 * for start-up surges, rounded up to a size you can actually hire.
 */
export function generatorFor(watts: number) {
  const kw = Math.max(0, watts) / 1000;
  const kva = (kw / 0.8) * 1.25;
  const size = GENERATOR_SIZES.find((s) => s >= kva) ?? Math.ceil(kva / 50) * 50;
  return { kw: Math.round(kw * 10) / 10, kva: Math.round(kva * 10) / 10, size, amps: Math.round((watts / 230) * 10) / 10 };
}
