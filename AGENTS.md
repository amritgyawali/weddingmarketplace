# AGENTS.md: rules for any AI working on Vivah

Every AI coding agent must read this file before changing anything in this repo. That includes Claude Code, Codex, Cursor, Copilot and Gemini. `CLAUDE.md` imports it.

It is the single source of truth for the product strategy, the architecture, the business logic and the rules that keep existing features working. If your change alters something described here, update this file in the same change.

**Documentation.** This file is the short, binding version. The long form lives in `docs/handbook/` (one guide per area, with every rule numbered and explained in `00-rules-and-regulations.md`; start at `docs/handbook/README.md`), and the generated code reference in `docs/reference/` (every route, store action, export and migration; `index.json` is the same as data). `llms.txt` maps all of it. Keep docs true in the same change: JSDoc on every new export, the matching handbook guide, then `npm run docs:generate`. Never edit `docs/reference/` by hand. A weekly documentation pass is described in `docs/handbook/17-documentation-maintenance.md`. If the handbook and this file disagree, this file wins; fix the handbook.

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
| Currency and tax | NPR, formatted `NPR 150,000` via `formatMoney` (`NPR 45K` via `formatMoneyCompact`, "7.5 lakh" via `formatLakh`). **13% VAT** (`VAT_RATE`/`TAX_RATE`). Never use ₹, INR or GST. |
| Places | Kathmandu valley (Kathmandu, Lalitpur, Bhaktapur, Kirtipur), Pokhara, Chitwan and other Nepal cities in `src/data/cities.ts`. |
| Ceremonies | Nepali functions (Wedding, Reception, Mehendi, Haldi, Pasni, Bratabandha…), with Bikram Sambat months (Mangsir/Magh/Falgun/Baisakh are peak season). |
| Payments | eSewa, Khalti, Fonepay QR, ConnectIPS, IME Pay, card, bank transfer, and cash (recorded by staff only). |
| Backend | **An on-device mock backend** (zustand `useDb`, persisted to AsyncStorage) plus a **full Postgres/Supabase SQL schema** in `supabase/migrations/`, with the core loop as RPCs (0011). `src/backend/` puts one interface in front of both (`backend()`, picked by `EXPO_PUBLIC_BACKEND`, default `mock`). The SQL is **not deployed**. Never apply it to a Supabase project without asking the owner; check it locally with `npm run db:check` / `db:test` / `test:parity` (an in-process Postgres, nothing leaves the machine). |
| Runtime | **Everything must keep running in Expo Go (SDK 57).** Do not add libraries with custom native code; see §10. |
| Admin console | The same Expo app, under the Platform role, is web-ready. Screens must also work as a wide dashboard via `npx expo start --web`. `useLayout()` switches to the sidebar layout at ≥ 960 px. There is no separate web project. |
| Demo-ability | Every role has a one-tap demo account, and the seed tells a coherent story. Keep it working; see §7. |

## 2. The four role apps (one binary)

| Role (`UserRole`) | App | Routes | Theme |
|---|---|---|---|
| `customer`, the couple | Marketplace + **My Wedding** planning tools | `src/app/(tabs)/…` and root screens (`my-wedding`, `plan`, `guests`, `seating`, `budget`, `website`, `invitations`, `registry`, `boards`, `compare`, `deals`, `contracts`, `calendar`, `checklist`, `quote/[id]` …) | burgundy |
| `vendor`: venues and businesses | Vivah for Business: leads CRM, quote builder, bookings, crew, calendar, packages, portfolio, finance, analytics, promotions, reviews, team, verification, plus trade tools picked by the business's services (§6a) | `src/app/business/…` | burgundy |
| `freelancer`: photographers, makeup artists, crew | Gig marketplace: gigs, invites, emergency gigs, assignments, GPS check-in/out, calendar and weekly rules, earnings, profile | `src/app/freelancer/…` | burgundy |
| `platform`: staff (coordinator, admin, support, finance) | Operations console: today view, leads kanban, 12-tab project console, matching, quote builder, control room, emergency replacement, approvals, finance, users, providers, freelancers, analytics, marketplace, audit | `src/app/platform/…` | wine |

