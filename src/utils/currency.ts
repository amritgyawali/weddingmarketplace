/**
 * Display currencies. Every amount is stored, charged and paid out in NPR;
 * a person can choose to *read* prices in another currency (Settings →
 * Currency), which helps families abroad and guests from India, the Gulf,
 * Malaysia, Korea and further away. Rates are indicative (NPR per unit,
 * reviewed October 2026), so converted figures are labelled approximate and
 * payments, receipts, quotations and contracts always show NPR.
 */
export interface DisplayCurrency {
  code: string;
  name: string;
  /** NPR for one unit of this currency. */
  nprPerUnit: number;
  /** Decimal places when shown (0 for most; whole units read best in lists). */
  decimals: number;
}

/** NPR first, then the currencies Nepali families most often earn or send money in. */
export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = [
  { code: 'NPR', name: 'Nepali rupee', nprPerUnit: 1, decimals: 0 },
  { code: 'USD', name: 'US dollar', nprPerUnit: 138, decimals: 0 },
  { code: 'INR', name: 'Indian rupee', nprPerUnit: 1.6, decimals: 0 },
  { code: 'EUR', name: 'Euro', nprPerUnit: 160, decimals: 0 },
  { code: 'GBP', name: 'British pound', nprPerUnit: 184, decimals: 0 },
  { code: 'AUD', name: 'Australian dollar', nprPerUnit: 90, decimals: 0 },
  { code: 'CAD', name: 'Canadian dollar', nprPerUnit: 99, decimals: 0 },
  { code: 'AED', name: 'UAE dirham', nprPerUnit: 37.6, decimals: 0 },
  { code: 'QAR', name: 'Qatari riyal', nprPerUnit: 37.9, decimals: 0 },
  { code: 'SAR', name: 'Saudi riyal', nprPerUnit: 36.8, decimals: 0 },
  { code: 'MYR', name: 'Malaysian ringgit', nprPerUnit: 32.5, decimals: 0 },
  { code: 'KRW', name: 'South Korean won', nprPerUnit: 0.099, decimals: 0 },
  { code: 'JPY', name: 'Japanese yen', nprPerUnit: 0.92, decimals: 0 },
];

/** The base currency: what is stored, charged and paid out. */
export const BASE_CURRENCY = 'NPR';

/** The currency entry for a code, falling back to NPR for unknown codes. */
export function currencyFor(code: string | undefined): DisplayCurrency {
  return DISPLAY_CURRENCIES.find((c) => c.code === code) ?? DISPLAY_CURRENCIES[0];
}

/** Converts whole rupees into the display currency (unrounded). */
export function fromNpr(npr: number, code: string): number {
  return npr / currencyFor(code).nprPerUnit;
}
