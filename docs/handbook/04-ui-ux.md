# 04. UI and UX

One design system serves all four apps. Its name is **"Royal Nepali Luxury"** (adopted 2 October 2026, PR #20). The aim: the app should feel like a well-made Nepali wedding invitation (warm ivory paper, deep burgundy, a thin line of gold), and it should read as made by experienced human designers, not generated from a template.

Rules: R-UI-1 … R-UI-8 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

Open improvements (accessibility fixes, motion, dark mode, imagery) are prioritised in `docs/UI_UX_REPORT.md` (PR #21, 2 Oct 2026); check it before starting visual work. The 3 October 2026 pass (§10 below) closed its quick wins and most of its "next" list.

## 1. Principles

1. **Calm and warm.** Mostly ivory and cream. Colour is used to mean something (selected, primary action, problem), not to decorate.
2. **Nepal first.** Nepali names, ceremonies, months (Bikram Sambat) and money formats. Devanagari sets in the same fonts as English.
3. **No template look.** No gradients, glows, coloured shadows, glassmorphism, emoji in chrome, all-caps eyebrows, "AI/magic/sparkle" wording, or icons in tinted squares on every KPI tile. (List-row icons sit in a quiet pearl tile and quick actions in a soft medallion; stat tiles stay text-only.)
4. **Hide what doesn't apply.** Users see only the tools and screens their persona needs (see [09-personas-and-access.md](09-personas-and-access.md)). Never show a disabled feature with no explanation, and never dead-end a link.
5. **One action, one confirmation.** Every change gives a short toast ("Guest added"); every destructive action asks first.
6. **Works on a cheap Android phone and on a desktop browser.**

## 2. Colour tokens

Tokens live in `src/constants/theme.ts` (`colors`). Role apps read them through `useRoleTheme().c` (`src/theme/roles.ts`). **Never hard-code a hex in a screen** (R-UI-1): add a token. ESLint enforces it in `src/app` and `src/components` (`no-restricted-syntax` in `eslint.config.js`); the only files allowed hex values are the couple-chosen website and invitation themes (`website.tsx`, `invitations.tsx`, `w/[slug].tsx`) and the payment brand marks (`work/Payments.tsx`).

| Token | Hex | Use |
|---|---|---|
| `primary` | #681C2A deep burgundy | Primary buttons, selected tabs and chips, links, headings that need weight |
| `primaryDark` / `wine` | #3D1018 wine | Luxury sections: the home wedding band, planner promo, featured badges, floating filter bar; the staff console accent |
| `primarySoft`, `primaryTint` | #F0E3DE, #F7EEE8 | Selected backgrounds |
| `gold` | #C8A46B champagne | Countdown, ratings, short gilt rules, hairlines on wine. **Never body text on ivory** |
| `goldDeep` | #7F5F2C | Gold-coloured text on ivory and pearl (5.0 : 1 on pearl) |
| `goldLine`, `goldTrack` | rgba(200,164,107,0.45 / 0.22) | Hairlines on wine and ivory; progress tracks on wine |
| `wineDeep`, `wineSoft` | #260A0F, #EDE0DC | The staff console's dark and soft fills |
| `onWineMuted` | rgba(255,252,248,0.72) | Secondary text on wine bands (8.7 : 1) |
| `rose`, `roseSoft`, `roseDeep` | #C98991, #F6E6E5, #8E4F58 | Wedding-category accents, sparingly; `roseDeep` for small marks (freelancer role mark, avatars) |
| `bg` | #FFF9F2 warm ivory | Screen background |
| `bgSoft` | #F5ECE2 pearl cream | Sections, filters, pressed states, `surfaceAlt` |
| `white` | #FFFCF8 soft white | Cards, text on dark backgrounds |
| `heading` | #251B18 espresso | Headings and strong text |
| `text`, `textBody` | #3B2E29, #54463F | Body text |
| `textMuted` | #6F625B | Secondary text (5.6 : 1 on ivory, 5.0 : 1 on pearl) |
| `textSubtle` | #8F7F74 | Icons, disabled states and large display numbers only (3.7 : 1). **Never small text** |
| `placeholder` | #8E7F75 | Input placeholders |
| `border`, `divider`, `hairline` | #E5D6C5, #EFE3D5, #E9DCCB | Card borders and rules (decorative) |
| `borderStrong` | #9F8A75 | Control boundaries: inputs, search, toggles, outline buttons (3.2 : 1, WCAG 1.4.11) |
| `success`, `warning`, `danger`, `info` | #3D6B4F, #8A5A10, #B42318, #3E5C7E | Status only; each passes 5 : 1 on its own 10% tint (status pills) |
| `successSoft`, `dangerSoft` | #E6F0E8, #FBE9E7 | Soft status fills (seated tables, destructive dialog icon) |
| `warningDeep`, `dangerDeep`, `*OnDark` | #3A2E12, #4A1515, … | Dark toasts and the accents that read on them |

**Distribution on any screen:** about 65% ivory/cream, 20% burgundy/wine, 10% espresso text, 5% champagne and dusty rose.

**Role accents.** Couple, business and freelancer apps share the burgundy accent; the staff console uses the deeper wine, so a coordinator can tell at a glance which app they are in. `ROLE_MARK` tells roles apart in chat labels. Status colours come from `statusTone()` and labels from `statusLabel()` (`src/theme/roles.ts`).

**Role palette extras.** `RolePalette` also carries `borderStrong`, `accent` (champagne, for thin marks) and `accentText` (`goldDeep`).

**Gradients:** `gradients` in `theme.ts` keeps old keys only so old call sites compile; all resolve to flat fills except photo scrims (`heroFade`, `collection*`, `photoCaption`). New photo scrims are tinted wine or espresso, never grey (R-UI-2); `photoCaption` is the wine scrim under captions on photo cards.

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

Always render text with `Text` from `components/ui/Text` (it translates, picks the font and respects the role theme). Use `<Text raw>` for names, codes and anything the user typed, so it is never "translated". Use `<Text numeric>` for money, counts and countdowns (tabular figures, so columns line up and changing numbers don't jiggle).

`Text` follows the system text size up to `MAX_FONT_SCALE` (1.6×). Dense chrome passes its own lower `maxFontSizeMultiplier` (tab labels 1.2, pills and stat labels 1.3, badges 1).

## 4. Space and shape

- Spacing scale (`spacing`): 2, 4, 8, 12, 16, 20, 24, 32. Page gutter `GUTTER = 16`.
- Radius (`radius`): xs 3, sm 6, md 8, lg 10, xl 12, pill 999.
- **Cards:** 10 px radius, 1 px `border`, no shadow. **Buttons:** 8 px. **Chips and pills:** 4–6 px (R-UI-4).
- **Shadows** (`shadows.raised`, `shadows.fab`) only on things that float: sheets, toasts, the floating filter bar, a FAB.
- Touch targets ≥ 44 px; use `hitSlop` from `theme.ts` for small icons.
- Icon sizes: snap to `iconSize` (xs 14, sm 16, md 20, lg 24, xl 28).
- Sheets have 16 px top corners; dialogs 12 px (things that float may be a little rounder than cards).

## 5. Copy

- **Sentence case everywhere**: titles, tabs, buttons, labels ("Add guest", not "Add Guest") (R-UI-5).
- No all-caps eyebrows, no letter-spaced labels, no emoji in UI chrome or notifications.
- Friendly and Nepal-first: "Namaste", BS months, NPR. English text says "Thank you", never "Dhanyabad" (the Nepali translation says धन्यवाद).
- A link to a full list is always labelled "View all" ("View all venues"), never "See all".
- Say what happened, in the past tense, in toasts: "Quote sent", "Payment recorded".
- Errors say what to do next: "This quotation no longer exists" is acceptable; "Error 500" is not.
- The rule-based assistant is called **"Quick help"**; the concierge service is **"Vivah Planners"** (tab "Planner"). Never call anything "AI".
- For non-wedding occasions use the occasion's vocabulary (`OccasionDef.vocab`: "celebration", "event page" instead of "wedding website").
- Every English string has a Nepali line in `src/i18n/ne/index.ts` (R-UI-8, [11-i18n-dates-money.md](11-i18n-dates-money.md)).

## 6. Patterns

| Pattern | Rule |
|---|---|
| Stats / KPIs | Label above, number below in Martel, in ink. Colour the number only when it flags a problem (overdue, risk) (R-UI-7). Use `KpiCard`; for rows of three or four small figures (guests, seating, registry) `StatTile`. |
| The one urgent thing | `FocusBand` (kit): a wine band with the gilt ornament, a serif title, an optional gold figure and at most two actions (the first in champagne). One per dashboard, at the top: the business home's first booking request (else new enquiries), staff Today's weddings live today. |
| Status | `StatusPill` with `statusTone()`; never a raw colour per screen. |
| Lists | `ListRow` (kit) or a `Card` per row; long lists use `FlatList`. |
| Forms | `KField` (kit) or `Field` (ui) with a label above; `required` marks; error under the field; `KeyboardAwareScrollView`. Submit buttons are never silently disabled for missing input: pass `missing="Enter a title"` (and `useFormCheck` for per-field errors) so a tap says what is missing. `disabled` is only for "busy". Descriptions take `maxLength` (and `minLength`), which shows the allowed length and a live count. Longer forms keep a draft on the device with `useDraft` (`store/drafts`). |
| Photos | A listing's photo badge and photos open `PhotoViewer` (full screen, X to close). Every photo a person uploads can be removed again. |
| Choosing one of few | `Segmented` (counts show in a small pill); one of many: `ChoiceChips`; a filter or sort chip: `FilterChip` (burgundy with a check when selected; never style a `Pressable` as a chip by hand); on/off: `Toggle`. |
| Destructive actions | Confirm through `utils/confirm`; say what will be lost. |
| Empty | `EmptyState` / `EmptyBlock`: a pearl medallion with a champagne ring around an icon, a serif title, a sentence and, if possible, the next action. Pass `art` (`mandap`, `garland`, `kalash`, `diya`, `rings`) for a line drawing from `ui/Illustration` where a screen deserves warmth (first-run lists). |
| Photos | `Photo` (`ui/Photo`), never `expo-image` directly: a pearl placeholder while loading and a cross-dissolve in (none with Reduce Motion). |
| Ornament | `Ornament` (`ui/Ornament`), the Dhaka-weave gilt divider. Only on the home wedding band, the welcome headline, the Vendors feature card and `FocusBand`; never as wallpaper. |
| Loading | `Loader` / `LoadingState`; skeletons for lists. |
| Hidden feature (deep link) | An explanation of why, and how to unlock it (for example "Add the catering service to use Menu"). |
| Dates | Show BS by default with `formatShortDate`/`formatLongDate`; a second line with the other calendar via `formatDateAlt` where it helps. |
| Money | `formatMoney` / `formatMoneyCompact` only. |
| Announcements | `AnnouncementBanner` (super admin announcements). |

## 7. Layout

- Phone first (≈ 360–430 px), single column, 16 px gutter.
- At ≥ 960 px (`useLayout().wide`), role apps switch to a sidebar and multi-column grids; cap content width with `contentWidth`. A dashboard with many blocks splits into a main column and a ~380 px side rail (the business home does: requests, attention and upcoming on the left; figures, quick actions, setup, social and earnings on the right).
- Tab bars: a champagne hairline on top and a champagne `TabMark` over the active tab (down the left edge of the active sidebar item), so the state is never carried by colour alone.
- Headers: `StackHeader` in role-app stacks, `RoleHeader` on role-app home screens, `ScreenHeader` in the couple app.

## 8. Accessibility

- Contrast: body text on ivory uses `text`/`textBody`/`heading`; secondary text `textMuted`; gold text uses `goldDeep`. Every text pair in the palette passes 4.5 : 1 (`textSubtle` is for icons and display numbers only).
- Control boundaries (inputs, toggles, outline buttons) use `borderStrong` (3 : 1); focus is a 2 px `primary` border.
- `Text` allows font scaling up to 1.6×; don't fix heights on text containers.
- **Motion:** respect Reduce Motion. `useMotion()` (`hooks/useMotion.ts`) gives the shared ease-out curve, `enter(i)` (fade-and-rise, staggered) and `fade`, all `undefined` when the user asked for less motion; `Photo`, `Toggle`, `Skeleton`, `TabMark` and the welcome slideshow (starts paused, with a pause button) already follow it. One or two moving things per screen; animate a container once rather than every list item (items re-mount when the store loads and would replay).
- Screen and section titles carry `accessibilityRole="header"` (done in `RoleHeader`, `StackHeader`, `ScreenHeader`, `SectionTitle`, `SectionHeader`, `Sheet`).
- Give icon-only buttons an `accessibilityLabel`.
- Don't rely on colour alone for status: pair it with a label.
- Keep tap targets ≥ 44 px.

## 9. Before you ship a screen

- [ ] Only tokens; no hex (lint fails otherwise); no gradient except photo scrims; no shadow on cards.
- [ ] Photos through `Photo`; filter chips through `FilterChip`; at most one `FocusBand`.
- [ ] Works with Reduce Motion on and with the largest text size.
- [ ] Mukta for UI, Martel only for display lines.
- [ ] Sentence case; no emoji; no "AI" words; Nepali lines added.
- [ ] Empty, loading and error states exist.
- [ ] Works at phone and desktop width.
- [ ] Looks right in Nepali (longer words, Devanagari line height).

The design history (why burgundy, why these fonts) is in [20-decision-log.md](20-decision-log.md).

## 10. Change log

- **3 October 2026, finish and craft pass.** WCAG AA contrast for every text token and 3 : 1 control borders; gilt tab bars; `Photo` fade-in everywhere; medallion empty states with line drawings; `FilterChip`, `StatTile`, `FocusBand`; the `Ornament`; motion tokens and Reduce Motion support; editorial Vendors tab; desktop two-column business home; palette-only dialog, toast and WhatsApp pill; hex-literal lint rule. Status per roadmap item in `docs/UI_UX_REPORT.md` §6.
