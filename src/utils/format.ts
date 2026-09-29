/**
 * Indian digit grouping (12,00,000) implemented by hand because Hermes'
 * Intl support for `en-IN` grouping is inconsistent across platforms.
 */
export function formatIndianNumber(value: number): string {
  const negative = value < 0;
  const [intPart, decimals] = Math.abs(Math.round(value * 100) / 100)
    .toString()
    .split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${negative ? '-' : ''}${grouped}${decimals ? `.${decimals}` : ''}`;
}

export const formatINR = (value: number) => `₹ ${formatIndianNumber(value)}`;

/** Compact form used in chips and filters: ₹1.2L, ₹45K, ₹2.5Cr. */
export function formatINRCompact(value: number): string {
  if (value >= 1_00_00_000) return `₹${trim(value / 1_00_00_000)}Cr`;
  if (value >= 1_00_000) return `₹${trim(value / 1_00_000)}L`;
  if (value >= 1_000) return `₹${trim(value / 1_000)}K`;
  return `₹${value}`;
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Date-only strings are parsed as local dates to avoid time-zone drift. */
const parseDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? fromISODate(iso) : new Date(iso));

/** "Tue 18 Aug" — matches the testimonial date style. */
export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18 August 2026" */
export function formatLongDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function daysUntil(iso: string): number {
  const target = parseDate(iso);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Store dates as yyyy-mm-dd so they never shift across time zones. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const pluralize = (count: number, word: string, plural = `${word}s`) =>
  `${count} ${count === 1 ? word : plural}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
