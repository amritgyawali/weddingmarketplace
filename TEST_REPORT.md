# Vivah: full test report

**Date:** 29 September 2026
**Branch:** `feature/orchestration` at `a31be9c`, working tree clean
**Scope:** the whole Expo app (4 role apps, 116 screens), the on-device backend (`src/store/db`), all services, the seed data and the 3 Supabase migrations.

## Verdict

The app builds, runs and works end to end. Every route opens without a crash for every role, and the main business flows produce the right numbers. I found no blocker for the Expo Go demo.

The problems are in two places:

- **App logic.** Some edge cases are wrong: repeated refunds, cancelled bookings that keep their revenue, wrong estimates for per-person services, double-booked freelancers and project-code collisions. Most of the store trusts the UI to validate, and the UI usually does.
- **SQL schema.** It applies cleanly, but it has two defects that block production use. With RLS on, **no signed-in user can create a project or change its status**, and **vendors cannot assign freelancers**. A few RLS policies are also too permissive.

## Scorecard

| Area | Method | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npx expo lint` | ✅ 0 warnings, 0 errors |
| Expo Doctor | `npx expo-doctor` | ⚠️ 20/21. 4 patch mismatches: expo 57.0.25→.26, expo-constants, expo-document-picker, expo-router |
| Native bundles | Metro, full dev bundle | ✅ Android: 2,639 modules. iOS: 2,553 modules. No resolve or transform errors |
| Expo Go | `npx expo start --lan` | ✅ Serving `exp://192.168.1.72:8081`, SDK 57 manifest, reachable on the LAN, firewall allows Node |
| Logic tests (store + services) | 329 assertions + 33 defect probes, run headless in Node | ✅ 328/329 assertions pass. The 1 failure is seed data. 26 probes reproduced a defect |
| SQL migrations | Applied to real Postgres 17 (PGlite) with Supabase auth/role shims | ✅ 332/332 statements. 83 tables, all with RLS and policies |
| SQL behaviour | 46 assertions + 15 probes: triggers, RPCs, RLS as each role | ✅ 46/46 assertions pass. 14 probes reproduced a defect |
| UI route sweep (web build = same JS as Expo Go) | 207 page loads across 7 roles, at phone (430 px) and desktop (1280 px) widths | ✅ 0 crashes, 0 error screens. 13 web-only warnings. 1 blank page |
| UI flows (clicked through in a browser) | 9 scripted user journeys | ✅ 9/9 pass |

## 1. What works (verified)

**Sign-in and routing.** The phone + OTP flow works in the real UI:
- short numbers keep "Send OTP" disabled;
- non-Nepali numbers are rejected;
- a wrong OTP shows an error;
- `1234` lands on the couple home.

Each role only reaches its own app (`Stack.Protected`). Public `/w/<slug>` and `/rsvp/<code>` open without an account.

**The core loop, checked number by number:**

- **Plan wizard → project.** The wizard creates a project:
  - the coordinator is auto-assigned;
  - the status moves to REVIEWING;
  - a project thread opens with a welcome message;
  - a checklist is generated;
  - the budget is split per service;
  - the partner is added as a collaborator with an invite code.
- **Matching.**
  - It ranks providers for every requirement. Scores are 0–100 and every factor stays within its weight (the 10 weights sum to 100).
  - Blocked and unverified providers are excluded.
  - Re-running matching does not create duplicate candidates.
- **Proposals.** Proposing to an unclaimed listing auto-confirms after 3.5 s. Owned listings wait for the vendor.
- **Package quotation.** It has one line per booking, a 2.5% discount for 5+ lines and a service fee of at least NPR 10,000.
- **Quote versions.**
  - Sending v1 freezes it.
  - Revising creates v2, and v1's total is unchanged.
  - v2 was lower by exactly NPR 25,000 + VAT.
  - "Viewed" status notifies the coordinator.
- **Accepting the quote:**
  - project, bookings and requirements become CONFIRMED;
  - the 30/50/20 milestones sum exactly to the total;
  - each booking gets two payables (40% before the event, 60% after) that sum to the provider payable;
  - revenue is booked per booking plus the service fee;
  - one contract is generated per booking;
  - provider calendars are marked BOOKED.
- **Payments.**
  - eSewa/Khalti references and receipt numbers continue the seed sequence.
  - A receipt file is stored.
  - Zero-amount payments are rejected.
