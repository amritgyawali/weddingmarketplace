# Vivah: wedding orchestration for Nepal

*"Tell Vivah what you need once, and the platform manages the whole wedding."*

Vivah is a React Native and Expo (SDK 57) app with four role apps in one binary. They share one
backend, which runs on the device for the demo, and one Postgres/Supabase schema for production.

| User type | App | What it does |
|---|---|---|
| **Couple** (customer) | Marketplace + **My Wedding** | Covers the whole wedding: a "Plan my wedding" wizard (8 steps, multi-function Nepali ceremonies), versioned quotes, payments, guests & RSVP, seating, budget, website, invitations, registry, mood boards, compare, deals, contracts, calendar and checklist. Onboarding asks what is being celebrated first (wedding, engagement, anniversary, baby shower, newborn ceremony, bratabandha, birthday, corporate or something else); the questions, marketplace categories and tools follow the occasion, and one account can plan several celebrations. |
| **Vendor** (venues & businesses) | Vivah for Business | Covers running a business on Vivah: lead CRM, a quote builder, and bookings with crew and deliverables. It also has an availability calendar, packages, portfolio, finance/payables, analytics, promotions, reviews, team, customers and verification. **Social media**: connect Facebook, Instagram, WhatsApp and TikTok, answer every message and comment from one inbox (turn a conversation into a lead in one tap), and publish or schedule one post to all of them, with best times, hashtags, insights and auto-replies. |
| **Freelancer** (photographers, MUAs, crew) | Gig marketplace | Covers crew work: discovering gigs and invites, including emergency gigs. Crew can manage assignments (confirm, GPS check-in, check-out with proof), keep a calendar with weekly rules, and track earnings and payouts. They also maintain a profile with kit, rates and reliability. Sign-up asks the craft first, and the profile, rate model, equipment, tools and gig feed follow it. |
| **Platform team** | Operations console (web-ready) | Covers running the platform: leads kanban, a 12-tab project console, a matching engine and quote builder, a control room and emergency replacement. It also covers approvals, finance (revenue, payables, refunds, disputes), users, providers, freelancers, analytics, the marketplace and the audit log. Each staff role sees only what its permissions allow (coordinator, support, Vendor Success, finance, admin), with its own Today focus and an occasion × trade × city filter on the lists. |

Each app also has a **toolkit of 20 extra tools**, opened from a searchable hub:

| User type | Hub | Tools |
|---|---|---|
| Couple | Profile → Planning tools | Sait finder, puja samagri, weather and season, family duties, janti planner, guest rooms, pickups, wedding-day contacts, my day schedule, outfits and jewellery, emergency kit, photo shot list, music, bhoj menu, vendor meetings, tips and dakshina, shagun and gifts, what-if budget, savings goal, honeymoon planner, plus baby keepsakes, surprise plan and games for the occasions that use them. Tools are filtered by occasion. |
| Vendor | Business → Business tools | Saved replies, follow-ups, site visits, reply-time goal, cancellation policy, hours and away message, price calculator, market benchmark, gift vouchers, referral partners, monthly goals, expenses, profit and loss, VAT and tax, staff roster, event prep checklists, team tasks, inventory, suppliers, halls and capacity |
| Freelancer | Profile → Freelancer tools | This week, open dates, travel planner, gear checklist, health and safety, card backup log, edits and deliveries, work diary, rate calculator, private invoices, expenses and mileage, income tax estimate, earnings goal, savings pots, pitch builder, reliability coach, clients, crew network, certificates, gear care, plus craft tools (product kit, setlist, vehicle log). Tools are filtered by craft. |
| Platform team | More → Operations tools | SLA monitor, coordinator workload, on-call roster, holidays and closures, quality audits, helpdesk, reply macros, broadcasts, win-back list, promo campaigns, vendor recruitment, city supply, demand by season, source funnel, provider scorecards, monthly targets, cash-flow forecast, payout batches, risk and fraud watch, export centre |

## The core loop

```
Plan my wedding (events, services, guests, budget, styles)
   → Project WP-xxxx · coordinator auto-assigned · project chat opened
   → Requirements per service → matching engine ranks providers (100-point score)
   → Versioned quotation (never overwritten) → couple accepts vN
   → Bookings confirmed → milestones, contracts, provider payables, platform revenue
   → Crew slots → in-house or marketplace gigs → freelancers hired → assignments
   → Wedding day: run sheet, GPS check-in, incidents, emergency replacement
   → Deliverables → reviews → payouts released → project CLOSED
```

Lead pipeline: `NEW → REVIEWING → NEEDS_CLARIFICATION → MATCHING_PROVIDERS → QUOTE_PREPARED → QUOTE_SENT → CUSTOMER_NEGOTIATING → CONFIRMED → IN_PROGRESS → COMPLETED → CLOSED`, plus `QUOTE_REJECTED` and `CANCELLED`.

**Matching weights:**

| Signal | Weight |
|---|---|
| Availability | 30 |
| Location | 15 |
| Budget | 15 |
| Category experience | 10 |
| Rating | 10 |
| Completion | 5 |
| Response | 5 |
| Quality | 5 |
| Priority | 3 |
| Repeat | 2 |

**Money** is in NPR with 13% VAT. The business models are commission, markup, lead fee and freelancer margin. Couples can pay with eSewa, Khalti, Fonepay, ConnectIPS, IME Pay, cards and bank transfer. Providers receive their payables 40% before the event and 60% after it.

## Run it

```bash
cd wedding-app
npm install
npx expo start          # Expo Go (SDK 57): scan the QR, or press a / i / w
```

Sign in with any Nepali mobile number (`98XXXXXXXX`); the OTP is **1234**. Each login screen also has **Explore with a demo account**:

