# 11. Language, dates and money

Vivah ships in **English and Nepali**, shows dates in **Bikram Sambat** (BS, the Nepali calendar) by default, and shows money in **NPR**. This guide explains how, and the rules for adding text, dates and amounts.

Rules: R-UI-8, R-PROD-2 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

## 1. Translation

**Screens are written in English.** Translation happens at render time:

- `Text` (`components/ui/Text.tsx`) translates its string children through `translate()` in `src/i18n/runtime.ts`. A run of strings and numbers is joined first, so `{done} of {total} tasks done` is looked up as one sentence and word order can change.
- Fields, `SearchBar`, toasts and the confirm dialog translate too. For a raw `TextInput` placeholder, call `tr()`; in components, `useT()`.
- Lookup order: a super admin's **text override** (`DbData.textOverrides`, either language) → an **exact** dictionary entry → a **template** entry (keys with `{0}`, `{1}`… whose placeholders match any text and are translated in turn; an English plural `s` placeholder becomes nothing) → the English text unchanged.
- The dictionary is `NE` in `src/i18n/ne/index.ts` (about 5,000 entries in October 2026): English key exactly as written in the code → Nepali.
- `<Text raw>` renders children as given: use it for names, codes, phone numbers and anything the user typed.
- Language and calendar live in `usePrefs` (`src/i18n/index.tsx`, persisted as `vivah-prefs`); `I18nProvider` at the root keeps the runtime in sync. `LanguageSwitch` sits on the welcome screen, Profile and Settings.
- `runtime.ts` has no React or store imports, so pure modules and Node scripts can use it.

**When you add UI text** (R-UI-8):

1. Write the English in sentence case.
2. Add `"English": "नेपाली"` to `NE`. For dynamic text, add a template: `"{0} days to go": "{0} दिन बाँकी"`.
3. Check the screen in Nepali: Devanagari words are often longer; avoid fixed widths.

## 2. Dates

**Storage is always AD `yyyy-mm-dd`** (date-only) or ISO timestamps. BS is for display only, so persisted data and SQL never change.

| Need | Use (`src/utils/format.ts`) |
|---|---|
| Today as `yyyy-mm-dd` | `today()` (local) |
| Date ↔ string | `toISODate(date)`, `fromISODate(iso)` (local, timezone-safe) |
| Arithmetic | `addDays(iso, n)`, `daysUntil(iso)` |
| Display (BS unless the user picked AD) | `formatShortDate`, `formatLongDate`, `formatMonthDay` |
| The other calendar on a second line | `formatDateAlt` |
| Always AD | `formatAdDate` |
| Time | `formatTime(iso)`, `formatClock('16:30')`, `timeAgo`, `relativeDay` |

**Never `new Date('yyyy-mm-dd')`**: it parses as UTC midnight and shows the previous day in Nepal (UTC+5:45) on some devices.

**Bikram Sambat** (`src/utils/bs.ts`): converts with the official month-length table for **BS 2000–2090 (AD 1943 – April 2034)**. Month names `BS_MONTHS_EN` / `BS_MONTHS_NE` (Baisakh … Chaitra); peak wedding months are Mangsir, Magh, Falgun and Baisakh. Every month grid (`Calendar`, `MonthGrid`, `AvailabilityCalendar`) lays out Nepali months with the AD day in small type.

> **Maintenance deadline:** the BS table ends at BS 2090 (about April 2034). Before then, extend `TABLE` in `src/utils/bs.ts` from the official calendar and raise `BS_LAST_YEAR`. Put a reminder in the decision log when someone picks this up.

Seed dates are relative (`day(n)`, `at(n)` in `data/seed.ts`), never fixed.

## 3. Money

| Need | Use |
|---|---|
| Display an amount | `formatMoney(150000)` → `NPR 150,000` |
| Tight spaces (chips, filters) | `formatMoneyCompact` → `NPR 45K`, `NPR 2.5M`; ranges `formatMoneyRange` |
| Budgets the way families talk | `formatLakh` → "7.5 lakh", "1.2 crore"; `formatLakhRange` |
| Read typed amounts | `parseMoney("1,50,000" \| "150k" \| "1.5 lakh")` → number (NaN if invalid) |
| Totals | `quoteTotals`, `paymentSummary`, `projectEconomics` (never arithmetic in JSX) |
| Rounding | `roundMoney` |
| VAT | `VAT_RATE` / `TAX_RATE` = 0.13 |

Never ₹, INR, GST or `toLocaleString` on money (R-PROD-2).

## 4. Phone numbers

Nepali mobiles are 10 digits starting 96, 97 or 98 (`isNepalMobile`); format with `formatPhone`. The session store normalises to the last 10 digits.
