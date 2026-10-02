# 01. Product and domain

## 1. What Vivah is

Vivah is a **wedding-services orchestration marketplace for Nepal**. A family says once what they need ("a wedding in Kathmandu in Mangsir, 400 guests, these functions, this budget"), and the platform runs the whole thing:

1. match providers (venues, photographers, caterers, decorators…);
2. send **one versioned quotation**;
3. collect **one payment schedule**;
4. staff the crew (in-house staff or freelancers from a gig marketplace);
5. run the event day (run sheet, GPS check-in, incidents, emergency replacement);
6. pay providers and collect reviews.

It started as a wedding marketplace and now also handles other celebrations: engagement, anniversary, baby shower, newborn ceremonies (nwaran, pasni), bratabandha, birthday, corporate events and "something else". The brand "Vivah" (विवाह, "wedding") stays for now; a rebrand is planned, so new copy should take the name from `BRAND.name` in `src/constants/brand.ts`.

**Market: Nepal only.** Money is NPR with 13% VAT. Dates show in Bikram Sambat (the Nepali calendar) by default. The app speaks English and Nepali.

## 2. One binary, four role apps

Every user has exactly one role (`UserRole` in `src/types/platform.ts`). The role decides which app they see after sign-in. The apps never mix: route guards in `src/app/_layout.tsx` make another role's screens unreachable.

| Role | Who | App | Routes |
|---|---|---|---|
| `customer` | the couple or family | Marketplace + "My wedding" planning tools | `src/app/(tabs)/…` and screens at the root of `src/app` |
| `vendor` | venues and businesses (studios, caterers, decorators, shops) | Vivah for Business: leads, quotes, bookings, crew, calendar, packages, finance | `src/app/business/…` |
| `freelancer` | individuals (photographers, makeup artists, DJs, drivers, crew) | Gig marketplace: gigs, assignments, GPS check-in, earnings | `src/app/freelancer/…` |
| `platform` | Vivah staff: coordinator, support, Vendor Success, finance, admin, super admin | Operations console (also a desktop web dashboard) | `src/app/platform/…` |

