# AGENTS.md: rules for any AI working on Vivah

Every AI coding agent must read this file before changing anything in this repo. That includes Claude Code, Codex, Cursor, Copilot and Gemini. `CLAUDE.md` imports it.

It is the single source of truth for the product strategy, the architecture, the business logic and the rules that keep existing features working. If your change alters something described here, update this file in the same change.

> **Prime directive: never break existing functionality.**
>
> - Every change must be additive or strictly equivalent for the existing flows, roles, routes, store actions, persisted data and seed demo.
> - When in doubt, add a new action, field or route instead of changing the meaning of an existing one.
> - Run the checks in §9 before you say the work is done.

---

## 1. Product: what Vivah is and why

Vivah is a **wedding-services orchestration marketplace for Nepal**. The couple says once what they need, and the platform manages the whole wedding. That means:

- matching providers;
- one versioned quotation;
- one payment schedule;
- crew;
- execution on the wedding day;
- payouts and reviews.

These product decisions are fixed. Do not reverse them without the owner's say-so:

| Decision | Rule |
|---|---|
| Market | **Nepal only.** |
| Currency and tax | NPR, formatted `NPR 1,50,000`-style via `formatMoney`/`formatMoneyCompact`. **13% VAT** (`VAT_RATE`/`TAX_RATE`). Never use ₹, INR or GST. |
| Places | Kathmandu valley (Kathmandu, Lalitpur, Bhaktapur, Kirtipur), Pokhara, Chitwan and other Nepal cities in `src/data/cities.ts`. |
| Ceremonies | Nepali functions (Wedding, Reception, Mehendi, Haldi, Pasni, Bratabandha…), with Bikram Sambat months (Mangsir/Magh/Falgun/Baisakh are peak season). |
| Payments | eSewa, Khalti, Fonepay QR, ConnectIPS, IME Pay, card, bank transfer, and cash (recorded by staff only). |
| Backend | **An on-device mock backend** (zustand `useDb`, persisted to AsyncStorage) plus a **full Postgres/Supabase SQL schema** in `supabase/migrations/`. The SQL is **not deployed**. Never apply it to a Supabase project without asking the owner. |
| Runtime | **Everything must keep running in Expo Go (SDK 57).** Do not add libraries with custom native code; see §10. |
| Admin console | The same Expo app, under the Platform role, is web-ready. Screens must also work as a wide dashboard via `npx expo start --web`. `useLayout()` switches to the sidebar layout at ≥ 960 px. There is no separate web project. |
| Demo-ability | Every role has a one-tap demo account, and the seed tells a coherent story. Keep it working; see §7. |

## 2. The four role apps (one binary)

| Role (`UserRole`) | App | Routes | Theme |
|---|---|---|---|
| `customer`, the couple | Marketplace + **My Wedding** planning tools | `src/app/(tabs)/…` and root screens (`my-wedding`, `plan`, `guests`, `seating`, `budget`, `website`, `invitations`, `registry`, `boards`, `compare`, `deals`, `contracts`, `calendar`, `checklist`, `quote/[id]` …) | sindoor crimson |
| `vendor`: venues and businesses | Vivah for Business: leads CRM, quote builder, bookings, crew, calendar, packages, portfolio, finance, analytics, promotions, reviews, team, verification | `src/app/business/…` | pine green |
| `freelancer`: photographers, makeup artists, crew | Gig marketplace: gigs, invites, emergency gigs, assignments, GPS check-in/out, calendar and weekly rules, earnings, profile | `src/app/freelancer/…` | slate blue |
| `platform`: staff (coordinator, admin, support, finance) | Operations console: today view, leads kanban, 12-tab project console, matching, quote builder, control room, emergency replacement, approvals, finance, users, providers, freelancers, analytics, marketplace, audit | `src/app/platform/…` | graphite |

