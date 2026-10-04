# 08. Business logic

The rules that decide money, status and recommendations. They live in `src/services/` as **pure functions** (no React, no store; R-ARCH-4), so they can run in Node tests, in store actions, and be mirrored in SQL. Every export is listed in [the services reference](../reference/code/services.md).

Rules: R-BIZ-1 … R-BIZ-12 in [00-rules-and-regulations.md](00-rules-and-regulations.md). Formulas below are as of October 2026; if you change one, change `AGENTS.md` §5, this page, the SQL mirror, and run `npm run test:parity`.

## 1. Map of the services

| File | Responsibility | SQL mirror |
|---|---|---|
| `quotes.ts` | Quote totals, quote numbers, version snapshots, version diffs, quote templates, default terms | 0011 money helpers |
| `pricing.ts` | Pricing models, booking split, rounding, payment schedules, milestones, milestone status, payment summary, payables, releasability, project economics | 0011, 0013 jobs |
| `matching.ts` | Scoring providers for a requirement and freelancers for a crew slot | 0003 `match_providers`, `match_freelancers` |
| `risk.ts` | Risk flags per project for coordinators | 0003 `project_risks` view |
| `planner.ts` | Plan wizard → events, requirements, budget allocation, checklists, timeline, run sheets, next best action, texts | 0011 `rpc_submit_plan` |
| `experience.ts` | The persona resolver ([09](09-personas-and-access.md)) | 0005 `has_capability`, `has_permission` |
| `segments.ts` | Occasion × trade × city filters for the staff console | |
| `toolkit.ts` | Calculators behind the role tools (sait dates, climate, Nepal income tax, VAT position, price suggestions, hall capacity, freelancer quotes, vehicles, cash flow) | |
| `api.ts` | Async catalogue reads (venues, vendors, ideas, search) over the static data | future REST |
| `assistant.ts` | "Quick help": rule-based answers from the catalogue (no paid AI) | |
| `documents.ts` | Printable HTML: quote, receipt, contract, guest list, seating, run sheet | |
| `exporters.ts` | `.ics` calendars, CSV, PDF (expo-print), share sheet | |
| `auth.ts` | Wires stores on login, sign-up, impersonation and logout (the one service allowed to touch stores) | |

## 2. Money basics

- **Whole rupees** everywhere in the app (`number`, integer). SQL stores paisa.
- **Rounding:** `roundMoney(x) = Math.round(Number(x.toPrecision(12)))`, half up without float drift (plain `Math.round` gets 2,047,172.4999… wrong). Mirrors `vivah_rupees()` in 0011.
- **VAT:** `VAT_RATE = 0.13` (`TAX_RATE` in `quotes.ts`). `GST_RATE` is a deprecated alias; never use it.
- **Display:** `formatMoney(150000)` → `NPR 150,000`; `formatMoneyCompact` → `NPR 45K`, `NPR 2.5M` for chips; `formatLakh` → "7.5 lakh", "1.2 crore" for budgets (how families talk); `parseMoney` reads "1,50,000", "150k", "1.5 lakh". Never format money by hand (R-PROD-2).

## 3. Quotes (`quotes.ts`)

**Totals** (`quoteTotals(q)`, the only place this maths exists, R-BIZ-2):

```
lineTotal   = roundMoney(max(0, qty) × max(0, rate))
subtotal    = Σ lineTotal
discount    = clamp(discount, 0, subtotal)
serviceFee  = max(0, serviceFee)
taxable     = subtotal − discount + serviceFee
tax         = roundMoney(taxable × taxRate)        // 13%
total       = taxable + tax
cost        = Σ qty × (item.cost ?? item.rate)       // internal, never shown to couples
margin      = taxable − cost                         // internal
```

Worked example: two lines, 180,000 × 1 and 1,250 × 500 → subtotal 805,000; discount 5,000 → taxable 800,000; tax 104,000; **total 904,000**.

**Versions** (R-BIZ-1):

- A quote has a working copy (`items`, `discount`, …, `version`) and `versions[]`, the frozen snapshots of every sent version.
- `sendQuote` calls `snapshot(q)` and stores it in `versions[]`; status → `sent`.
- `reviseQuote` starts version N+1 as a draft; the sent versions never change.
- The customer accepts a specific version; `diffVersions(prev, next)` explains changes on the timeline.
- Numbers: `nextQuoteNumber(existing)` → `QT-2026-0042`.
- Status: `draft → sent → viewed → accepted`, or `revision`, `declined`, `expired`, `superseded`.

