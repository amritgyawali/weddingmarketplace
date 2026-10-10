/**
 * Bikram Sambat (BS), the Nepali calendar. Dates are still stored as AD
 * `yyyy-mm-dd`; this module only converts them for display and for the
 * month grids, so persisted data and the SQL stay unchanged.
 *
 * Month lengths for BS 2000–2090 (AD 1943–2034) from the official calendar,
 * one digit per month as `days − 29` (MIT data from nepali-date-converter).
 */
const TABLE =
  '132321110102223222101011223321101011232321110012132321110102223222101011223321101011232321110012' +
  '222322011002223222101011223321101011232321110012222322011011223222101011223321101011232321110012' +
  '222322011011223222101011232321101011232321110102222322101011223222101011232321110011232321110102' +
  '222322101011223222101011232321110012132321110102223222101011223231101011232321110012132321110102' +
  '223222101011223321101011232321110012132322011002223222101011223321101011232321110012222322011011' +
  '223222101011223321101011232321110012222322011011223222101011232321101011232321110012222322101011' +
  '223222101011232321110011232321110102222322101011223222101011232321110011232321110102223222101011' +
  '223231101011232321110012132321110102223222101011223321101011232321110012132322010102223222101011' +
  '223321101011232321110012222322011002223222101011223321101011232321110012222322011011223222101011' +
  '232321101011232321110012222322101011223222101011232321110011232321110102222322101011223222101011' +
  '232321110011232321110102223222101011223222101011232321110012132321110102223222101011223222110111' +
  '123312110111132321110111132321110111';

/** First Bikram Sambat year the month-length table covers. */
export const BS_FIRST_YEAR = 2000;
/** Last Bikram Sambat year the month-length table covers (extend the table before this). */
export const BS_LAST_YEAR = BS_FIRST_YEAR + TABLE.length / 12 - 1;
/** BS 2000 Baisakh 1 = AD 1943-04-14 (UTC day number). */
const EPOCH = Date.UTC(1943, 3, 14) / 86_400_000;

/** Bikram Sambat month names in English, Baisakh first. */
export const BS_MONTHS_EN = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
/** Bikram Sambat month names in Nepali, Baisakh first. */
export const BS_MONTHS_NE = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
/** Weekday names in Nepali, Sunday first. */
export const WEEKDAYS_NE = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
/** One-letter Nepali weekday labels for calendar headers, Sunday first. */
export const WEEKDAYS_NE_SHORT = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'];

/** A Bikram Sambat calendar date; `month` is zero-based. */
export interface BsDate {
  year: number;
  /** 0 = Baisakh … 11 = Chaitra */
  month: number;
  day: number;
}

/** Days in a BS month, or 30 outside the table. */
export function bsDaysInMonth(year: number, month: number): number {
  const i = (year - BS_FIRST_YEAR) * 12 + month;
  if (i < 0 || i >= TABLE.length) return 30;
  return 29 + Number(TABLE[i]);
}

const inRange = (year: number) => year >= BS_FIRST_YEAR && year <= BS_LAST_YEAR;

const isoParts = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** AD `yyyy-mm-dd` → BS, or null outside BS 2000–2090. */
export function adToBs(iso: string): BsDate | null {
  const { y, m, d } = isoParts(iso);
  if (!y || !m || !d) return null;
  let days = Date.UTC(y, m - 1, d) / 86_400_000 - EPOCH;
  if (days < 0) return null;
  for (let year = BS_FIRST_YEAR; year <= BS_LAST_YEAR; year++) {
    for (let month = 0; month < 12; month++) {
      const len = bsDaysInMonth(year, month);
      if (days < len) return { year, month, day: days + 1 };
      days -= len;
    }
  }
  return null;
}

/** BS → AD `yyyy-mm-dd`, or null outside the table. */
export function bsToAd({ year, month, day }: BsDate): string | null {
  if (!inRange(year) || month < 0 || month > 11) return null;
  let days = 0;
  for (let y = BS_FIRST_YEAR; y < year; y++) for (let mm = 0; mm < 12; mm++) days += bsDaysInMonth(y, mm);
  for (let mm = 0; mm < month; mm++) days += bsDaysInMonth(year, mm);
  days += Math.min(day, bsDaysInMonth(year, month)) - 1;
  const date = new Date((EPOCH + days) * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const DEVANAGARI = '०१२३४५६७८९';
/** "2083" → "२०८३" */
export const toNepaliDigits = (s: string | number) => String(s).replace(/[0-9]/g, (c) => DEVANAGARI[Number(c)]);

/** Name of a BS month (0 = Baisakh) in English or Nepali; wraps around outside 0–11. */
export const bsMonthName = (month: number, lang: 'en' | 'ne' = 'en') => (lang === 'ne' ? BS_MONTHS_NE : BS_MONTHS_EN)[((month % 12) + 12) % 12];

/** Moves a BS month cursor by `delta` months. */
export function shiftBsMonth({ year, month }: { year: number; month: number }, delta: number) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Weekday (0 = Sunday) of an AD iso date. */
const weekdayOf = (iso: string) => {
  const { y, m, d } = isoParts(iso);
  return new Date(y, m - 1, d).getDay();
};

/** One day cell of a month grid. */
export interface MonthCell {
  /** AD date the cell stands for. */
  iso: string;
  /** Day number in the calendar being shown. */
  day: number;
  /** Day number in the other calendar (AD day for a BS grid, BS day for an AD grid). */
  alt: number;
}

/**
 * Cells of one month, padded with nulls to whole weeks starting Sunday.
 * `mode: 'bs'` lays out a Nepali month; `'ad'` a Gregorian one.
 */
export function monthCells(mode: 'bs' | 'ad', cursor: { year: number; month: number }): (MonthCell | null)[] {
  const cells: (MonthCell | null)[] = [];
  if (mode === 'bs' && inRange(cursor.year)) {
    const first = bsToAd({ year: cursor.year, month: cursor.month, day: 1 })!;
    const len = bsDaysInMonth(cursor.year, cursor.month);
    for (let i = 0; i < weekdayOf(first); i++) cells.push(null);
    const { y, m, d } = isoParts(first);
    for (let day = 1; day <= len; day++) {
      const date = new Date(y, m - 1, d + day - 1);
      cells.push({ iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, day, alt: date.getDate() });
    }
  } else {
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const len = new Date(cursor.year, cursor.month + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= len; day++) {
      const iso = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
      cells.push({ iso, day, alt: adToBs(iso)?.day ?? day });
    }
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** The month cursor (in the given calendar) that contains an AD date. */
export function cursorFor(mode: 'bs' | 'ad', iso: string) {
  if (mode === 'bs') {
    const bs = adToBs(iso);
    if (bs) return { year: bs.year, month: bs.month };
  }
  const { y, m } = isoParts(iso);
  return { year: y, month: m - 1 };
}
