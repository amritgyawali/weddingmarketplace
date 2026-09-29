/**
 * Money is NPR everywhere. Grouping is done by hand because Hermes' Intl
 * support varies across platforms.
 */
export const CURRENCY = 'NPR';

export function formatNumber(value: number): string {
  const negative = value < 0;
  const [intPart, decimals] = Math.abs(Math.round(value * 100) / 100)
    .toString()
    .split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${decimals ? `.${decimals}` : ''}`;
}

/** NPR 150,000 */
export const formatMoney = (value: number) => `${CURRENCY} ${formatNumber(Math.round(value))}`;

/** Compact form used in chips and filters: NPR 800, NPR 45K, NPR 975K, NPR 2.5M. */
export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${CURRENCY} ${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${CURRENCY} ${trim(abs / 1_000)}K`;
  return `${sign}${CURRENCY} ${Math.round(abs)}`;
}

/** Budget range: NPR 40K–60K */
export const formatMoneyRange = (lo: number, hi: number) =>
  lo === hi ? formatMoneyCompact(lo) : `${formatMoneyCompact(lo)}–${formatMoneyCompact(hi).replace(`${CURRENCY} `, '')}`;

const trim = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');

/** Parse "1,50,000", "150000", "150k", "1.5m" into a number (NaN when invalid). */
export function parseMoney(input: string): number {
  const s = input.trim().toLowerCase().replace(/npr|rs\.?|,|\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|l|lakh)?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  const mult = m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : m[2] === 'l' || m[2] === 'lakh' ? 100_000 : 1;
  return Math.round(n * mult);
}

export const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Date-only strings are parsed as local dates to avoid time-zone drift. */
const parseDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? fromISODate(iso) : new Date(iso));

/** "Tue 18 Aug" */
export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18 August 2026" */
export function formatLongDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Dec 12" */
export function formatMonthDay(iso: string): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "18:30" → "6:30 PM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "2h ago", "3d ago", or a short date for older timestamps. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatShortDate(iso);
}

export function daysUntil(iso: string): number {
  const target = parseDate(iso);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "in 3 days", "today", "2 days ago" */
export function relativeDay(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
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

export const addDays = (iso: string, days: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const pluralize = (count: number, word: string, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Short human code, e.g. for invites: "K7P2QX". */
export const shortCode = (length = 6) =>
  Array.from({ length }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/** Nepal mobile numbers: 97/98 + 8 digits. */
export const isNepalMobile = (phone: string) => /^9[678]\d{8}$/.test(phone.replace(/\D/g, '').slice(-10));
export const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+977 ${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : phone;
};

/** Today's date as yyyy-mm-dd (local). */
export const today = () => toISODate(new Date());