## 4. Pricing and the booking split (`pricing.ts`)

`splitBooking(model, rate, { customerPrice?, providerCost? })` returns `{ agreedPrice, providerCost, platformFee, providerPayable }` with **`agreedPrice = providerPayable + platformFee`** always (R-BIZ-4).

| Model | Default rate | Formula | Example |
|---|---|---|---|
| `COMMISSION` | 0.10 | fee = round(price × rate); payable = price − fee | 100,000 → payable 90,000, fee 10,000 |
| `MARKUP` | 0.15 | price = round(cost × (1 + rate)); fee = price − cost | cost 70,000 → price 80,500, fee 10,500 |
| `LEAD_FEE` | NPR 2,000 | fee = min(price, rate); payable = price − fee | |
| `FREELANCER_MARGIN` | 0.20 | like commission | client 10,000 → freelancer 8,000, fee 2,000 |

Freelancer margin when staffing a crew slot (invariant 8 in `AGENTS.md`): the platform adds `margin = pay × m / (1 − m)` with m = 0.2 on top of the freelancer's pay. In-house staff have no margin and don't block the freelancer calendar. `freelancerNet(clientPay)` gives the split the other way round.

Direct vendor bookings are priced **pre-VAT**; VAT sits on the customer's quote total and milestones only (R-BIZ-7).

## 5. Payment schedules and milestones

Templates (`SCHEDULE_TEMPLATES`); `DEFAULT_SCHEDULE` is the first:

| Id | Steps |
|---|---|
| `30-50-20` (default) | 30% on confirmation · 50% fifteen days before the event · 20% three days after completion |
| `50-50` | 50% on confirmation · 50% seven days before |
| `25-25-40-10` | 25% on confirmation · 25% sixty days before · 40% ten days before · 10% thirty days after delivery |
| `full` | 100% on confirmation |

- `buildMilestones(steps, total, dates)` rounds each step and lets the **last step absorb the rounding**, so the sum equals the accepted total exactly (R-BIZ-3).
- `dueDateFor(step, dates)`: `on_confirmation` = confirmed + 3 days (or `days`); `days_before_event` = event − days, but never before confirmation (then confirmed + 3); `after_completion` = last event + days.
- `milestoneStatus(m)` is always derived, never trusted from storage: `WAIVED` stays; paid in full → `PAID`; past due → `OVERDUE`; partly paid → `PARTIALLY_PAID`; due within 7 days → `DUE`; else `UPCOMING`.
- `paymentSummary(project)` → `{ total, paid, outstanding, next, overdue }` for screens. Take totals from here, never compute in JSX.
- The default schedule must match `DEFAULT_TERMS` in `quotes.ts` (the words in the contract).

## 6. Payables and payouts

Money out is a separate ledger from money in (R-BIZ-7).

- `payablesForBooking(booking, project)` creates **two** payables when a booking is confirmed: 40% "pre-event release" due first event − 7 days, and 60% "final settlement" due first event + 3 days; they sum to `providerPayable` (R-BIZ-5).
- Status: `ACCRUED → READY → PAID`, or `ON_HOLD` / `CANCELLED`. An open dispute with `freeze` puts them `ON_HOLD`.
- `releasable(p, project)`: only `ACCRUED`/`READY`; the after-event part only when every non-cancelled event is done or past; others when due.
- Release is a staff action with `payout.release` (finance), audited.

## 7. Confirming a booking (`activateBooking`, store)

Idempotent (R-BIZ-6). It:

1. generates the service's deliverables and crew plan;
2. marks the requirement `CONFIRMED`;
3. adds exactly one pair of payables and one revenue entry per booking;
4. blocks the provider calendar as `BOOKED`;
5. creates one contract.

## 8. Matching (`matching.ts`)

Recommends, never awards (R-BIZ-8). Score out of 100:

| Factor | Weight |
|---|---|
| Availability | 30 |
| Location | 15 |
| Budget fit | 15 |
| Category experience | 10 |
| Rating | 10 |
| Completion rate | 5 |
| Response speed | 5 |
| Previous work quality | 5 |
| Platform priority | 3 |
| Repeat provider | 2 |