- **Disputes.** A dispute freezes the provider payables, and release is blocked. Resolving it with "unfreeze" makes them READY; a release then marks them PAID.
- **Crew.**
  - A freelancer margin of 20% of the gross is calculated.
  - The freelancer's calendar is blocked.
  - GPS check-in and check-out work. Check-out accrues the payout, and a second check-out creates no second payable.
  - Confirming the work makes the payout READY; releasing it marks it PAID.
- **Emergency replacement:**
  - opens an urgent gig;
  - marks the original assignment;
  - raises a high-severity incident, which the risk engine shows;
  - adds an emergency fee.

  The first freelancer to accept is hired, linked as the replacement, and the incident auto-resolves.
- **Wedding day.**
  - A live event puts the project IN_PROGRESS.
  - When all events are done, the project and bookings become COMPLETED, after-event payouts become releasable and the couple gets a review prompt.
- **Deliverables.** The flow runs ready for review → changes requested (the revision is counted) → approved, with history.
- **Direct marketplace booking:**
  - the lead notifies the vendor;
  - the vendor quote marks the lead as quoted;
  - a revision request moves the lead to negotiating, and v2 is sent;
  - on acceptance, a project is created for the couple, the booking is CONFIRMED with a 10% commission on the pre-VAT price, milestones are created, the lead is won and the vendor is notified.
- **Unclaimed listings** auto-quote within 4 s.

**Other tools that behaved correctly:**

- **Chat:**
  - threads open idempotently;
  - blank messages are ignored;
  - unclaimed listings auto-reply;
  - blocked threads refuse messages;
  - muted notification kinds arrive already read, but emergencies always ring;
  - notifications are capped at 300.
- **Guests and seating:**
  - RSVP codes are looked up without regard to case;
  - declining sets attendance to 0;
  - unknown codes return nothing;
  - auto-seating respects table capacity across repeated runs.
- **Website, registry, contracts, invites:**
  - website view counts increase;
  - registry gifts get GIFT receipts;
  - a contract counts as signed only when all 3 parties sign (re-signing does not double count);
  - collaborator invite codes work, trimmed and in either case.
- **Reviews:**
  - a review with a real booking is marked verified;
  - reviews containing phone numbers or links are auto-flagged.
- **Verification.** The lifecycle runs submit → under review → verified, setting the account flag. Suspension works.
- **Availability.** Manual blocks and clearing work, and weekday rules replace rather than duplicate.
- **Gigs:**
  - applying again replaces the earlier application;
  - hiring fills the gig;
  - check-in/out completes it and accrues the payout.
- **Exporters and helpers:**
  - ICS export escapes text and handles all-day events;
  - CSV round-trips quotes, commas and newlines;
  - Google Calendar links, and receipt/contract/quote PDF HTML, are generated;
  - venue search/filter, `api.search` and all assistant intents work.
- **Persistence.** Only data keys are stored (v3). The stored DB is about 354 KB.

**SQL (on real Postgres):**

- **Triggers:** the status-history trigger, the audit-log triggers and the WP-/QT- number sequences work.
- **Quote freeze:** a sent quote version rejects changes to its totals and to its items (add, edit, delete).
- **Freelancer double booking:** the gist exclusion constraint blocks overlapping shifts and allows back-to-back ones.
- **Calendar triggers:** they block and release provider and freelancer days.
- **RPCs:**
  - `match_providers()` ranks correctly, excludes booked providers and refuses other customers;
  - `refresh_match_candidates()`, `start_emergency_replacement()`, `recompute_reliability()` and `operations_today()` all run;
  - the `project_risks` view works.
- **RLS:**
  - couples see only their own project and anonymous users see none;
  - staff see everything;
  - provider cost and pricing columns are hidden from couples (`quote_items_public`, `service_bookings_customer`, column grants on `providers`);
  - freelancers see only their own assignments.

**UI flows clicked through in a browser:**

| Flow | Result |
|---|---|
| Couple: plan wizard, all 8 steps → submit | ✅ Created WP-1040 and landed on the confirmation screen |
| Couple: pay a milestone with Khalti | ✅ Paid NPR 870,125; receipts went from 2 to 3 |
| Couple: add a guest | ✅ The empty name is rejected, then the guest is saved |
| Couple: open the versioned quote | ✅ |
| Guest: public RSVP | ✅ Confirmation shown |
| Freelancer: emergency gig | ✅ Opens. Raj isn't invited (the Pokhara gig is 142 km away, beyond his radius), so no Accept button, which is correct |
| Vendor: lead → create quotation → send | ✅ An empty quote is blocked; the template and send work; the lead is marked quoted |
| Coordinator: matching on a NEW project (desktop sidebar layout) | ✅ |

## 2. Defects found

Severity is judged for production. Most app-side items are not visible in the demo, because the UI already guards them.