Public pages need no sign-in: `/w/[slug]` (a couple's wedding website and registry), `/rsvp/[code]` (guest RSVP), `/legal/[doc]` (terms, privacy, refunds, account deletion) and `/pay/result` (payment return).

Inside each role there is a second level of identity, the **persona**: a customer's occasion, a vendor's services and business form, a freelancer's craft and skills, a staff member's permissions. It decides which tools and screens they see. See [09-personas-and-access.md](09-personas-and-access.md).

## 3. The core loop

This is the heart of the product. Most code exists to serve one of these steps.

```
Couple onboarding (5 questions) or plan wizard (8 steps)
  → submitPlan: Project WP-xxxx, coordinator auto-assigned, project chat, checklist
  → requirements per service → runMatching ranks providers (100-point score)
  → proposeBooking (provider confirms)
  → draftProjectQuote → sendQuote (v1 frozen) → reviseQuote / sendQuote (v2 …)
  → couple accepts vN
  → bookings CONFIRMED → milestones, payables (40/60), revenue, contracts, calendars BOOKED
  → crew slots → in-house staff or marketplace gigs → freelancers hired → assignments
  → event day: run sheet, GPS check-in, incidents, emergency replacement
  → deliverables → reviews → payouts released → project COMPLETED / CLOSED
```

Each arrow is a store action in `src/store/db/` (see [05-state-and-data.md](05-state-and-data.md) and [the store action reference](../reference/store-actions.md)). The money rules behind them are in [08-business-logic.md](08-business-logic.md).

Alongside the core loop:

- **Vendor leads.** A couple enquires directly from a listing; it becomes a `Lead` in the vendor's CRM (separate from projects). Unclaimed listings auto-reply and auto-quote so couples always hear back.
- **Planning tools for couples.** Guests and RSVP, seating, budget, website, invitations, registry, mood boards, compare, deals, contracts, calendar, checklist.
- **Role toolkits.** 20+ smaller tools per role (sait finder, expenses, VAT position, SLA monitor…). See [10-toolkits.md](10-toolkits.md).

## 4. The main entities

All of them are typed in `src/types/platform.ts` and stored in `DbData` (`src/store/db/types.ts`). The SQL schema mirrors them (`supabase/migrations/0001_core_schema.sql`).

| Entity | Code | What it is |
|---|---|---|
| Project | `WP-1021` | One celebration. Holds events (functions), requirements (one per service needed), bookings (one per provider), milestones (what the customer pays when), tasks, timeline, incidents and collaborators. `managedBy` is `platform` or `self`. |
| Event | | One function inside a project (Mehendi, Wedding, Reception…), with a date, venue and guest count. |
| Requirement | | "We need a photographer for these events, budget X." Status `OPEN → MATCHING → SHORTLISTED → QUOTED → CONFIRMED`. |
| Booking | | A provider booked against a requirement. `agreedPrice = providerPayable + platformFee`. Has crew slots and deliverables. |
| Quotation | `QT-2026-0042` | Versioned offer. Every sent version is frozen in `versions[]`. Issued by the platform (a package) or a vendor (direct). |
| Milestone | | One instalment the customer owes (30% / 50% / 20% by default). Status is always derived by `milestoneStatus()`. |
| Payment | `RCPT-…` | Money in: customer → platform. |
| Payable | | Money out: platform → provider or freelancer. Two per booking (40% before, 60% after). |
| Revenue | | What the platform earns (fees, margins, promotions). |
| Lead | | A vendor CRM enquiry. Not a project. |
| Gig | | A freelancer job posting, possibly tied to a booking's crew slot. |
| Assignment | | A person (staff or freelancer) assigned to a booking's crew slot. |
| Thread / Message | | Chat: project threads, service threads, direct enquiries. Staff-only internal notes are separate. |
| Notification | | Addressed to an account id or a whole role (`'platform'`). |
| Audit log entry | | Who did what to which entity, for every money, status and permission change. |

All status values are listed in `AGENTS.md` §4. **Never rename or remove a status value**: persisted data and the SQL enums depend on them.

## 5. Demo accounts

Every role has one-tap demo accounts. Sign in with the phone number and OTP **1234**, or tap "Continue as …" on the login screen. New platform staff need the access code `VIVAH2026`. (Supabase builds sign in by email code instead and have no demo buttons.)

| Account | Phone | Shows |
|---|---|---|
| Aakriti Shrestha, couple | 9800000001 | Owns WP-1021: quote v1 → v2, payments, guests, seating, website `/w/aakriti-weds-sujan` |
| Sarita Duwal, couple (Bhaktapur) | 9800000009 | Owns WP-1040, a newborn's pasni: filtered marketplace and tools |
| Rajesh Pradhan, vendor | 9800000002 | Everest Grand Party Palace (venue + catering) |
| Anil Gurung, vendor | 9800000005 | Wedding Story Nepal (photo and film studio) |
| Sunita Maharjan, vendor | 9800000007 | Phoolbari Decor, Lalitpur (decor studio) |
| Raj Maharjan, freelancer | 9800000003 | Photographer |
| Suman Tamang, freelancer | 9800000008 | DJ and MC |
| Sita Karki, platform coordinator | 9800000004 | Today view; WP-1017 is live today with an emergency replacement |
| Bikram Adhikari, platform super admin | 9800000006 | Admin console, occasions, feature switches, "Sign in as" |
| Nisha Rai, platform finance | 9800000010 | Payouts, refunds, disputes, audit |
| Prakash Thapa, platform support (Vendor Success) | 9800000011 | Verification queue, recruitment, scorecards |

Platform → More → **Reset demo data** (admins and super admins) restores the seed. The seed is built by `buildSeedData()` in `src/data/seed.ts` with dates relative to today, so the demo always has something happening "today".

## 6. Business models

The platform earns money four ways (`PRICING_MODELS` in `src/services/pricing.ts`), configured per booking:

| Model | Default | Example |
|---|---|---|
| Commission | 10% of the customer price | Customer pays 100,000 → provider gets 90,000, platform 10,000 |
| Markup | 15% on top of the provider's cost | Provider asks 70,000 → customer pays 80,500 |
| Lead fee | flat NPR 2,000 (capped at the price) | |
| Freelancer margin | 20% | Freelancer gets `pay`, platform earns `pay × 0.2 / 0.8` |

Vendors can also buy promotions (featured placement). Rates live in `settings` and can be changed by staff with `settings.edit`.

## 7. Where the product is going

As of October 2026, phases P0–P8 of [the master plan](../MASTER_PLAN.md) are merged: personas, vendor trades, freelancer crafts, customer occasions, platform RBAC, the SQL backend, auth/media/notifications, payments, and launch tooling, plus the super admin console, Nepali language and calendar (#19) and the "Royal Nepali Luxury" palette (#20). The app still runs on the on-device demo backend by default; going live is an owner task described in [`docs/LAUNCH.md`](../LAUNCH.md). Record later milestones in [20-decision-log.md](20-decision-log.md).