- **Hard excludes:** dates `BOOKED` or `UNAVAILABLE`, unverified providers (unless `includeUnverified`), venues too small for the guests or in another city.
- Each factor stays within its weight; the score stays within 0–100 (`MATCH_WEIGHTS`, `MATCH_FACTORS`).
- `rankProviders` for requirements; `rankFreelancers` for crew slots and gigs (skills, travel radius, calendar).
- Demo calendars: catalogue providers are "busy" on a deterministic ~12% of dates (`syntheticStatus`) so exclusions are visible; real calendars override.
- Weights mirror `supabase/migrations/0003`. Change both together.

## 9. Emergency replacement (`startEmergencyReplacement`, store)

When crew fails on the day:

1. the assignment becomes `EMERGENCY_REPLACEMENT`;
2. an emergency gig is posted at **1.25× pay, rounded to 500**;
3. the top-ranked freelancers within **1.5× their travel radius** are invited;
4. a high-severity incident opens;
5. the emergency fee is booked as revenue;
6. the first accepted invite is hired as the replacement (`replacesId`).

## 10. Risk flags (`risk.ts`)

`projectRisks(project, { gigs, quotes })` computes flags on demand; they are **never stored** (R-BIZ-11). Closed, completed, cancelled and rejected projects raise none. Kinds: `NO_COORDINATOR`, `PROVIDER_UNCONFIRMED`, `CREW_UNFILLED`, `PAYMENT_OVERDUE`, `EVENT_WITHIN_48H`, `SERVICE_UNFILLED`, `PROVIDER_CANCELLATION_HISTORY`, `DELIVERABLE_OVERDUE`, `EMERGENCY`, `QUOTE_EXPIRING`, `OPEN_INCIDENT`, each with a severity (`high`/`medium`/`low`). Same rules as the `project_risks` view in 0003.

## 11. Planning (`planner.ts`)

Turns the plan wizard into a project:

- `buildEvents(input)` → functions with dates; `buildRequirements(input, events)` → one requirement per service with a budget;
- `estimateRange`, `estimateTotal`, `allocateBudget`, `perUnitBudget` → budget suggestions from guest count and events;
- `generateTasks(date, services, customerName, coordinatorName, occasion)` → the checklist (wedding templates or `CELEBRATION_TEMPLATES` + `OCCASION_TASKS` for other occasions; `WEDDING_ONLY_TASKS` lists the wedding-only ones);
- `buildTimeline`, `runSheetFor`, `nextBestAction`, `planningProgress`, `missingServices`, `savingTips`;
- texts: `invitationText`, `enquiryText`, `questionsToAsk`, `negotiationPoints`, `summarizeReviews`.

Known defect (Oct 2026): accommodation and security estimates use the guest count (`estimateFor`, `perUnitBudget`); see `AGENTS.md` §10.

## 12. Notifications and audit (store `core.ts`)

- `notify(to, title, body, href?, kind?)`: `to` is an account id or a role. Capped at 300 per store; muted kinds arrive read; `emergency` always rings (R-BIZ-12).
- `log(actor, action, entity, entityId, detail?)`: audit log capped at 500 on device. Action names are `entity.verb` (`quote.send`, `payout.release`).

## 13. Changing a business rule safely

1. Change the pure function in `src/services` and its JSDoc.
2. Change the SQL mirror in a **new** migration.
3. Add or update parity fixtures (`scripts/parity-fixtures.json`) and run `npm run test:parity`.
4. Update `AGENTS.md` §5, this page and any seed data that must stay consistent.
5. Run the money reconciliation smoke test ([12-testing-and-qa.md](12-testing-and-qa.md)): quote total = Σ milestones; booking price = payable + fee; payables sum to the provider payable.

## Customer planning estimates and availability (4 October 2026)

`services/customerPlanning.ts` keeps guide task ids unchanged and groups them by the days left until their recommended due date. Earlier work moves into Do now; upcoming groups never extend beyond the event date. The home guide uses the same grouping and shows five open items.

`personalizedPackagePrice` calculates a listing estimate using the active, requirement-linked functions, per-function headcounts or explicit quantities, and priced extras in `Requirement.details.addOnTotal`. These totals are estimates; unspecified extras require a vendor quotation. No accepted quote, VAT rule, milestone or payout changes.

Vendor Calendar publishes `tradeProfile.eventsPerDay` through `setProviderPersona`, which validates whole numbers from 1 to 100. The public and business calendars share `listingAvailability`: distinct booking/hold reference ids consume slots; closures and weekly rules override remaining slots. Unpublished calendars are labelled as requiring enquiry confirmation, without synthetic availability. The matching engine retains its existing conservative booking exclusions.