### High: SQL schema, blocks production API use

| # | Defect | Evidence | Fix |
|---|---|---|---|
| S1 | **No authenticated user can create a project or change its status.** The `log_project_status()` trigger is not `SECURITY DEFINER`, and `project_status_history` has only a SELECT policy, so the trigger's INSERT fails RLS. A couple inserting a project, and a coordinator updating its status, both get `new row violates row-level security policy for table "project_status_history"`. Only `service_role` works. | [0001_core_schema.sql:460](supabase/migrations/0001_core_schema.sql#L460), [0002_rls.sql:153](supabase/migrations/0002_rls.sql#L153) | Make the function `security definer set search_path = public` (as `audit_row()` already is) |
| S2 | **Vendors cannot assign freelancers to their own bookings.** `block_calendar_for_assignment()` is not `SECURITY DEFINER`, so its INSERT into `availability` (owner = the freelancer) is rejected for a provider org member, although the "assignments manage" policy allows the assignment. | [0001_core_schema.sql:796](supabase/migrations/0001_core_schema.sql#L796), [0002_rls.sql:137](supabase/migrations/0002_rls.sql#L137) | Same fix. Check `block_calendar_for_booking()` too |

### Medium

| # | Defect | Evidence |
|---|---|---|
| M1 | **A payment can be refunded more than once.** The couple can open "Request refund" again while the first request is pending, because the icon shows while the payment is still `SUCCEEDED`. Each request asks for the full amount, and approving both refunds 2×. The store has no cap, and neither does SQL (`refunds.amount` is only `> 0`). | [Payments.tsx:296](src/components/work/Payments.tsx#L296), [finance.ts:95](src/store/db/finance.ts#L95), [0001_core_schema.sql:964](supabase/migrations/0001_core_schema.sql#L964). Test: refunded 1,002,924 on a 501,462 payment |
| M2 | **Cancelling a confirmed booking leaves the money in place.** The platform commission stays in revenue, and the couple's milestones are unchanged, so they still owe the cancelled provider's share. | [projects.ts:543](src/store/db/projects.ts#L543). Test: NPR 360,000 booking cancelled, milestones still NPR 2,740,250 |
| M3 | **Wrong estimates and budgets for per-person services** (accommodation, security). `estimateFor()` multiplies by *guests* instead of rooms or staff, and `perUnitBudget()` divides by guests. Estimates come out about 50× too high: accommodation NPR 4.55M, security NPR 1.0M. Per-unit budgets come out about 20× too low (NPR 200/room, NPR 10/guard). MatchPanel pre-fills the inflated price in "Check & propose". | [matching.ts:116](src/services/matching.ts#L116), [planner.ts:106](src/services/planner.ts#L106) |
| M4 | **Freelancers can be double-booked on-device.** Hiring through a gig (or `assignWorker`) never checks the freelancer's calendar, and the applicants list shows no conflict warning. SQL prevents this (exclusion constraint); the demo backend doesn't. | [gigs.ts:146](src/store/db/gigs.ts#L146). Test: 2 BOOKED entries on the same day |
| M5 | **Project codes collide.** The code is `WP-${1000 + projects.length + 31}`. After 11 new plans (from a reset), a new project gets **WP-1051**, which already belongs to seeded Sneha & Arjun. | [projects.ts:176](src/store/db/projects.ts#L176) |
| M6 | **RLS lets clients rewrite platform fields.** "projects staff update" lets a couple update *any* column of their project; the test cleared `coordinator_id` and changed the budget. "quotes customer respond" lets a couple rewrite `issuer_org_id` or versions. | [0002_rls.sql:152](supabase/migrations/0002_rls.sql#L152), [0002_rls.sql:170](supabase/migrations/0002_rls.sql#L170) |
| M7 | **Collaborator permission is not enforced.** `is_project_customer()` treats every accepted collaborator as the owner, so a VIEWER can edit guests, budget and the website, and can promote themselves to OWNER. | [0002_rls.sql:50](supabase/migrations/0002_rls.sql#L50) |
| M8 | **The quote freeze can be bypassed.** A sent version can be "un-sent" (`sent_at → null`) and then edited, or deleted outright (its items cascade). `vat_rate`, `notes` and `valid_until` are not frozen. | [0001_core_schema.sql:617](supabase/migrations/0001_core_schema.sql#L617) |

### Low

| # | Defect | Evidence |
|---|---|---|
| L1 | **Seed data disagrees for WP-1051.** The quote QT-2026-0008 totals NPR 706,250, the milestones are built on 734,500, and the booking price is 650,000. | [seed.ts:890](src/data/seed.ts#L890) |
| L2 | **Emergency invites can over-hire.** `respondToInvite` hires even when the gig is already filled; the test hired 2 people for 1 slot. The UI hides the button once the gig is filled, so only simultaneous accepts from two devices would hit this. | [gigs.ts:119](src/store/db/gigs.ts#L119) |
| L3 | **Cancelled events still block matching**: `requirementDates()` doesn't filter them out. | [matching.ts:86](src/services/matching.ts#L86) |
| L4 | **Per-plate prices drift when a quote is drafted.** The line rate is rounded (`round(price/qty)`), so the line total differs from the booking price (+NPR 240 in the test) and rewrites the booking price on acceptance. | [quotes.ts:37](src/store/db/quotes.ts#L37) |
| L5 | **Last-minute bookings get instalments due after the event.** With an event tomorrow, the advance and the "15 days before" instalment both fall due 3 days after confirmation. | [pricing.ts:113](src/services/pricing.ts#L113) |
| L6 | **A new quote shows "V1 (draft)" twice** and logs React "two children with the same key". This happens on every new vendor or platform draft preview. | [QuoteDocument.tsx:22](src/components/work/QuoteDocument.tsx#L22) |
| L7 | **Send errors are invisible in preview.** Pressing "Send to customer" in the quote preview with no items does nothing visible, because the error only renders in edit mode. | [QuoteEditor.tsx:279](src/components/work/QuoteEditor.tsx#L279) |
| L8 | **Nested `<button>` inside `<button>` on web** (PressableScale inside a Card): 13 screens log hydration warnings and show a red dev toast. This is web only; native is fine. | Seen on `/platform`, `/my-wedding?tab=tasks`, `/checklist`, `/calendar`, `/registry`, `/business/packages`, `/freelancer/calendar` |
| L9 | **`/plan-submitted` without `?id` renders a blank white screen** and offers no way back. | [plan-submitted.tsx:27](src/app/plan-submitted.tsx#L27) |
| L10 | **The store trusts the UI.** It accepts paying an already-PAID milestone, overpayment, RSVP headcounts above 1 + plus-ones, negative registry gifts, duplicate website slugs, cancelling a completed gig, duplicate reviews, duplicate rows within one CSV import, and a second check-out (which books margin revenue twice). The screens guard all of these today; move the checks server-side along with the API. | Harness probes |
| L11 | **Small inconsistencies:** `formatMoneyCompact(999_950)` shows "NPR 1000K". The SQL emergency gig is always titled "needed today". `recompute_reliability()` gives a brand-new freelancer 48 (default 70). | — |

### Doc / consistency notes

- [matching.ts:3](src/services/matching.ts#L3) says the on-device and database engines "agree". Only the **weights** match; the factor formulas differ:
  - location: 0.85 vs 0.8, plus a travel curve;
  - budget decay: 1.5× vs 1×;
  - experience: log scale plus style overlap, vs completed/60;
  - rating: Bayesian average vs a raw average;
  - response window: 720 vs 1440 minutes;
  - capacity and verification filters exist only on-device.

  The two engines will rank differently.
- [risk.ts](src/services/risk.ts) has 11 risk kinds; the SQL `project_risks` view has 7. EMERGENCY, NO_COORDINATOR, QUOTE_EXPIRING and OPEN_INCIDENT exist only on-device.

## 3. Run it in Expo Go

The dev server is running with `npx expo start --lan --port 8081`.

- Open **Expo Go** (SDK 57) on a phone on the same Wi-Fi and enter `exp://192.168.1.72:8081`, or scan the QR code.
- Demo sign-in: any role → "Continue as …", or phone `98000000xx` with OTP `1234`.

## 4. How it was tested

- **Logic harness.** `src/store` and `src/services` were bundled with esbuild, with React Native and AsyncStorage stubbed out. The harness ran the real zustand store through full multi-role scenarios, with a timed wait for the store's setTimeout-driven auto-replies.
- **SQL.** The migrations were applied to PGlite (Postgres 17 in WASM) with `pgcrypto`, `btree_gist` and `pg_trgm`, plus shims for Supabase's `auth.uid()` and its anon/authenticated/service_role roles and default grants. RLS was tested with `set role authenticated` plus JWT claims.
- **UI.** Playwright drove the Expo web build (the same JavaScript as Expo Go), with sessions seeded per role, screenshots of every page, and console and page errors captured.
- **The harness is not in the repo**, because it would break `tsc`, which type-checks every `.ts` file. It lives in the session scratchpad.