| Role | Demo account (phone) | Try |
|---|---|---|
| Couple | Aakriti Shrestha (9800000001) | My Wedding WP-1021: quote v1 → v2, payments, guests, seating, website `/w/aakriti-weds-sujan` |
| Vendor | Rajesh Pradhan, Everest Grand Party Palace (9800000002) | Leads → quote → booking → crew & payables; social media inbox and posts |
| Vendor | Anil Gurung, Wedding Story Nepal (9800000005) | Photography studio with packages, portfolio, gigs, gallery delivery |
| Vendor | Sunita Maharjan, Phoolbari Decor (9800000007) | Decor studio: themes, rentals, setup sheets and the setup checklist |
| Freelancer | Raj Maharjan (9800000003) | Assignments, emergency gig in Pokhara, earnings |
| Freelancer | Suman Tamang, DJ Suman (9800000008) | Music craft: sound gear, setlist, DJ-only gig feed |
| Staff | Nisha Rai, finance (9800000010) | Finance console: payouts, refunds, disputes |
| Staff | Prakash Thapa, Vendor Success (9800000011) | Verification queue, recruitment, scorecards |
| Couple | Sarita Duwal (9800000009) | Aarohi’s pasni in Bhaktapur: newborn occasion, filtered marketplace and tools, gift log, keepsakes |
| Platform | Sita Karki, coordinator (9800000004) | Today → WP-1017 wedding live today with an emergency replacement |
| Platform | Bikram Adhikari, super admin (9800000006) | Approvals, finance, users, audit, occasions (More → Occasions). New staff use access code `VIVAH2026`. |

The platform app's **More → Reset demo data** restores the seed.

Public pages work without signing in:
- `/w/<slug>`: the couple's website, with its registry and gifts.
- `/rsvp/<code>`: the guest RSVP form.

## Checks

```bash
npx tsc --noEmit        # typed routes are generated by `expo start`
npx expo lint
npx expo-doctor
```

## Documentation

- **[`docs/handbook/`](docs/handbook/README.md)**: the handbook for developers and AI agents. Start with the [rules and regulations](docs/handbook/00-rules-and-regulations.md), then the guide for your area (frontend, UI/UX, state, backend, database, business logic, personas, toolkits, language and dates, testing, security, devops, git).
- **[`docs/reference/`](docs/reference/README.md)**: the generated code reference: every route, store action, export and migration. Regenerate with `npm run docs:generate`; `npm run docs:check` fails when it is stale.
- **[`AGENTS.md`](AGENTS.md)**: the binding rules for AI agents. **[`llms.txt`](llms.txt)**: a map of the docs for AI tools.
- The docs are reviewed every week ([how](docs/handbook/17-documentation-maintenance.md)).

## Architecture

```
src/
  app/                  expo-router, Stack.Protected per role
    (tabs)/ …           couple marketplace; couple tools live at the root:
                        plan, my-wedding, guests, seating, budget, website, invitations, registry,
                        boards, compare, deals, contracts, contract/[id], calendar, checklist, settings
    w/[slug], rsvp/[code]   public website + RSVP (no auth)
    business/ freelancer/ platform/   role apps (tabs + stacks, sidebar on wide screens)
  components/
    kit/                role-themed primitives (Card, KButton, KField, Segmented, KPI, charts…)
    work/               shared workflow UI: MatchPanel, QuoteEditor/Document, Bookings, Payments,
                        TaskBoard, Timeline, ThreadView, AvailabilityCalendar, ContractView, SignaturePad…
    planner/            couple-tool shell and registry cards
  store/db/             the backend, split by domain: core, quotes, projects, finance, gigs, chat, trust, planner
  services/             matching, pricing, risk, planner, quotes, documents (PDF), exporters (ICS/CSV/PDF)
  data/                 Nepal catalogue (cities with coordinates, services, ceremonies with BS months) + seed
    toolkit/            the 80 role tools: shared EntryList + hub, one folder per role
supabase/migrations/    0001 schema · 0002 RLS · 0003 matching, reliability, risk views · 0004 toolkits
```

**Backend.** Every store action matches one API endpoint.

The SQL in `supabase/migrations` covers the production design:
- enums and tables for every entity above;
- a trigger that freezes quote versions;
- a gist exclusion constraint that stops a freelancer being double-booked;
- triggers that block calendar slots and write audit entries;
- row-level security, with column grants so couples never see provider costs;
- `match_providers()`, `start_emergency_replacement()` and `recompute_reliability()`.

The migrations have **not** been applied to any Supabase project. They are checked on every change against an in-process Postgres (`npm run db:check`, `npm run db:test`, `npm run test:parity`), and the Edge Functions in `supabase/functions` (email sign-in codes, signed Cloudinary uploads, push and email fan-out) by `npm run test:functions`.

**Going live.** `docs/SETUP_SUPABASE.md` walks through a staging project: email-code sign-in for every role, Cloudinary uploads, private documents, notifications and scheduled jobs. Set `EXPO_PUBLIC_BACKEND=supabase` to switch the app over; the default stays the on-device demo. `docs/LAUNCH.md` then takes it to production: backups, monitoring, the web console on Cloudflare Pages, the legal pages and the Play Store release.

**Web-ready consoles.** `useLayout()` switches the role apps to sidebar navigation at 960 px and wider, so `npx expo start --web` gives the platform team a desktop dashboard.

**Production notes.** A few pieces are simulated in the demo:
- the OTP gateway;
- the payment gateways;
- media storage, which moves to Cloudinary and Google Drive in production;
- replies from unclaimed listings.

Contacts import and GPS check-in use Expo modules; they fall back gracefully where a module is unavailable.
