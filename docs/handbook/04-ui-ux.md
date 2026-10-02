# 04. UI and UX

One design system serves all four apps. Its name is **"Royal Nepali Luxury"** (adopted 2 October 2026, PR #20). The aim: the app should feel like a well-made Nepali wedding invitation (warm ivory paper, deep burgundy, a thin line of gold), and it should read as made by experienced human designers, not generated from a template.

Rules: R-UI-1 … R-UI-8 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

Open improvements (accessibility fixes, motion, dark mode, imagery) are prioritised in `docs/UI_UX_REPORT.md` (PR #21, 2 Oct 2026); check it before starting visual work.

## 1. Principles

1. **Calm and warm.** Mostly ivory and cream. Colour is used to mean something (selected, primary action, problem), not to decorate.
2. **Nepal first.** Nepali names, ceremonies, months (Bikram Sambat) and money formats. Devanagari sets in the same fonts as English.
3. **No template look.** No gradients, glows, coloured shadows, glassmorphism, emoji in chrome, all-caps eyebrows, "AI/magic/sparkle" wording, or icons in tinted squares on every KPI tile.
4. **Hide what doesn't apply.** Users see only the tools and screens their persona needs (see [09-personas-and-access.md](09-personas-and-access.md)). Never show a disabled feature with no explanation, and never dead-end a link.
5. **One action, one confirmation.** Every change gives a short toast ("Guest added"); every destructive action asks first.
6. **Works on a cheap Android phone and on a desktop browser.**

## 2. Colour tokens

Tokens live in `src/constants/theme.ts` (`colors`). Role apps read them through `useRoleTheme().c` (`src/theme/roles.ts`). **Never hard-code a hex in a screen** (R-UI-1): add a token.

| Token | Hex | Use |
|---|---|---|
| `primary` | #681C2A deep burgundy | Primary buttons, selected tabs and chips, links, headings that need weight |
| `primaryDark` / `wine` | #3D1018 wine | Luxury sections: the home wedding band, planner promo, featured badges, floating filter bar; the staff console accent |
| `primarySoft`, `primaryTint` | #F0E3DE, #F7EEE8 | Selected backgrounds |
| `gold` | #C8A46B champagne | Countdown, ratings, short gilt rules, hairlines on wine. **Never body text on ivory** |
| `goldDeep` | #8C6A33 | Gold-coloured text on ivory |
| `goldLine` | rgba(200,164,107,0.45) | Hairlines on wine and ivory |
| `rose`, `roseSoft` | #C98991, #F6E6E5 | Wedding-category accents, sparingly |
| `bg` | #FFF9F2 warm ivory | Screen background |
| `bgSoft` | #F5ECE2 pearl cream | Sections, filters, pressed states, `surfaceAlt` |
| `white` | #FFFCF8 soft white | Cards, text on dark backgrounds |
| `heading` | #251B18 espresso | Headings and strong text |
| `text`, `textBody` | #3B2E29, #54463F | Body text |
| `textMuted`, `textSubtle` | #796B64, #A39388 | Secondary information |
| `border`, `divider`, `hairline` | #E5D6C5, #EFE3D5, #E9DCCB | Card borders and rules |
| `success`, `warning`, `danger` | #3D6B4F, #9A6412, #B42318 | Status only |

**Distribution on any screen:** about 65% ivory/cream, 20% burgundy/wine, 10% espresso text, 5% champagne and dusty rose.

**Role accents.** Couple, business and freelancer apps share the burgundy accent; the staff console uses the deeper wine, so a coordinator can tell at a glance which app they are in. `ROLE_MARK` tells roles apart in chat labels. Status colours come from `statusTone()` and labels from `statusLabel()` (`src/theme/roles.ts`).

**Gradients:** `gradients` in `theme.ts` keeps old keys only so old call sites compile; all resolve to flat fills except photo scrims (`heroFade`, `collection*`). New photo scrims are tinted wine or espresso, never grey (R-UI-2).

## 3. Type

| Family | Where | Token |
|---|---|---|
| **Mukta** (Ek Type) | Everything you read and tap | `fonts.regular … extrabold` |
| **Martel** (Ek Type, serif) | Display lines only: screen and section titles, couple names, listing names, headline numbers (countdown, stat figures) | `serif.*`, or `<Text serif>` |

Both have Devanagari, so Nepali text sets in the same voice. **Don't add other font families** (R-UI-3). Fonts load once in the root layout (`APP_FONTS`); custom fonts on Android ignore `fontWeight`, so weight is chosen by family (`<Text weight="semibold">`).

Type scale (`type` in `theme.ts`):

| Style | Font | Size / line height |
|---|---|---|
| `display` | Martel bold | 30 / 40 |
| `title` | Mukta bold | 22 / 28 |
| `section` | Mukta bold | 18 / 24 |
| `heading` | Mukta semibold | 16 / 22 |
| `body` | Mukta regular | 15 / 22 |
| `bodySmall` | Mukta regular | 13 / 19 |
| `caption` | Mukta medium | 12 / 16 |
| `micro` | Mukta semibold | 11 / 14 |

Always render text with `Text` from `components/ui/Text` (it translates, picks the font and respects the role theme). Use `<Text raw>` for names, codes and anything the user typed, so it is never "translated".

## 4. Space and shape

- Spacing scale (`spacing`): 2, 4, 8, 12, 16, 20, 24, 32. Page gutter `GUTTER = 16`.
- Radius (`radius`): xs 3, sm 6, md 8, lg 10, xl 12, pill 999.
- **Cards:** 10 px radius, 1 px `border`, no shadow. **Buttons:** 8 px. **Chips and pills:** 4–6 px (R-UI-4).
- **Shadows** (`shadows.raised`, `shadows.fab`) only on things that float: sheets, toasts, the floating filter bar, a FAB.
- Touch targets ≥ 44 px; use `hitSlop` from `theme.ts` for small icons.

## 5. Copy

- **Sentence case everywhere**: titles, tabs, buttons, labels ("Add guest", not "Add Guest") (R-UI-5).
- No all-caps eyebrows, no letter-spaced labels, no emoji in UI chrome or notifications.
- Friendly and Nepal-first: "Namaste", "Dhanyabad", BS months, NPR.
- Say what happened, in the past tense, in toasts: "Quote sent", "Payment recorded".
- Errors say what to do next: "This quotation no longer exists" is acceptable; "Error 500" is not.
- The rule-based assistant is called **"Quick help"**; the concierge service is **"Vivah Planners"** (tab "Planner"). Never call anything "AI".
- For non-wedding occasions use the occasion's vocabulary (`OccasionDef.vocab`: "celebration", "event page" instead of "wedding website").
- Every English string has a Nepali line in `src/i18n/ne/index.ts` (R-UI-8, [11-i18n-dates-money.md](11-i18n-dates-money.md)).

## 6. Patterns

| Pattern | Rule |
|---|---|
| Stats / KPIs | Label above, number below in Martel, in ink. Colour the number only when it flags a problem (overdue, risk) (R-UI-7). Use `KpiCard` / `StatRow`. |
| Status | `StatusPill` with `statusTone()`; never a raw colour per screen. |
| Lists | `ListRow` (kit) or a `Card` per row; long lists use `FlatList`. |
| Forms | `KField` (kit) or `Field` (ui) with a label above; `required` marks; error under the field; `KeyboardAwareScrollView`. |
| Choosing one of few | `Segmented`; one of many: `ChoiceChips`; on/off: `Toggle`. |
| Destructive actions | Confirm through `utils/confirm`; say what will be lost. |
| Empty | `EmptyState` / `EmptyBlock` with a sentence and, if possible, the next action. |
| Loading | `Loader` / `LoadingState`; skeletons for lists. |
| Hidden feature (deep link) | An explanation of why, and how to unlock it (for example "Add the catering service to use Menu"). |
| Dates | Show BS by default with `formatShortDate`/`formatLongDate`; a second line with the other calendar via `formatDateAlt` where it helps. |
| Money | `formatMoney` / `formatMoneyCompact` only. |
| Announcements | `AnnouncementBanner` (super admin announcements). |

## 7. Layout

- Phone first (≈ 360–430 px), single column, 16 px gutter.
- At ≥ 960 px (`useLayout().wide`), role apps switch to a sidebar and multi-column grids; cap content width with `contentWidth`.
- Headers: `StackHeader` in role-app stacks, `RoleHeader` on role-app home screens, `ScreenHeader` in the couple app.

## 8. Accessibility

- Contrast: body text on ivory uses `text`/`textBody`/`heading`; gold text uses `goldDeep`.
- `Text` allows font scaling; don't fix heights on text containers.
- Give icon-only buttons an `accessibilityLabel`.
- Don't rely on colour alone for status: pair it with a label.
- Keep tap targets ≥ 44 px.

## 9. Before you ship a screen

- [ ] Only tokens; no hex; no gradient except photo scrims; no shadow on cards.
- [ ] Mukta for UI, Martel only for display lines.
- [ ] Sentence case; no emoji; no "AI" words; Nepali lines added.
- [ ] Empty, loading and error states exist.
- [ ] Works at phone and desktop width.
- [ ] Looks right in Nepali (longer words, Devanagari line height).

The design history (why burgundy, why these fonts) is in [20-decision-log.md](20-decision-log.md).