Public pages need no sign-in: `/w/[slug]` (the couple's wedding website and registry) and `/rsvp/[code]` (the guest RSVP).

**Routing.** Routing is **Expo Router**, with a `Stack.Protected` guard per role in `src/app/_layout.tsx`. A role must never be able to reach another role's app. Signed out, users go to `welcome/`. A couple that hasn't onboarded goes to `onboarding/` (one screen, five questions: who, date, city, guests, budget, then a review card). "Build our plan" there calls `submitPlan` with sensible defaults (Wedding + Reception, the six core services); "Just browse" only saves the answers to `useAppStore` (`guests`, `budget`), which prefill the full 8-step plan wizard later.

**Demo sign-in.** Use any `98XXXXXXXX` number with OTP **1234**, or tap "Continue as …" on each login screen. New platform staff need the access code `VIVAH2026`.

| Demo account | Phone | What it shows |
|---|---|---|
| Aakriti Shrestha, couple | 9800000001 | Owns WP-1021 |
| Rajesh Pradhan, vendor (Everest Grand Party Palace) | 9800000002 | Venue business |
| Raj Maharjan, freelancer | 9800000003 | Photographer |
| Sita Karki, platform coordinator | 9800000004 | Coordination console |
| Anil Gurung, vendor (Wedding Story Nepal) | 9800000005 | Photo studio |
| Bikram Adhikari, platform admin | 9800000006 | Admin console |

## 3. Architecture map

```
src/
  app/                 Expo Router screens only (every file is a route; _layout.tsx = navigators)
  components/
    kit/               role-themed primitives (Card, KButton, KField, Segmented, KPI, charts…) — use these in role apps
    ui/                couple-app primitives (Text, PressableScale, Toast, Sheet, EmptyState…)
    work/              shared workflow UI used by several roles: MatchPanel, QuoteEditor, QuoteDocument,
                       Bookings, Payments, TaskBoard, Timeline, ThreadView, AvailabilityCalendar, RunSheet,
                       ContractView, SignaturePad, GigForm, ApplicantsList, VerificationScreen…
    planner/ home/ listing/ detail/ genie/ ideas/ navigation/ onboarding/ wedding/
  store/
    useDb.ts           re-export of store/db — THE shared backend (all 4 roles)
    db/                backend split by domain: core, quotes, projects, finance, gigs, chat, trust, planner
                       + helpers.ts (now/today, currentActor, mapProject, mapBooking, nextNumber…) + types.ts (DbData)
    useSession.ts      accounts + session (mock auth). useAccount()/useCurrentAccount()
    useAppStore.ts     per-device couple marketplace state (onboarding, city, shortlist, likes, legacy bookings/chats)
  services/            pure business logic (no React): matching, pricing, quotes, planner, risk,
                       documents (printable HTML), exporters (ICS/CSV/PDF/share), api (catalogue reads),
                       assistant (rule-based), auth (completeLogin/onAccountCreated/logout)
  data/                Nepal catalogue (cities, services, events/ceremonies, venues, vendors, providers,
                       freelancers, ideas, genie) + seed.ts (demo accounts and the whole demo world)
  hooks/               useWorkspace (role-scoped selectors), useLayout (wide ≥ 960 px), queries (React Query), useHydrated…
  theme/ constants/    role themes/fonts, colours, images, brand
  types/platform.ts    the domain model (mirrors the SQL schema). types/index.ts = catalogue/legacy types
  utils/               format (money/dates/phone), confirm, links, random
supabase/migrations/   0001 core schema · 0002 RLS · 0003 matching, reliability, risk
TEST_REPORT.md         last full test run + list of known defects (read before fixing bugs)
```

### Layering rules

1. **Screens** read with `useDb(selector)` or the `useWorkspace` hooks, and write **only by calling store actions**. Never mutate store state from a screen. Never put business rules (money, status transitions, matching) in a component.
2. **Store actions** (`src/store/db/*.ts`) are the "API". Each action maps to a future server endpoint, so keep them **one action = one use case**. Actions update state immutably (`mapProject`, `mapBooking`) and produce their side effects (notifications, audit log, revenue, payables, calendar) **inside the action**.
3. **Services** are pure, deterministic functions with no React and no store imports. Exceptions: `services/auth.ts` wires stores, and `exporters.ts`/`documents.ts` do I/O and HTML.
4. **Zustand selectors must return stable references.** Select the raw array and filter during render (see `useInbox`/`useThreads`). A selector that returns a fresh array or object re-renders forever.
5. **Imports** use the `@/…` alias (`@/*` → `src/*`, `@/assets/*` → `assets/*`). Keep non-route code out of `src/app/`.
6. **React Compiler is on** (`experiments.reactCompiler`). Don't add manual memoisation that fights it. Obey the rules of hooks: no hooks after an early `return`.

## 4. Domain model and state machines

Everything lives in `DbData` (`src/store/db/types.ts`) and the types in `src/types/platform.ts`.

- **Project** (`WP-xxxx`)
  - contains: events (functions), requirements (per service), bookings (per provider), milestones (customer payments), tasks, timeline, incidents and collaborators;
  - also has: `managedBy` (`platform` | `self`) and a coordinator.
- **Quotation** (`QT-YYYY-NNNN`)
  - is versioned and issued `fromKind` `platform` (package) or `vendor` (direct);
  - carries `versions[]`, the frozen snapshots of every sent version.
- **Lead**: a vendor CRM enquiry from the marketplace. It is separate from projects.
- **Gig**: a freelancer marketplace posting, optionally linked to a booking's crew slot (`projectId`/`bookingId`/`crewId`).
- **Money ledgers are separate and must stay separate:**
  - `payments` are customer → platform, against milestones or registry gifts;
  - `payables` are platform → provider or freelancer;
  - `revenue` is what the platform earns;
  - plus `refunds`, `disputes` and `invoices`.
- **Calendars**: `availability` holds entries (explicit, per owner and date) and `availabilityRules` holds weekly rules.

Status enums. Do not rename or remove values; persisted data and the SQL enums depend on them.

- **ProjectStatus:**
  - main path: `NEW → REVIEWING → NEEDS_CLARIFICATION → MATCHING_PROVIDERS → QUOTE_PREPARED → QUOTE_SENT → CUSTOMER_NEGOTIATING → CONFIRMED → IN_PROGRESS → COMPLETED → CLOSED`;
  - other values: `QUOTE_REJECTED` and `CANCELLED`.
- **RequirementStatus:** `OPEN → MATCHING → SHORTLISTED → QUOTED → CONFIRMED`, or `CANCELLED`.
- **BookingStatus:** `PROPOSED | HELD → CONFIRMED → IN_PROGRESS → COMPLETED`, or `CANCELLED`. `providerResponse` is `pending`/`accepted`/`declined`.
- **AssignmentStatus:** `INVITED, ASSIGNED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, NO_SHOW, CANCELLED, EMERGENCY_REPLACEMENT`.
- **QuoteStatus:** `draft → sent → viewed → accepted`, or `revision` / `declined` / `expired` / `superseded`.
- **MilestoneStatus:** `UPCOMING, DUE (≤ 7 days), OVERDUE, PARTIALLY_PAID, PAID, WAIVED`. Always derive it with `milestoneStatus()`.
- **PayableStatus:** `ACCRUED → READY → PAID`, or `ON_HOLD` / `CANCELLED`.
- **GigStatus:** `open → filled → in_progress → completed`, or `cancelled`.
- **ApplicationStatus:** `invited, applied, shortlisted, hired, confirmed, checked_in, completed, declined, rejected, withdrawn, no_show, cancelled`.
- **DeliverableStatus:** `NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → (REVISION_REQUESTED) → APPROVED / DELIVERED`.
- **Lead status:** `new, contacted, responded, quoted, negotiating, meeting, won, lost, archived`.
- **EventStatus:** `planned → live → done`, or `cancelled`.
- **Verification:** `UNVERIFIED → DOCUMENT_SUBMITTED → UNDER_REVIEW → VERIFIED`, or `REJECTED` / `SUSPENDED`.

Every project status change appends to `statusHistory`. Important actions also call `log()` (the audit trail) and `notify()`.

## 5. The core loop and its invariants (must stay true)

```
Couple onboarding (5 questions) or plan wizard (8 steps) → submitPlan → Project + coordinator auto-assigned + project thread + checklist
  → runMatching per requirement (ranked candidates) → proposeBooking (provider confirms)
  → draftProjectQuote → sendQuote (v1 frozen) → reviseQuote/sendQuote (v2…) → couple accepts vN
  → bookings CONFIRMED → milestones, payables (40/60), revenue, contracts, calendars BOOKED
  → crew assignments / gigs → wedding day: run sheet, GPS check-in, incidents, emergency replacement
  → deliverables → reviews → payouts released → project COMPLETED/CLOSED
```

**Invariants.** The tests assert these; keep them true.

1. **Quote versions are immutable once sent.** `sendQuote` snapshots into `versions[]`. Any later change goes through `reviseQuote`, which creates version N+1. Never overwrite a sent version. The customer can always compare v1/v2/v3.
2. **Quote maths lives only in `quoteTotals()`**:
   - `subtotal − discount (clamped to [0, subtotal]) + serviceFee = taxable`;
   - `tax = round(taxable × 13%)`;
   - `total = taxable + tax`.
   All amounts are whole rupees. Never re-implement it.
3. **Milestones sum exactly to the accepted total.** `buildMilestones()` makes the last step absorb rounding. The default schedule is **30% on confirmation / 50% fifteen days before the event / 20% after completion** (`DEFAULT_SCHEDULE`, which must match `DEFAULT_TERMS`).
4. **Booking split** (`splitBooking`):
   - `agreedPrice = providerPayable + platformFee`;
   - COMMISSION: 10%. Customer 100,000 → provider 90,000.
   - MARKUP: 15%. Provider 70,000 → customer 80,500.
   - LEAD_FEE: a flat NPR 2,000, capped at the price.
   - FREELANCER_MARGIN: 20%.
   Rates come from `settings` (seed defaults).
5. **Provider payables**: two per confirmed booking, **40% before the event** (due event − 7 days) and **60% after the event** (due event + 3 days). They must sum to `providerPayable`. An open dispute with `freeze` puts them `ON_HOLD`; `ON_HOLD`, `CANCELLED` and `PAID` payables can never be released.
6. **Confirming a booking** (`activateBooking`) is idempotent. It:
   - generates the service's deliverables and crew plan;
   - marks the requirement CONFIRMED;
   - adds exactly one pair of payables and one revenue entry per booking;
   - blocks the provider calendar as BOOKED;
   - creates one contract.
7. **Money is NPR integers.** Customer payments and payouts never share a record. Direct vendor bookings are priced **pre-VAT**. The VAT sits on the customer's total and milestones only.
8. **Freelancer margin**: `margin = pay × m/(1−m)` with m = 0.2. Staff (in-house) crew have no margin and don't block the freelancer calendar.
9. **Matching recommends and never awards.** Weights: availability 30, location 15, budget 15, experience 10, rating 10, completion 5, response 5, quality 5, priority 3, repeat 2 (sum = 100).
   - Hard excludes: BOOKED/UNAVAILABLE dates, unverified providers (unless `includeUnverified`), venues that are too small or in another city.
   - Scores stay within 0–100, and each factor stays ≤ its weight.
   - The weights mirror `supabase/migrations/0003`. Change both together.
10. **Emergency replacement** (`startEmergencyReplacement`) does all of these; the first accepted invite is hired as the replacement (`replacesId`):
    - marks the assignment `EMERGENCY_REPLACEMENT`;
    - posts an emergency gig at 1.25× pay, rounded to 500;
    - invites the top-ranked freelancers within 1.5× their travel radius;
    - opens a high-severity incident;
    - books the emergency fee as revenue.
11. **Risk flags** (`projectRisks`) are computed and never stored. Closed, completed, cancelled and rejected projects raise none.
12. **Notifications**:
    - they are addressed to an account id or a whole role (`'platform'`);
    - they are capped at 300, and the audit log at 500;
    - muted kinds arrive already read, **except `emergency`, which always rings**.
13. **Simulated third parties.** These use `setTimeout` and must be cleared on `resetDemo`: unclaimed-listing auto-replies (chat, 2.2 s), auto-quotes for leads (4 s) and provider phone confirmations (3.5 s).
14. **Couples never see provider cost, margin or internal provider signals.** This is enforced by UI mode props and, in SQL, by RLS, column grants and the `quote_items_public`/`service_bookings_customer` views.
15. **The public pages** (`/w/[slug]`, `/rsvp/[code]`) must work signed out. RSVP codes are matched without regard to case.

## 6. How to add or change a feature safely

1. **Find the owner module.** Business rules go in `services/`, state changes in `store/db/<domain>.ts`, and UI in `components/work` (shared) or `app/<role>/`.
2. **Extend, don't mutate:**
   - add optional fields to types (`field?: T`) so persisted data and seed data stay valid;
   - add new actions rather than changing an existing action's signature or meaning;
   - if an existing action must change, update **every** caller. Run `grep -rn "actionName" src`.
3. **New persisted collection:**
   - add it to `DbData` (`store/db/types.ts`) **and** to `buildSeedData()` (the list of persisted keys is derived from the seed);
   - if old persisted data can't be read any more, bump `version` in `store/db/index.ts` and handle it in `migrate`.
4. **New action checklist:**
   - update immutably;
   - write the audit log (`log(currentActor(), 'entity.verb', …)`) for anything that touches money, status or permissions;
   - `notify()` the affected party with an `href` to their role's route;
   - guard invalid input and state yourself: amounts > 0, status preconditions, idempotency. Don't rely on the UI only.
5. **New screen:**
   - add a file under the right role folder and register it in that role's `_layout.tsx` (or the root `_layout.tsx` for couple and public screens) **inside the correct `Stack.Protected` guard**;
   - use the role's kit components and theme (`useRoleTheme()`);
   - make it work at 430 px and at ≥ 960 px (wide layout);
   - handle a missing id or entity with an empty state, never with `return null` or a crash.
6. **Money UI:** always use `formatMoney`/`formatMoneyCompact`/`parseMoney` from `utils/format`. Take totals from `quoteTotals` or `paymentSummary`. Never do arithmetic in JSX.
7. **Dates:** store date-only values as `yyyy-mm-dd` and use `toISODate`/`fromISODate`/`addDays`/`daysUntil`, which are local and timezone-safe. Never use `new Date('yyyy-mm-dd')` directly.
8. **SQL:**
   - mirror model changes in a **new** migration file (`0004_…sql`); never edit applied migrations;
   - keep RLS on every table;
   - make trigger functions that write to RLS-protected tables `security definer set search_path = public`.
9. **Nothing native outside Expo Go.** Install with `npx expo install <pkg>` only, and only modules bundled in Expo Go SDK 57. Otherwise the app stops running in Expo Go; ask the owner first.

## 7. Seed and demo contract (don't break the demo)

`src/data/seed.ts` builds a coherent world, and demo flows depend on specific records:

- `DEMO_ACCOUNTS` ids, phones and roles;
- WP-1021 (the demo couple): quote v1 → v2, payments, guests, seating, website slug `aakriti-weds-sujan`;
- WP-1017: live today, with the emergency replacement;
- the other seeded projects cover every status;
- the Everest Grand Party Palace venue and Wedding Story Nepal studio listings.

Seed dates are **relative to today** (`day(n)`/`at(n)`); keep them relative.

- Keep ids and slugs stable.
- New seed data must be internally consistent: bookings satisfy `agreedPrice = payable + fee`, and milestones sum to the accepted quote total.
- Platform → More → **Reset demo data** (`resetDemo`) must always restore a working seed.

## 8. Code conventions

- TypeScript strict. No `any` in new code; use the domain types from `types/platform.ts`.
- Match the surrounding style: small typed helpers, JSDoc one-liners on exported functions, and no comment noise.
- Ids come from `uid(prefix)`; human codes from `shortCode()`, `nextQuoteNumber()` and `nextNumber()`.
- Copy is Nepal-first and friendly ("Namaste", "Dhanyabad"). Use the existing tone.
- On web, avoid nesting pressables (`Card onPress` containing buttons). It produces `<button>` inside `<button>`. Make the tappable area and the buttons siblings inside a plain `Card`.

### Visual design

One design system for all four apps; only the accent colour changes per role (`src/theme/roles.ts`).

- **Type.** Mukta for all UI text, Martel (`<Text serif>`) for a few display lines only: couple names, onboarding and welcome headlines, big numbers like the countdown. Both are Ek Type faces with Devanagari, so Nepali text sets in the same voice. Don't add other font families.
- **Colour.** Warm neutrals, white surfaces and dark ink do most of the work. The accent marks primary actions and the one thing that needs attention. Status colours come from `statusTone()`. No gradients except dark scrims over photos; no glows, no coloured shadows.
- **Shape.** Cards 10 px radius with a 1 px border and no shadow; buttons 8 px; chips and pills 4–6 px. Shadows only on things that float (sheets, toasts, the floating filter bar).
- **Copy.** Sentence case everywhere, including labels, tabs and buttons. No all-caps eyebrows, no letter-spaced labels, no emoji in UI chrome or notifications, no "AI"/"magic"/sparkle language: the assistant is a rule-based help bot and is called "Quick help".
- **Stats.** Label above, number below, in ink. Colour a number only when it flags a problem (overdue, risk).
- Keep `README.md` (the product overview) and this file current when behaviour changes.

## 9. Definition of done: run these before saying the work is finished

```bash
npx tsc --noEmit        # must be 0 errors (typed routes are generated by `npx expo start`)
npx expo lint           # must be 0 errors / 0 warnings
npx expo-doctor         # no new failures
npx expo start          # app loads in Expo Go; press w for web
```

Then smoke-test manually (or by script) every role you touched:

1. Sign in with the demo account for each role (OTP `1234`).
2. Open the screens you changed, on phone width and on desktop width for the vendor and platform apps.
3. Run the affected end-to-end flow from §5. For money changes, check that the totals still reconcile:
   - quote total = Σ milestones;
   - booking price = payable + fee;
   - payables sum to the provider payable.
4. Reset demo data and check the demo still works.

Never:

- delete or rename routes, store actions, persisted keys, status values or seed ids that other code or users depend on;
- disable lint rules or type checks to get green;
- merge to `main` or force-push. Work on a feature branch and let the owner review.

### Git workflow: push every branch, open a PR for every finished task

The owner wants every piece of work on GitHub and reviewable as a pull request. This is standing permission to commit, push and open PRs without asking each time.

1. **Branch.** Never commit to `main`. Start each task on a new branch (`feature/<short-name>` or `fix/<short-name>`) from the latest `origin/main`, or from the branch the task builds on.
2. **Push new branches immediately.** Right after creating a branch, run `git push -u origin <branch>` so it exists on GitHub from the start.
3. **When a task is complete** and the §9 checks pass:
   - stage only the files this task changed (`git add <paths>`; never `git add -A`, because several sessions share one working tree);
   - commit with a clear message: a short imperative subject, then what changed and why;
   - `git push`;
   - open a pull request into `main`. If the branch was cut from another unmerged feature branch, target that branch so the diff shows only this task. If a PR for the branch already exists, the push updates it; don't open a duplicate.
4. **PR description:** what changed and why, how it was tested (tsc, lint, the flows you smoke-tested), and anything the reviewer should look at. Mark it as a draft and list the failures if a check could not be made to pass.
5. **Opening the PR.** This machine has no `gh` CLI. Use the GitHub REST API (`POST /repos/amritgyawali/weddingmarketplace/pulls`) with the token from `git credential fill`. Never print, log or commit the token.
6. **Never** merge a PR, push to `main`, force-push, or rewrite pushed history. The owner reviews and merges.

## 10. Known defects (from `TEST_REPORT.md`, 29 Sep 2026)

Fix these deliberately, with tests. Don't paper over them, and don't "fix" them as a side effect of an unrelated change.

- **SQL, high:**
  - `log_project_status()` and `block_calendar_for_assignment()` are not `security definer`. Under RLS, clients can't create projects, change status or let vendors assign freelancers.
- **SQL, medium:**
  - RLS lets couples update any column of their project and quote;
  - collaborator permission (VIEWER) is not enforced;
  - the quote freeze can be bypassed (un-send, delete, unfrozen VAT, notes and valid-until);
  - there is no cap on refunds.
- **App, medium:**
  - repeat refund requests can refund a payment twice;
  - `cancelBooking` doesn't reverse revenue or adjust milestones;
  - accommodation and security estimates and budgets use the guest count (`estimateFor`, `perUnitBudget`);
  - freelancers can be double-booked on-device;
  - the project code `WP-${1000 + projects.length + 31}` can collide with seeded codes.
- **App, low:**
  - seed data for WP-1051 disagrees (quote, milestones and booking);
  - the quote preview hides send errors;
  - store actions trust the UI for validation (overpay, RSVP headcount, negative gifts, duplicate slugs).

When you fix one, remove it from this list and from `TEST_REPORT.md`.

---

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved or removed. Before writing any code that touches an Expo, EAS or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently **57**).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else, fetch https://docs.expo.dev/llms.txt. It is an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

### Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

### Navigation and routing

- Use **Expo Router** for all navigation. Routes live in `src/app/`: every file there is a screen, and `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router` and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

### Building with EAS

Use EAS to build, sign and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`). No local Xcode or Android Studio is required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.

Docs: https://docs.expo.dev/eas/index.md

### Native rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand. Configure native behaviour in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build (`npx expo run:ios|android` locally, or `eas build --profile development`). **This project must stay Expo Go compatible**, so don't add such libraries without the owner's approval.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