Public pages need no sign-in: `/w/[slug]` (the couple's wedding website and registry) and `/rsvp/[code]` (the guest RSVP).

**Role toolkits.** Each role also has 20 smaller tools on top of the core loop, listed by a searchable hub and opened through one dynamic route per role:

| Role | Hub → tool route | Entry point | Registry |
|---|---|---|---|
| Couple | `/tools` → `/tool/[id]` | Profile menu → Planning tools | `components/toolkit/couple` |
| Vendor | `/business/tools` → `/business/tool/[id]` | Business tab → Business tools | `components/toolkit/vendor` |
| Freelancer | `/freelancer/tools` → `/freelancer/tool/[id]` | Profile tab → Freelancer tools | `components/toolkit/freelancer` |
| Platform | `/platform/tools` → `/platform/tool/[id]` | More → Operations tools | `components/toolkit/platform` |

- Tools store data in two generic collections, `toolEntries` (records) and `toolState` (per-owner settings keyed `${ownerId}:${tool}`), plus `broadcasts`. Never add a persisted key for a new tool; give it a registry id (`role.name`) and use these.
- Owner: the couple's project id (so collaborators share it), the vendor or freelancer account id, or `'platform'` for the ops team (`useToolOwner()`).
- Actions (`store/db/toolkit.ts`): `addToolEntry`, `updateToolEntry`, `removeToolEntry`, `toggleToolEntry`, `ensureToolPreset` (starter items added once per owner, never re-added after the owner edits the list), `setToolState`, `sendBroadcast` (notifies a whole role, audited). They clamp money and quantities to non-negative integers and drop malformed dates. Platform tools and the money tools of vendors/freelancers are written to the audit log.
- Calculators live in `services/toolkit.ts` (sait dates, climate, Nepal income-tax slabs, VAT position, price suggestions, hall capacity, freelancer quotes, janti vehicles, cash-flow buckets). Tax figures are labelled estimates.
- Most record-shaped tools are a config for `EntryList` (`components/toolkit/core.tsx`); computed tools read the existing store and never write to core entities, except the platform's "Assign all" (`assignCoordinator`) and "Release batch" (`releasePayable`, behind a confirm), which reuse existing guarded actions.

**Routing.** Routing is **Expo Router**, with a `Stack.Protected` guard per role in `src/app/_layout.tsx`. A role must never be able to reach another role's app. Signed out, users go to `welcome/`. A couple that hasn't onboarded goes to `onboarding/` ("What are we celebrating?", then five questions shaped by the occasion: who, date, city, guests, budget, then a review card; a wedding asks exactly the questions it always did). "Build our plan" there calls `submitPlan` with the occasion, its functions and default services (for a wedding: Wedding + Reception, the six core services); "Just browse" only saves the answers to `useAppStore` (`guests`, `budget`), which prefill the full 8-step plan wizard later.

**Demo sign-in.** Use any `98XXXXXXXX` number with OTP **1234**, or tap "Continue as …" on each login screen (one button per demo account of that role). New platform staff need the access code `VIVAH2026`. Supabase builds (`EXPO_PUBLIC_BACKEND=supabase`) sign in by email code instead and have no demo buttons; see `docs/SETUP_SUPABASE.md`.

| Demo account | Phone | What it shows |
|---|---|---|
| Aakriti Shrestha, couple | 9800000001 | Owns WP-1021 |
| Rajesh Pradhan, vendor (Everest Grand Party Palace) | 9800000002 | Venue business |
| Raj Maharjan, freelancer | 9800000003 | Photographer |
| Sita Karki, platform coordinator | 9800000004 | Coordination console |
| Anil Gurung, vendor (Wedding Story Nepal) | 9800000005 | Photo studio |
| Bikram Adhikari, platform super admin | 9800000006 | Admin console, occasion catalogue |
| Sunita Maharjan, vendor (Phoolbari Decor, Lalitpur) | 9800000007 | Decor studio: themes, rentals, setup sheets, setup checklist |
| Suman Tamang, freelancer (DJ Suman) | 9800000008 | DJ and MC: music craft profile, sound gear, setlist, DJ-only gig feed |
| Nisha Rai, platform finance | 9800000010 | Finance console: payouts, refunds, disputes, audit; no leads or approvals |
| Prakash Thapa, platform support (Vendor Success) | 9800000011 | Verification queue, recruitment, provider scorecards |
| Sarita Duwal, couple (newborn family, Bhaktapur) | 9800000009 | Owns WP-1040, Aarohi’s pasni: newborn occasion, filtered marketplace and tools, gift log, keepsakes |

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
    toolkit/           role toolkits: core.tsx (EntryList, ToolPage, hooks), hub.tsx (ToolHub/ToolRoute), couple/ vendor/ freelancer/ platform/
    persona/           <Gate> (render by capability, permission or occasion)
    planner/ home/ listing/ detail/ genie/ ideas/ navigation/ onboarding/ wedding/
  store/
    useDb.ts           re-export of store/db — THE shared backend (all 4 roles)
    db/                backend split by domain: core, quotes, projects, finance, gigs, chat, trust, planner, toolkit, personas
                       + helpers.ts (now/today, currentActor, mapProject, mapBooking, nextNumber…) + types.ts (DbData)
    useSession.ts      accounts + session (mock auth). useAccount()/useCurrentAccount()
    useAppStore.ts     per-device couple marketplace state (onboarding, city, shortlist, likes, legacy bookings/chats)
  services/            pure business logic (no React): matching, pricing, quotes, planner, risk,
                       documents (printable HTML), exporters (ICS/CSV/PDF/share), api (catalogue reads),
                       assistant (rule-based), auth (completeLogin/onAccountCreated/logout),
                       experience (the persona resolver, §6a)
  data/                Nepal catalogue (cities, services, events/ceremonies, venues, vendors, providers,
                       freelancers, ideas, genie) + seed.ts (demo accounts and the whole demo world)
                       + personas: capabilities, trades, occasions, permissions, access (visibility rules)
  hooks/               useWorkspace (role-scoped selectors), useExperience (resolved persona), useLayout (wide ≥ 960 px),
                       queries (React Query), useHydrated…
  theme/ constants/    role themes/fonts, colours, images, brand
  types/platform.ts    the domain model (mirrors the SQL schema). types/persona.ts = When/Experience. types/index.ts = catalogue/legacy types
  utils/               format (money/dates/phone), confirm, links, random
supabase/migrations/   0001 core schema · 0002 RLS · 0003 matching, reliability, risk · 0004 toolkits · 0005 personas · 0006 freelancer crafts · 0007–0008 customer occasions · 0009 platform RBAC · 0010 SQL defect fixes · 0011 core-loop RPCs · 0012 auth, media, notifications · 0013 scheduled jobs · 0014 gateway payments · 0015 launch (health, consent, export, account deletion) · 0016 super admin console and vehicles trade
supabase/functions/    Edge Functions (Deno, no dependencies): send-otp, media-sign, notify-fanout, payment-initiate, payment-verify, health, account-delete; pure logic in _shared/ (tested in Node by npm run test:functions)
docs/SETUP_SUPABASE.md putting the app on a Supabase staging project, step by step
docs/LAUNCH.md         going live (P8): production project, GitHub environments, backups and restore rehearsal, Cloudflare Pages, monitoring, Play Store
scripts/ops/           backup row counts (dump-counts.awk) and the restore check (verify-restore.sh) used by the backup workflows
.github/workflows/     ci (every PR), keep-alive (daily), backup (nightly), restore-rehearsal (quarterly), deploy-web (main → Cloudflare Pages)
src/backend/           Backend interface for the core loop: mock (the store) and supabase (the RPCs), chosen by EXPO_PUBLIC_BACKEND
scripts/               check-personas.mjs + personaCheck.ts (registry check and persona matrix, §6a); ts-loader.mjs (Node imports of pure app modules)
scripts/db/            PGlite harness: db-check (migrations apply, RLS everywhere), core-loop (the loop as each role, RLS on), parity (app money = SQL money)
docs/MASTER_PLAN.md    persona-driven experience and the zero-cost production stack (phases P0–P8)
docs/handbook/         the developer and AI handbook: rules (00), one guide per area, glossary, troubleshooting, decision log
docs/reference/        GENERATED code reference (npm run docs:generate, scripts/docs/generate-reference.mjs); never edit by hand
llms.txt               map of the docs for AI tools
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
   - mirror model changes in a **new** migration file (`0006_…sql`); never edit applied migrations;
   - keep RLS on every table;
   - make trigger functions that write to RLS-protected tables `security definer set search_path = public`.
9. **Nothing native outside Expo Go.** Install with `npx expo install <pkg>` only, and only modules bundled in Expo Go SDK 57. Otherwise the app stops running in Expo Go; ask the owner first.

## 6a. Personas: identify first, show only what fits

Every user gets one level of identity inside their role (master plan §2–§3):

| Role | Identity | Where it lives |
|---|---|---|
| customer | the **occasion** of the active project (wedding, engagement, anniversary, baby shower, newborn, bratabandha, birthday, corporate, something else, plus any a super admin adds) | `Project.occasion`, `DbData.occasions` (seeded from `data/occasions.ts`) |
| vendor | **services** (a primary plus any add-ons, across trades) and a **business form** (`venue`, `studio`, `shop`, `solo`) | `Account.services`, `primaryService`, `businessForm`, `tradeProfile` |
| freelancer | **skills** (crew roles) with a `primarySkill`; the **craft** (`data/crafts.ts`) comes from the primary skill, the trade and capabilities through `SERVICES_BY_CREW_ROLE` | `Account.skills`, `primarySkill`, `tradeProfile` (craft profile answers) |
| platform | **staff role** and team → permissions | `data/permissions.ts` (`STAFF_PERMISSIONS`, `TEAM_PERMISSIONS`) |

Rules:

1. **Taxonomy → capabilities → surfaces.** Services grant capabilities (`SERVICE_CAPABILITIES` in `data/trades.ts`), occasions grant planner modules (`plan.<module>`), staff roles grant permissions. Screens never ask "is this a photographer?"; they ask `has(exp, 'media.camera')`, `can(exp, 'payout.release')` or use `<Gate cap=… perm=… occasion=…>`.
2. **One resolver.** `services/experience.ts` is pure. `experienceFor(account, { project, occasions })` and the `useExperience()` hook return the **same object for the same persona** (module-level cache keyed by the input), so it is safe in render and selectors.
3. **Infer, don't migrate.** Missing persona fields are inferred: services from the listing or `categoryId`, the form as `venue` for venues and `studio` otherwise (keeps every tool), the occasion from `project.eventType`, else `wedding`. `Experience.inferred` is true until the user confirms.
4. **Visibility rules are data.** Every tool has a rule in `TOOL_RULES` (`data/access.ts`); `ToolDef.id` is typed `ToolId`, so a tool without a rule does not compile. `{}` means universal on purpose. Other persona-aware surfaces (sidebar links, home widgets, setup steps) also declare `When` rules there.
5. **Hide, don't disable, and never dead-end.** A deep link to a hidden tool shows an empty state that explains why and how to add the service.
6. **Server-enforced.** Store actions check permissions themselves (`actorCan()` in `store/db/personas.ts`); SQL mirrors it with `has_permission()`/`has_capability()` in `0005_personas.sql`.
7. **Occasions are editable data.** Only `occasion.manage` (super admin) may add, edit or delete them (`addOccasion`/`updateOccasion`/`removeOccasion`, audited). `wedding` and `other` are fallbacks and can't be deleted or switched off; an occasion used by a project can't be deleted (switch it off instead).
8. **Vendors (P1, live).** Sign-up asks the trade first (12 tiles), then the main service and add-ons from any trade, the business form and two or three trade essentials, then name, city, listing claim and PAN. Business → **Your services** (`/business/services`, `setProviderPersona`) edits the same later and records `personaConfirmedAt`. The business app then shows:
   - tools filtered by `TOOL_RULES` through `useVisibleTools()` (tools the vendor already has records in stay visible); a deep link to a hidden tool explains which services unlock it;
   - 13 trade tools in `components/toolkit/vendor/trades.tsx` (menu, tastings, themes, rentals, setup sheets, gallery delivery, couples' shot lists, trials and looks, song requests, power planner, fleet, fittings, muhurta), listed under a trade heading in the wide sidebar;
   - "Hire crew" and "Team" only for venue and team businesses (`VENDOR_LINK_RULES`); "Site visits" renamed per trade (Tastings, Design meetings, Fittings…);
   - a setup checklist on the home built from the trade (`VENDOR_SETUP_STEPS`), hidden when done;
   - package editor limited to the vendor's services, with crew and delivery fields only where they apply.
9. **Freelancers (P2, live).** Sign-up asks the craft first (10 tiles: photo and film, editing, makeup and mehendi, music and hosting, decor, kitchen and service, driving, sound and AV, rituals, event crew), then the main skill and extra skills (the craft and its neighbours first, other crafts on request), then the craft profile, then rate, bio and travel. Profile → **Your craft** (`/freelancer/craft`, `setFreelancerPersona`) edits the same later. Then:
   - the craft decides the rate model (`Experience.rateModel`: day, event or per project) and the equipment kinds asked about (`Experience.equipmentKinds`); crafts without equipment (kitchen, event crew, rituals) get no equipment section, so a DJ never sees camera fields;
   - tools are filtered by `TOOL_RULES` through `useVisibleTools()`, plus three craft tools in `components/toolkit/freelancer/crafts.tsx`: product kit and hygiene log (makeup, mehendi), setlist (DJ, musician, MC), vehicle log (drivers); the gear checklist starts from a packing list for the craft;
   - the gig feed is **strict**: only gigs for a skill on the profile (invitations and emergencies addressed to them still show). `applyToGig` refuses a role the freelancer doesn't have unless they were invited, and `0006_freelancer_crafts.sql` mirrors that with a trigger.
10. **Customers (P3, live).** Onboarding and Profile → **Plan another celebration** (`/celebrate`) ask the occasion first (the active list in `DbData.occasions`), then questions for it: the couple for weddings and engagements, whose anniversary and which year, the parents-to-be, the baby and nwaran or pasni (suggested by age), whose bratabandha or birthday, the organisation, or a name for anything else. `submitPlan` takes `occasion`, `honourees` and `title` (all optional; missing means inferred from the main function). Then:
   - a couple can hold several celebrations; `useAppStore.activeProjectId` picks the one the planner works on, and `useCustomerWorkspace()` returns it. The switcher (`CelebrationSwitcher`) sits at the top of the plan page;
   - planning tools are filtered by the occasion's modules through `useVisibleTools()`, plus three occasion tools in `components/toolkit/couple/occasions.tsx` (baby keepsakes, surprise plan, games and activities); plan shortcuts, Profile items and the hero's website button follow the same modules ("Event page" outside weddings);
   - the marketplace shows **only the occasion's services** (`categoriesFor`, `homeCategoriesFor` in `data/categories.ts`); the rest are hidden, not ranked lower. Search still finds everything;
   - `NWARAN` is a function (event type); the built-in newborn occasion offers it with the pasni. The DB store `migrate` (v4) adds it to older installs, with the newborn demo project.
11. **Platform staff (P4, live).** The permission matrix in `data/permissions.ts` (staff role + team) decides the console:
   - tabs, sidebar links, More rows and screens follow `PLATFORM_ROUTE_RULES` (`data/access.ts`); finance gets no leads kanban, support no payouts. A deep link to a screen outside the role shows `NoAccess` (screens are wrapped with `staffScreen()` from `components/persona/StaffGate.tsx`);
   - store actions refuse on their own: `staffOnly(perm)` for staff-only actions (payouts, holds, refunds, waivers, verification, suspension, broadcasts, cash payments) and `staffDenied(perm, project?)` for actions others also use (project status, coordinator assignment, platform quotes, bookings, emergency replacement, settings, demo reset). A coordinator's `project.manage` and `quote.send` apply to their own or unowned projects only (`PERMISSION_SCOPE`). Guarded actions return an error string (or null); screens toast it;
   - Today opens with a focus panel per job (`TodayFocus`, picked by `TODAY_FOCUS`): coordinator, support, Vendor Success, finance or admin. Business numbers show to finance and admins only;
   - weddings, leads, providers and freelancers lists have an occasion × trade × city segment filter (`services/segments.ts`, `SegmentFilter`);
   - operations tools are filtered by permission; **Reset demo data** is for admins and super admins (`demo.reset`): sign in as Bikram (9800000006) to reset;
   - `0009_platform_rbac.sql` swaps the role-name RLS checks for `has_permission()` and adds `can_manage_project()`.
12. **Backend (P5).** Money rules have two implementations that must agree: `src/services` (whole rupees, `roundMoney()` so binary floats don't drift) and the SQL helpers in 0011 (paisa, `vivah_rupees()`). Change both together and run `npm run test:parity`. New server-side use cases are RPCs (`rpc_*`, security definer, permission-checked, audited) listed in the header of 0011, with a check in `scripts/db/core-loop.mjs`; the internal `vivah_*` helpers stay closed to clients.
13. **Auth, media, notifications (P6).** With `EXPO_PUBLIC_BACKEND=supabase` every role signs in with a 6-digit **email** code (owner decision: no SMS in year one) through `src/backend/auth.ts` → `send-otp` (Upstash rate limits) → Supabase Auth; tokens live in SecureStore (localStorage on web) and refresh themselves. First sign-in goes to the same setup screens, which call `rpc_complete_signup`; staff also need the access code an admin set (`rpc_set_staff_access_code`, stored hashed) and wait for approval (`rpc_decide_staff_request`). The device keeps a mirror `Account` with the auth user's id (`accountFromMe`, `upsertAccount`) so the role apps work unchanged. The demo (`mock`) keeps phone + 1234 and the one-tap accounts.
   - **Media:** portfolio uploads go to Cloudinary through `media-sign` (signature pins `vivah/<purpose>/<user id>` and the preset) and are recorded with `rpc_register_media`; Postgres stores the public id only. Show images through `cloudinaryUrl(publicId, 't_card')` and the named transformations (`scripts/cloudinary-setup.mjs`); never ad-hoc transformations.
   - **Private files:** KYC, contracts and invoices go to the private `documents` bucket under `<user id>/…` (`src/backend/files.ts`), read through five-minute signed links.
   - **Notifications:** a new `notifications` row calls `notify-fanout` (pg_net + Vault), which sends Expo push and Resend email by the user's preferences; muted kinds send nothing, `emergency` always rings. Remote push needs a development or store build (`src/backend/push.ts` skips Expo Go).
   - **Jobs:** `0013_jobs.sql` (milestone status, payable readiness, lead SLA, payment reminders, cleanup), scheduled by pg_cron.
13a. **Gateway payments (P7).** Khalti and eSewa money is recorded **only** by `payment-verify` after the gateway's own lookup (Khalti `/epayment/lookup`, eSewa status API), never from a redirect's query or the app. `payment-initiate` calls `rpc_begin_payment` as the couple, which works out the amount from the milestone and makes a `payment_intents` row; `rpc_settle_payment` (service role only) locks the intent, so duplicate callbacks, refreshes and "check again" record one payment. Money a milestone can no longer take becomes `REFUND_DUE` and finance is told. In the app, `src/backend/payments.ts` opens the gateway and `/pay/result` checks the attempt again on return; the demo (`mock`) keeps its simulated gateways in `PaymentSheet`. Tests: `scripts/db/payments.mjs` (in `npm run db:test`) and the payment checks in `npm run test:functions`. Setup: `docs/SETUP_SUPABASE.md` §6.
13b. **Launch (P8).** Runbook: `docs/LAUNCH.md`.
   - **Legal pages** `/legal/[doc]` (terms, privacy, refunds, delete-account) are public and read `src/data/legal.ts`; the Play listing and the gateways link to them. The text must describe what the app really does: when behaviour it mentions changes (data collected, processors, retention, deletion, refunds), update the text and bump `LEGAL_VERSION`. The login screen says continuing accepts them; Supabase builds record it with `rpc_accept_legal` (`rpc_me.legal` is the last accepted version).
   - **Your data:** Settings → Download my data adds `rpc_export_my_data` on Supabase builds; Delete my account calls the `account-delete` Edge Function, which runs `rpc_delete_my_account` as the user (refused while a confirmed celebration, open booking, refund or payout remains, or for the last super admin), removes `<user id>/…` from the documents bucket and soft-deletes the auth user. Profiles are anonymised, never hard-deleted: bookings, payments and contracts point at them. The demo keeps deleting the on-device account.
   - **Telemetry:** `src/backend/telemetry.ts` sends PostHog events and `$exception`s and Sentry envelopes over HTTP (no SDKs, so Expo Go still works); payloads are built in `telemetryPayloads.ts` (tested by `npm run test:telemetry`). Only route patterns and the account id with persona fields leave the device, never names, emails, phones, ids in paths or RSVP codes. `prefs.analytics === false` stops analytics, not error reports. The root layout's `ErrorBoundary` is `AppErrorBoundary`.
   - **Ops:** `rpc_health` + the `health` function (Better Stack), `keep-alive.yml`, `backup.yml` (age-encrypted dumps to R2), `restore-rehearsal.yml`, `deploy-web.yml` (Cloudflare Pages; `public/_headers`, `robots.txt`, `sitemap.xml` ship with the build). Each skips with a notice until its GitHub environment secrets exist.
14. **Registry check.** `npm run check:personas` fails on unknown capabilities, permissions, occasions or services, a service without capabilities or trade, a crew role in no craft or in two, or a fixture persona with fewer than three tools, and compares every fixture's visible tools (and, for staff, console routes) with `scripts/persona-matrix.json`. After an intended change run `npm run check:personas -- --update` and commit the new matrix.

## 6b. Language, calendar, feedback and the super admin console

1. **English and Nepali.** Screens keep writing English. `Text` translates its string children through `src/i18n/runtime.ts` (`NE` dictionary in `src/i18n/ne/index.ts`): an exact entry, else a template entry such as `"{0} days to go"` (placeholders match any text and are translated in turn; an English plural `s` becomes nothing). Fields, `SearchBar`, toasts and the confirm dialog translate too; for a raw `TextInput` placeholder use `tr()`. Use `<Text raw>` for names, codes and user-written text. **When you add UI text, add its Nepali line to the dictionary.** The device language and calendar live in `usePrefs` (`src/i18n/index.tsx`); `LanguageSwitch` sits on the welcome screen, Profile and Settings.
2. **Bikram Sambat by default.** Dates are still stored as AD `yyyy-mm-dd`. `src/utils/bs.ts` converts with the official month table (BS 2000–2090). `formatShortDate`/`formatLongDate`/`formatMonthDay` show BS unless the user picked AD; `formatDateAlt` gives the other calendar for a second line; `formatAdDate` is always AD. Every month grid (`Calendar`, `MonthGrid`, `AvailabilityCalendar`) lays out Nepali months with the AD day in small type.
3. **Keyboard.** Every navigator passes `screenLayout={keyboardScreenLayout}`, which wraps each screen in `KeyboardLift` (pads by exactly the part the keyboard covers, animated; Android draws edge to edge so the window no longer resizes). `Sheet` lifts itself (`isolated`). Screens import `KeyboardAwareScrollView as ScrollView` from `components/ui/Keyboard` (taps work while the keyboard is open, the focused field scrolls into view). Don't add `KeyboardAvoidingView`.
4. **Taps and feedback.** `PressableScale` is a plain `Pressable` (an animated style on press-in made Android drop taps) with a 350 ms double-tap guard. `installActionToasts()` (root layout) wraps the store actions once: after a screen calls an action, a toast says what happened ("Guest added") unless the screen showed its own; an action that returns an error string shows it in red. Timers that call actions use `quietly()` (`store/quiet.ts`); internal actions are listed in `SILENT`. Confirmations use the app's `Dialog` through `utils/confirm`. Loading states use `Loader`/`LoadingState`.
5. **Stores persist lazily.** `useDb` saves through `store/lazyStorage.ts` (400 ms after the last change, at once when the app backgrounds). Never `setState` a persisted store at module load: it would save the initial state over the user's data before rehydration.
6. **Celebrations other than weddings** get their own checklist (`generateTasks(..., occasion)`, `CELEBRATION_TEMPLATES` + `OCCASION_TASKS`), a home without wedding-only sections (collections, bridal makeup, real weddings, planner packages) and a tab bar without Ideas and Planner. The DB `migrate` v5 drops the old wedding-only TODO tasks from such plans.
7. **Super admin console** (`/platform/admin/*`, permission `admin.full`, super admins only): all accounts of every role (edit, create, delete, "Sign in as" with a bar to come back: `impersonate`/`endImpersonation`), every `DbData` collection as editable records (`adminSaveRecord`/`adminInsertRecord`/`adminDeleteRecords`), feature switches (`DbData.featureFlags`, catalogue in `data/features.ts`, plus `tool:<ToolId>` and `service:<id>`; read with `useFeatures()`), text overrides in either language (`DbData.textOverrides`) and announcements (`DbData.announcements`, shown by `AnnouncementBanner`). Store actions live in `store/db/admin.ts`, check `admin.full` themselves and are audited. SQL mirror: `0016_super_admin_vehicles.sql`.
8. **Vehicles trade.** Service group `vehicles` with `wedding-car`, `luxury-car`, `bus-hire`, `jeep-hire`, `baggi` (crew role Driver); trade `vehicles` in `data/trades.ts`.
9. **Shake to report a bug.** Shaking the phone (Alt+Shift+B on the web, or Settings → Help → Report a problem) screenshots the screen as it is and opens a sheet for a description (`components/ui/BugReporter.tsx`, `backend/bugReport.ts`, `hooks/useShake.ts`). The report goes to the bug inbox (`scripts/bug-inbox.cjs`, mounted on the dev server by `metro.config.js`, or `npm run bugs:inbox` with `EXPO_PUBLIC_BUG_INBOX_URL`) and lands in `bug-reports/<date>_<slug>/` with `README.md`, `screenshot.png` and `report.json`, listed in `bug-reports/INDEX.md`. Only builds with an inbox show it; super admin switch `app.bug_report`. **When asked to fix reported bugs, start at `bug-reports/INDEX.md`.** Git ignores the reports.

## 7. Seed and demo contract (don't break the demo)

`src/data/seed.ts` builds a coherent world, and demo flows depend on specific records:

- `DEMO_ACCOUNTS` ids, phones and roles;
- WP-1021 (the demo couple): quote v1 → v2, payments, guests, seating, website slug `aakriti-weds-sujan`;
- WP-1017: live today, with the emergency replacement;
- the other seeded projects cover every status;
- the Everest Grand Party Palace venue and Wedding Story Nepal studio listings;
- the demo accounts' persona fields (Everest: venue + catering, form venue; Wedding Story: five photo and film services, form studio; Phoolbari Decor: decoration + florist + lighting, form studio, with the `phoolbari-decor-lalitpur` listing; Raj: primary skill Photographer with a photo craft profile; DJ Suman: DJ + MC with sound gear and a setlist; Bikram: `super_admin`). `syncDemoAccounts()` in `useSession.ts` copies them onto older installs through the session `migrate`; bump the session `version` when you add a demo account or persona field.

Seed dates are **relative to today** (`day(n)`/`at(n)`); keep them relative.

- Keep ids and slugs stable.
- New seed data must be internally consistent: bookings satisfy `agreedPrice = payable + fee`, and milestones sum to the accepted quote total.
- Platform → More → **Reset demo data** (`resetDemo`, admins and super admins) must always restore a working seed.

## 8. Code conventions

- TypeScript strict. No `any` in new code; use the domain types from `types/platform.ts`.
- Match the surrounding style: small typed helpers, JSDoc one-liners on exported functions, and no comment noise.
- Ids come from `uid(prefix)`; human codes from `shortCode()`, `nextQuoteNumber()` and `nextNumber()`.
- Copy is Nepal-first and friendly ("Namaste", "Dhanyabad"). Use the existing tone.
- On web, avoid nesting pressables (`Card onPress` containing buttons). It produces `<button>` inside `<button>`. Make the tappable area and the buttons siblings inside a plain `Card`.

### Visual design

One design system for all four apps, in the "Royal Nepali Luxury" palette (`src/constants/theme.ts`, `src/theme/roles.ts`). Couple, business and freelancer apps share the burgundy accent; the staff console uses wine. `ROLE_MARK` tells roles apart in chat labels.

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Primary | `primary` | #681C2A deep burgundy | Primary buttons, selected tabs and chips, links, headings that need weight |
| Primary dark | `wine` / `primaryDark` | #3D1018 wine | Luxury sections: the home wedding band, the planner promo, featured badges, the floating filter bar, staff accent |
| Accent | `gold` | #C8A46B champagne | Countdown, ratings, short gilt rules, hairlines on wine (`goldLine`). Never body text on ivory: use `goldDeep` #8C6A33 |
| Background | `bg` | #FFF9F2 warm ivory | Screen background |
| Surface | `bgSoft` | #F5ECE2 pearl cream | Sections, filters, pressed states, role-app `surfaceAlt` |
| Romantic accent | `rose` | #C98991 dusty rose | Wedding-category accents, sparingly |
| Ink | `heading` | #251B18 espresso | Headings and body text |
| Muted | `textMuted` | #796B64 warm taupe | Secondary information |
| White | `white` | #FFFCF8 soft white | Cards and text on dark backgrounds |

- **Colour.** Roughly 65% ivory/cream, 20% burgundy/wine, 10% espresso text, 5% champagne and dusty rose. Gold is a thin metallic accent, never a fill for large areas. Status colours come from `statusTone()`. No gradients except dark scrims over photos (tint them wine or espresso, not grey); no glows, no coloured shadows. Never hard-code a hex in a screen: add a token.
- **Type.** Mukta for all UI text. Martel (`<Text serif>`) for display lines: screen and section titles, couple names, listing names, headline numbers (countdown, stat figures). Both are Ek Type faces with Devanagari, so Nepali text sets in the same voice. Don't add other font families.
- **Shape.** Cards 10 px radius with a 1 px border and no shadow; buttons 8 px; chips and pills 4–6 px. Shadows only on things that float (sheets, toasts, the floating filter bar).
- **Copy.** Sentence case everywhere, including labels, tabs and buttons. No all-caps eyebrows, no letter-spaced labels, no emoji in UI chrome or notifications, no "AI"/"magic"/sparkle language: the assistant is a rule-based help bot and is called "Quick help".
- **Stats.** Label above, number below (Martel), in ink. Colour a number only when it flags a problem (overdue, risk).
- Open UI/UX improvements (accessibility fixes, motion, dark mode, imagery) are prioritised in `docs/UI_UX_REPORT.md`; check it before starting visual work.
- Keep `README.md` (the product overview) and this file current when behaviour changes.

## 9. Definition of done: run these before saying the work is finished

```bash
npx tsc --noEmit        # must be 0 errors (typed routes are generated by `npx expo start`)
npx expo lint           # must be 0 errors / 0 warnings
npm run check:personas  # registry check + persona matrix (Node 24+)
npm run db:check        # when you touch SQL: every migration applies, RLS on every table
npm run db:test         # the core loop, sign-up, media, files, notifications and jobs against the SQL as each role, RLS on
npm run test:parity     # money in src/services equals money in SQL
npm run test:functions  # when you touch supabase/functions
npm run test:telemetry  # when you touch src/backend/telemetry*
npm run docs:generate   # after changing exports, routes, actions or SQL; commit docs/reference/ (docs:check verifies)
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
   - open a pull request into **`main`, always**. Every feature gets its own PR that merges into `main`; never target another feature branch, even when this branch was cut from one (the PR then also shows the unmerged parent commits, which is fine). If a PR for the branch already exists, the push updates it; don't open a duplicate.
4. **PR description:** what changed and why, how it was tested (tsc, lint, the flows you smoke-tested), and anything the reviewer should look at. Mark it as a draft and list the failures if a check could not be made to pass.
5. **Opening the PR.** This machine has no `gh` CLI. Use the GitHub REST API (`POST /repos/amritgyawali/weddingmarketplace/pulls`) with the token from `git credential fill`. Never print, log or commit the token.
6. **Never** merge a PR, push to `main`, force-push, or rewrite pushed history. The owner reviews and merges.
7. **Shared working tree.** If another session has uncommitted work checked out, don't switch branches under it. Use `git worktree add ../wt-<branch> <branch>` to work on your own branch in a separate folder.

## 10. Known defects (from `TEST_REPORT.md`, 29 Sep 2026)

Fix these deliberately, with tests. Don't paper over them, and don't "fix" them as a side effect of an unrelated change.

- **App, medium:**
  - `cancelBooking` on-device doesn't reverse revenue or adjust milestones (the SQL `rpc_cancel_booking` reverses the fee; milestones still need a decision on what the couple owes);
  - accommodation and security estimates and budgets use the guest count (`estimateFor`, `perUnitBudget`);
  - freelancers can be double-booked on-device (SQL prevents it with an exclusion constraint).
- **App, low:**
  - seed data for WP-1051 disagrees (quote, milestones and booking);
  - the quote preview hides send errors;
  - store actions trust the UI for validation (overpay, RSVP headcount, negative gifts, duplicate slugs).

When you fix one, remove it from this list and from `TEST_REPORT.md`.

Fixed in P5 (30 Sep 2026), each with a check in `npm run db:test`: the non-definer trigger functions, couples rewriting project and quote columns, VIEWER collaborators writing, the quote-freeze bypasses, uncapped refunds (SQL and on-device), and colliding project codes. `0005_personas.sql` also failed to apply (a duplicate `team_size` column); `npm run db:check` now catches that class of error.

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
