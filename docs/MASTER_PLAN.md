# Vivah master plan: persona-driven experience and a zero-cost production stack

| | |
|---|---|
| Status | Approved by the owner on 30 Sep 2026 (decisions in §17). P0 in progress |
| Date | 30 Sep 2026 |
| Scope | All four role apps, the backend, media, web deployment, operations |
| Constraints | Nepal only, NPR, Expo SDK 57, Supabase, Cloudinary, Vercel, free tiers for the first year |
| Companion docs | `AGENTS.md` (rules), `README.md` (product), `TEST_REPORT.md` (defects) |

---

## 0. Summary

Vivah today shows every user of a role the same app. A decorator gets the "Halls and capacity" tool, a DJ freelancer can add camera lenses, and a family planning a pasni is walked through a wedding. This plan fixes that with one idea:

> **Identify the user first, derive what they can do, and show only that.**
> Taxonomy (what they are) → capabilities (what they do) → surfaces (what they see).

Screens never ask "is this a photographer?". They ask `has('media.camera')`. Adding a new trade or a new occasion becomes a data change, not a screen change.

The second half of the plan takes the app from the on-device mock backend to production on a **$0 platform bill for year one**. It uses Supabase, Expo/EAS, Cloudinary, Vercel and 16 other free services, plus a small list of costs that no free tier can remove (app store fees, SMS, payment gateway fees).

Delivery is split into nine phases, each its own branch and pull request into `main`. The first five are invisible to existing users until switched on, and all of them keep the demo and the existing flows working (the prime directive in `AGENTS.md`).

---

## 1. Goals and principles

### Goals

1. Every user answers **one "who are you" question** in onboarding, and from then on sees only the tools, fields, copy and home content that fit them.
2. Customers can plan **any family occasion**, not only weddings: engagement, anniversary, baby shower, newborn ceremonies, bratabandha, birthdays and custom events.
3. Vendors and freelancers see **trade-specific** tools: a caterer gets a menu builder, a decorator gets a theme and rental inventory, a photographer gets gear and gallery delivery. Nobody sees another trade's fields.
4. Platform staff see a console shaped by their **job**: coordinator, finance, vendor success, support or admin.
5. Launch on real infrastructure with **no monthly platform bill** in year one, and a clear point at which each service should be upgraded.

### Principles

- **Ask once, early, briefly.** At most one or two extra onboarding screens. Everything is editable later.
- **Hide, don't disable.** A tool that doesn't apply is not shown. A deep link to it explains why and offers to add the service. There are no dead ends and no crashes.
- **Data, not branches.** Registries declare who they are for. Screens contain no `if (role === …) if (category === …)` chains.
- **Additive only.** New optional fields, new actions and new routes. Nothing existing is renamed or removed (`AGENTS.md` §6).
- **Server-enforced.** The UI hides; store actions, and later Postgres RLS, refuse. The client is never the only guard.
- **Free first, upgrade on evidence.** Every free service has a watched limit and a written upgrade trigger (§10).

---

## 2. Personas and taxonomy

Four role apps stay as they are (`customer`, `vendor`, `freelancer`, `platform`). Inside each role we add one level of identity.

### 2.1 Customer occasions

A new registry, `data/occasions.ts`, sits on top of the existing `EVENT_TYPES`.

| Occasion | Functions (`EventType`) | Default services | Planner modules shown | Hidden |
|---|---|---|---|---|
| Wedding | WEDDING, MEHENDI, HALDI, SANGEET, RECEPTION, ENGAGEMENT, PRE/POST_WEDDING | venue, catering, photography, videography, decoration, makeup, pandit, panche-baja | everything available today | nothing |
| Engagement (Sagai) | ENGAGEMENT | venue, catering, photography, decoration, makeup | guests, invitations, sait, outfits, gifts | janti, honeymoon, registry (optional) |
| Anniversary | ANNIVERSARY | venue, catering, photography, cake, dj | guests, invitations, surprise plan, trip planner | janti, samagri, sait |
| Baby shower (Godh bharai) | BABY_SHOWER | decoration, cake, photography, catering | guests, invitations, gift registry, games | janti, seating, honeymoon |
| Newborn | **NWARAN** (new), PASNI | pandit, photography, catering, decoration, cake | sait, samagri, guests, gift log, baby keepsakes | janti, honeymoon, website |
| Bratabandha | BRATABANDHA | pandit, venue, catering, photography, panche-baja | sait, samagri, guests, family duties | honeymoon, registry |
| Birthday | BIRTHDAY | venue, cake, decoration, photography, dj | guests, invitations, menu | janti, sait, samagri |
| Corporate | CORPORATE_EVENT | venue, catering, sound, led-screen, photography | guests, agenda, contacts | all family and ritual tools |
| Custom | OTHER | chosen by the customer | chosen by the customer | none by default |

Each `OccasionDef` declares:

```ts
interface OccasionDef {
  id: OccasionId;                      // 'wedding' | 'engagement' | 'anniversary' | 'baby_shower' | 'newborn' | 'bratabandha' | 'birthday' | 'corporate' | 'other'
  label: string;                       // 'Newborn ceremony'
  icon: IconName;
  eventTypes: EventType[];             // functions offered, first is the main one
  honourees: HonoureeSchema;           // couple names | baby name + DOB | person | organisation
  defaultServices: string[];           // SERVICES ids
  modules: PlannerModule[];            // 'guests' | 'seating' | 'website' | 'registry' | 'invitations' | 'janti' | 'sait' | ...
  onboarding: OnboardingStepId[];      // question sequence for this occasion
  vocab: Partial<Record<VocabKey, string>>; // 'eventDay' -> 'Pasni day', 'hosts' -> 'family'
  guestBands?: GuestBand[];            // smaller bands for intimate occasions
  budgetBands?: BudgetBand[];
  checklist: ChecklistTemplateId;
  ritual: boolean;                     // enables sait, samagri, pandit-first flows
}
```

Occasions are **data, not code**: the nine above are built-in defaults, and a super admin can add, edit, switch off or delete occasions from the operations console (permission `occasion.manage`). *Wedding* and *Something else* are fallbacks and cannot be deleted.

One customer account can hold **several celebrations** (a wedding now, a pasni in two years). The planner works on the *active* celebration, and a switcher sits at the top of "My celebration".

### 2.2 Provider trades (vendors and freelancers share one taxonomy)

The 38 services in `data/services.ts` stay the source of truth. They are grouped into 12 **trades**, which drive onboarding tiles and navigation grouping:

| Trade | Services |
|---|---|
| Venue | venue |
| Photo and film | photography, videography, drone, pre-wedding, live-streaming, photo-booth, album |
| Beauty | makeup, mehendi |
| Decor and floral | decoration, florist, lighting, tent-stage, furniture-rental |
| Catering and cake | catering, cake, bartending |
| Music and entertainment | dj, panche-baja, live-band, mc, choreographer |
| Sound, light and AV | sound, led-screen, generator |
| Fashion | bridal-wear, groom-wear, jewellery |
| Rituals | pandit |
| Transport and stay | transport, accommodation, security |
| Stationery and gifts | invitation, gifts |
| Planning | planner |

A vendor has a **primary service** plus any number of **add-on services** (a studio does photography, videography and drone; a decorator also does florist and lighting). A freelancer has a **primary skill** (crew role) plus secondary skills. Crew roles map to services through the existing `crew` lists, so a freelancer's trade is derived, not typed in twice.

### 2.3 Business form

| Form | Who | Effect |
|---|---|---|
| `venue` | party palaces, banquets, hotels | halls, capacity, site visits, in-house catering option |
| `studio` | team businesses with staff (photo studio, decor company, caterer) | team, staff roster, crew hiring, gigs |
| `shop` | fashion, jewellery, cards, gifts | catalogue, fittings, stock, delivery dates |
| `solo` | one-person businesses | no team or roster tools; simpler finance |

Freelancers are always `solo`.

### 2.4 Platform staff roles

The existing `StaffRole` values (`coordinator`, `admin`, `support`, `finance`, `super_admin`) and `PlatformTeam` values become the input to a permission matrix (§4.4). No new role values are needed. `Wedding Operations` and `Vendor Success` teams refine the home view.

---

## 3. The capability system

### 3.1 Capability catalogue

A capability is one atomic feature, namespaced by domain and typed as a string-literal union so a typo is a compile error.

| Domain | Capabilities | Granted by |
|---|---|---|
| core | `core.leads`, `core.quotes`, `core.bookings`, `core.calendar`, `core.finance`, `core.reviews`, `core.portfolio` | every vendor / freelancer |
| team | `team.members`, `team.roster`, `team.hire_crew` | form `venue` or `studio` |
| space | `space.halls`, `space.capacity`, `space.site_visits`, `space.in_house_catering` | venue |
| media | `media.camera`, `media.deliverables`, `media.gallery`, `media.card_backup`, `media.shot_list`, `media.editing_queue` | photo and film services |
| beauty | `beauty.trials`, `beauty.product_kit`, `beauty.looks` | makeup, mehendi |
| decor | `decor.themes`, `decor.rental_inventory`, `decor.setup_teardown`, `decor.suppliers` | decoration, florist, lighting, tent-stage, furniture-rental |
| food | `food.menu`, `food.per_plate`, `food.tastings`, `food.final_headcount` | catering, cake, bartending |
| music | `music.gear`, `music.requests`, `music.setlist` | dj, live-band, panche-baja, mc |
| av | `av.gear`, `av.power_load` | sound, led-screen, generator, lighting |
| fashion | `fashion.catalogue`, `fashion.fittings`, `fashion.rentals` | bridal-wear, groom-wear, jewellery |
| rituals | `rituals.muhurta`, `rituals.samagri` | pandit |
| logistics | `logistics.fleet`, `logistics.routes`, `logistics.rooms` | transport, accommodation, security |
| stationery | `stationery.proofs`, `stationery.print_runs` | invitation, gifts |

Each `ServiceDef` gains `capabilities: Capability[]`. A provider's capability set is the union over their services, plus the capabilities of their business form, plus `capsOverride` granted by an admin (beta tools, special cases).

Customers get capabilities from their occasion's `modules` (`plan.janti`, `plan.sait`, `plan.registry`, …). Staff get **permissions** instead (§4.4).

### 3.2 One rule shape for every surface

Every registry item that the UI renders gets an optional `when` rule. Items without `when` are universal.

```ts
interface When {
  capsAny?: Capability[];      // at least one
  capsAll?: Capability[];      // all of them
  occasions?: OccasionId[];    // customer only
  forms?: BusinessForm[];      // vendor only
  perms?: Permission[];        // platform only
  not?: When;                  // exclusions
}
```

This applies to:

- `ToolDef` (all 80 existing tools plus the new ones)
- sidebar links and tabs (`RoleTab`, `SidebarLink`)
- home widgets and setup checklist steps
- profile sections (equipment, halls, menu, looks)
- requirement fields in the plan wizard and quote line templates
- marketplace categories (ranking, §5.4)

### 3.3 The resolver

`services/experience.ts` is a pure function, with no React and no store imports, like the other services:

```ts
resolveExperience(input: PersonaInput): Experience

interface PersonaInput {
  role: UserRole;
  services?: string[];          // vendor
  primaryService?: string;
  businessForm?: BusinessForm;
  skills?: string[];            // freelancer
  primarySkill?: string;
  staffRole?: StaffRole;        // platform
  team?: PlatformTeam;
  occasion?: OccasionId;        // customer, from the active project
  capsOverride?: Capability[];
}

interface Experience {
  key: string;                  // stable hash of the input, used for caching
  caps: ReadonlySet<Capability>;
  perms: ReadonlySet<Permission>;
  vocab: Vocabulary;
  tabs: RoleTab[];
  links: SidebarLink[];
  tools: ToolDef[];             // filtered and grouped
  home: HomeWidgetId[];
  profileSections: ProfileSectionId[];
  setupSteps: SetupStep[];
  equipmentKinds: Equipment['kind'][];
  rateModel: 'day' | 'event' | 'hour' | 'plate' | 'package';
}
```

Inference makes old data work without a migration:

- `occasionOf(project)`: from `project.occasion`, else from `project.eventType`, else `wedding`.
- `servicesOf(account)`: from `account.services`, else from `categoryId` (`venues` → `venue`; a group id → that group's core services), else from `listingId` in the catalogue.
- `tradesOf(freelancer)`: from `primarySkill`/`skills` through the crew-role → service map.

### 3.4 Using it in the app

- **`useExperience()`** returns the resolved `Experience` for the signed-in account and active project. It is cached in a module-level map keyed by `experience.key`, so it always returns the **same reference** for the same persona (`AGENTS.md` layering rule 4). The React Compiler handles the rest.
- **`<Gate cap="media.camera">…</Gate>`** and **`<Gate perm="payout.release">`** render children only when allowed.
- **`can(actor, permission)`** and **`has(actor, capability)`** are used inside store actions. For example, `addHall` refuses without `space.halls`, and `releasePayable` refuses without `payout.release`.
- **Tool routes** (`/business/tool/[id]`, …) check `when` too. A gated tool shows a friendly empty state: "Halls are for venues. Add a venue service in Settings → Your services to use this."

### 3.5 Guarding the registries

A development-time check (run by the CI script, §13) walks every registry and fails when:

- an item references a capability, occasion or permission that does not exist;
- a vendor or freelancer tool has no `when` and is not listed as universal on purpose;
- any persona fixture ends up with an empty home or fewer than three tools.

---

## 4. Identify first: onboarding per role

### 4.1 Customer

1. **"What are we celebrating?"** Eight tiles (Wedding, Engagement, Anniversary, Baby shower, Newborn ceremony, Bratabandha, Birthday, Something else).
2. **Occasion-specific questions**, one per screen, using the existing `OnboardingFrame`:

| Occasion | Questions |
|---|---|
| Wedding | the current five questions, unchanged: who, date, city, guests, budget |
| Engagement | who, partner's name, date, city, guests, budget |
| Anniversary | whose anniversary, which year (1st, 25th, 50th…), date, style (intimate / party), guests, budget |
| Baby shower | parents' names, due month, date, city, guests, budget |
| Newborn | baby's name and date of birth, Nwaran or Pasni (both suggested by age), date (sait finder offered), city, guests, budget |
| Bratabandha | child's name, date (sait), city, guests, budget |
| Birthday / corporate / custom | who or what, date, city, guests, budget, then a service picker |

3. **Review card**, then "Build our plan" calls `submitPlan` with the occasion's `eventTypes`, `defaultServices` and `honourees`. "Just browse" saves the answers, as today.

"Plan another celebration" in Profile runs the same flow and adds a project. Existing customers are treated as `wedding`, so nothing changes for them.

### 4.2 Vendor

1. **"What does your business do?"** Twelve trade tiles with photos.
2. **"Which services do you offer?"** The trade's services are pre-checked (the core ones). Neighbouring services are offered below ("Decorators often also offer: florist, lighting, tent and stage").
3. **"How is your business set up?"** Business form and team size.
4. **Two or three trade essentials**, only the ones needed to go live:

| Trade | Essentials |
|---|---|
| Venue | halls with seated and floating capacity, in-house catering yes/no, parking |
| Photo and film | starting package price, delivery time, styles |
| Decor and floral | themes offered, coverage cities, setup lead time |
| Catering and cake | cuisines, minimum plates, veg/non-veg per-plate price |
| Music | gear owned, genres, set length |
| Beauty | looks offered, trial policy, travel charge |
| Fashion | rent or sell, fitting appointments, delivery lead time |
| Rituals | ceremonies performed, languages |
| Transport | fleet (vehicle type, seats) |

5. **Claim your listing** (the existing step), then PAN/VAT.

The vendor home shows a **setup checklist built from the trade** ("Add your halls" for venues, "Upload three portfolio albums" for studios, "Publish your menu" for caterers) until the profile is complete.

### 4.3 Freelancer

1. **"What's your craft?"** Primary skill tiles grouped by trade (Photographer, Videographer, Editor, Makeup artist, Mehendi artist, DJ, Musician, Decorator, Florist, Chef, Server, Driver, Light/sound technician, Coordinator…).
2. **Secondary skills**, filtered to the same trade plus close neighbours.
3. **Craft profile**, which replaces today's single generic form:

| Craft | Profile asks for | Rate model | Equipment kinds |
|---|---|---|---|
| Photographer / videographer | camera bodies, lenses, drone licence, editing turnaround | day or event | camera, lens, flash, drone, gimbal, light, audio |
| Editor | software, turnaround | per project | kit |
| Makeup / mehendi | product brands, hygiene practices, trial policy | per look / event | kit |
| DJ / musician | gear, genres, set length | event | audio, light |
| Decorator / florist | specialities, team they can bring | day | kit, vehicle |
| Chef / server / bartender | cuisines, hygiene certificate | day | none |
| Driver | vehicle, seats, licence | day | vehicle |
| Technician | gear, power handling | day | audio, light |

4. Day rate, travel radius and payout method, as today.

The gig feed only shows gigs whose crew role is in the freelancer's skills, which the matching code already mostly respects. It is made strict here.

### 4.4 Platform staff (RBAC)

Staff don't onboard with a trade. Their **staff role and team** decide what they see through a permission matrix, `data/permissions.ts`:

| Permission | coordinator | support | finance | admin | super_admin |
|---|---|---|---|---|---|
| `project.view_all` | own and team | yes | yes | yes | yes |
| `project.manage` (status, matching, quotes) | own | no | no | yes | yes |
| `quote.send` | own | no | no | yes | yes |
| `incident.manage`, `emergency.start` | yes | yes | no | yes | yes |
| `provider.verify` | no | vendor success only | no | yes | yes |
| `payment.record_cash`, `refund.approve` | no | no | yes | yes | yes |
| `payout.release`, `payout.batch` | no | no | yes | no | yes |
| `settings.edit` (rates, fees) | no | no | no | yes | yes |
| `user.suspend`, `staff.manage` | no | no | no | yes | yes |
| `broadcast.send` | no | yes | no | yes | yes |
| `audit.view` | no | no | yes | yes | yes |
| `demo.reset` | no | no | no | yes | yes |

Each staff role gets its own **Today** view:

| Role | Today |
|---|---|
| Coordinator | my weddings this week, SLA breaches, today's run sheets, clarifications waiting |
| Support | open helpdesk tickets, incidents, reply macros |
| Vendor success | verification queue, recruitment pipeline, scorecards, city supply gaps |
| Finance | payouts ready, refunds, disputes, cash-flow forecast, overdue milestones |
| Admin | platform health, approvals, settings, audit |

A **segment filter** (occasion × trade × city) sits on every list in the console, so Vendor Success can open "decorators in Pokhara" and a coordinator can open "pasni projects this month".

---

## 5. What each persona sees

### 5.1 Vendor tools (existing 20)

| Tool | Shown to |
|---|---|
| Saved replies, Follow-ups, Reply-time goal, Cancellation policy, Hours and away message, Price calculator, Market benchmark, Referral partners, Monthly goals, Expenses, Profit and loss, VAT and tax, Event prep checklists, Team tasks | every vendor |
| Site visits | venue, catering, decor, fashion. The label changes per trade: "Site visits", "Tastings", "Design meetings", "Fittings". |
| Gift vouchers | venue, beauty, photo studios |
| Staff roster | form `venue` or `studio` |
| Inventory and equipment | decor, AV, photo, tent and furniture, with starter items per trade |
| Suppliers | decor, catering, venue |
| Halls and capacity | venue only |

### 5.2 New trade tools (built on `EntryList` and `toolEntries`, so no new persisted keys)

| Tool id | Trade | What it does |
|---|---|---|
| `vendor.menu` | catering, cake | menu builder with per-plate costing, veg and non-veg sets, and a menu shared into the quote |
| `vendor.tastings` | catering, cake | tasting appointments linked to leads |
| `vendor.themes` | decor | theme catalogue with photos, price bands and included items |
| `vendor.rentals` | decor, furniture, tent | rental stock reserved per event date, with damage and return tracking |
| `vendor.setup` | decor, AV, tent | setup and teardown sheet per booking: crew, vehicle, access time |
| `vendor.gallery` | photo and film | delivery tracker with a proofing link, selections and revision rounds (reads `deliverables`) |
| `vendor.shotlists` | photo and film | reads the couple's `couple.shots` for each booking |
| `vendor.trials` | beauty | trial scheduler and looks book |
| `vendor.requests` | music | song requests and a do-not-play list (reads `couple.music`) |
| `vendor.power` | AV, music, lighting | power load planner that suggests generator size |
| `vendor.fleet` | transport | vehicles, drivers, routes per event |
| `vendor.fittings` | fashion | measurements, fittings and alteration dates |
| `vendor.muhurta` | rituals | muhurta slots and samagri lists per ceremony |

### 5.3 Freelancer tools

| Tool | Shown to |
|---|---|
| This week, Open dates, Travel planner, Health and safety, Work diary, Rate calculator, Private invoices, Expenses and mileage, Income tax estimate, Earnings goal, Savings pots, Pitch builder, Reliability coach, Clients and organisers, Crew network, Skills and certificates | every freelancer |
| Gear checklist, Gear care and insurance | crafts with equipment (photo, video, DJ, AV, drivers for vehicle care) |
| Card backup log | photo and video |
| Edits and deliveries | photo, video, editor, design |
| New: `freelancer.kit` (products, expiry, hygiene log) | makeup, mehendi |
| New: `freelancer.setlist` | DJ, musician |
| New: `freelancer.vehicle` (fuel, service, documents) | driver |

### 5.4 Customer surfaces

| Surface | Rule |
|---|---|
| Janti planner, Honeymoon planner | wedding |
| Outfits and jewellery | wedding, engagement |
| Sait finder, Puja samagri, Tips and dakshina | occasions with `ritual: true` |
| Guest rooms, Pickups | when guests > 150 or out-of-town guests are marked |
| Seating | wedding, anniversary, corporate, custom |
| Wedding website / event page | wedding, engagement, anniversary (renamed "Event page" outside weddings) |
| Registry | wedding, baby shower |
| New: Baby keepsakes (first rice, weight, gifts from relatives) | newborn |
| New: Surprise plan | anniversary |
| New: Games and activities | baby shower, birthday |
| Photo shot list, Music, Menu, Shagun and gifts, Contacts, My day, Vendor meetings, What-if budget, Savings goal, Emergency kit, Weather | every occasion |

**Marketplace (owner decision).** For a non-wedding occasion, the marketplace shows **only the categories related to it** (the occasion's `services` list). Unrelated categories are hidden, not ranked lower. A super admin edits each occasion's list, so a family that needs a DJ at a pasni is handled by adding DJ to Newborn's services.

**Copy.** `vocab` replaces fixed words: "My wedding" becomes "My celebration" or "Pasni plan", "couple" becomes "family", and "wedding day" becomes the occasion's day. The role accent colours and the design rules in `AGENTS.md` §8 stay as they are.

### 5.5 Navigation

- **Vendor sidebar:** Packages, Portfolio and Promotions for everyone. "Hire crew" only with `team.hire_crew`. "Team" only for `venue`/`studio`. New trade links appear under a heading for the trade ("Catering: Menu, Tastings").
- **Freelancer tabs:** unchanged. The profile tab shows craft sections only.
- **Platform tabs and "More":** filtered by permissions. Finance does not see the leads kanban as a tab; support does not see payouts.

---

## 6. Data model changes (additive)

### 6.1 TypeScript

```ts
// types/persona.ts (new)
export type OccasionId = 'wedding' | 'engagement' | 'anniversary' | 'baby_shower' | 'newborn' | 'bratabandha' | 'birthday' | 'corporate' | 'other';
export type BusinessForm = 'venue' | 'studio' | 'shop' | 'solo';
export type Capability = /* union generated from the catalogue in §3.1 */;
export type Permission = /* union from §4.4 */;

// types/platform.ts (optional fields only)
interface Account {
  services?: string[];
  primaryService?: string;
  businessForm?: BusinessForm;
  teamSize?: number;
  primarySkill?: string;
  capsOverride?: Capability[];
  personaConfirmedAt?: string;   // set when the user confirms inferred services
}
interface Project {
  occasion?: OccasionId;
  honourees?: { kind: 'couple' | 'baby' | 'person' | 'org'; names: string[]; dob?: string; years?: number };
}
type EventType = /* existing values */ | 'NWARAN';
```

No persisted-data migration is needed, because every new field is optional and the resolver infers from existing data (§3.3). The store `version` does not change.

### 6.2 Seed and demo

- The six existing demo accounts keep their ids, phones and stories. They get explicit persona fields that match what inference would produce.
- Three new demo accounts:
  - **Decor vendor:** "Phoolbari Decor, Lalitpur", form `studio`, services decoration, florist, lighting.
  - **DJ freelancer:** "DJ Suman", primary skill DJ, with gear and a setlist.
  - **Newborn family:** a pasni project in Bhaktapur, with the sait finder and a gift log.
- "Reset demo data" restores all nine.

### 6.3 SQL migration `0005_personas.sql`

- Reference tables: `occasions`, `capabilities`, `service_capabilities(service_id, capability)`.
- `provider_services(provider_id, service_id, is_primary)` with a unique partial index on `is_primary`.
- `freelancer_skills(freelancer_id, skill, is_primary)`.
- `projects.occasion`, `projects.honourees jsonb`, `accounts.business_form`, `accounts.caps_override text[]`.
- `staff_permissions(staff_role, permission)`, seeded from §4.4.
- Functions: `has_capability(uid, cap)` and `has_permission(uid, perm)`, `stable security definer set search_path = public`, used inside RLS policies.
- RLS on every new table. Reference tables are read-only to `authenticated`.
- `NWARAN` added to the event type enum (`alter type … add value`).

---

## 7. Production architecture

### 7.1 Overview

```
 Expo app (iOS / Android)        Web (expo export → Vercel)
  couple · vendor · freelancer    public pages /w/[slug], /rsvp/[code]
  platform console                platform console (wide layout)
            │                                   │
            └──────────────┬────────────────────┘
                           │  supabase-js (PostgREST, Realtime, Storage, Auth)
                           ▼
 ┌──────────────────────── Supabase ────────────────────────────┐
 │ Postgres 17: schema 0001–0005, RLS, RPC functions (the       │
 │ "store actions"), pg_cron, pg_trgm full-text, pgvector later │
 │ Auth: phone OTP (SMS hook), email OTP, Google                │
 │ Realtime: chat, notifications, run sheet, control room       │
 │ Storage (private): KYC documents, contracts, invoices (PDF)  │
 │ Edge Functions: payments, media signing, push/email fan-out, │
 │ SMS hook, webhooks                                           │
 └──────────────────────────────────────────────────────────────┘
      │             │              │              │
  Cloudinary    Khalti/eSewa   Expo Push+FCM   Resend email
  (images,      (payments)     (push)          Upstash (rate
  video)                                       limit, jobs)
```

### 7.2 From mock backend to Supabase without breaking the demo

The zustand store actions are already shaped as one use case each, which `AGENTS.md` calls "the API". We keep their names and signatures and put a **repository layer** behind them:

```
screens → store actions (unchanged API) → repository interface
                                            ├─ MockRepository (today's on-device logic, demo mode)
                                            └─ SupabaseRepository (RPC calls)
```

- `EXPO_PUBLIC_BACKEND=mock | supabase` picks the adapter. The demo, Expo Go development and the existing six-role smoke test keep working on `mock`.
- Each state-changing action becomes a **Postgres function** (RPC, `security definer`, permission-checked), for example `rpc('send_quote', { quote_id })`. Money rules, status transitions and side effects (audit, notifications, payables) move into SQL. The TypeScript versions in `services/` stay as the reference implementation, and a parity test runs both on the same fixtures.
- Reads use React Query (already installed) with selective Realtime subscriptions, and the cache persisted to AsyncStorage for offline reading on venue Wi-Fi.
- The known SQL defects in `AGENTS.md` §10 (non-`security definer` triggers, over-broad RLS updates, quote-freeze bypass, uncapped refunds) are fixed **before** the first deploy, not after.

### 7.3 Auth

- **Supabase Auth, email only for year one (owner decision).** Every role signs in with email OTP (magic code), which is free. Google sign-in can be added at no cost. The phone number is still collected and shown for contact and payouts, but it is not verified by SMS.
- **After about a year**, add phone OTP for vendors, freelancers and staff through the Send SMS hook and a Nepali gateway (Sparrow SMS or Aakash SMS, about NPR 1.4 per SMS). The auth code keeps a provider seam so this is a configuration change.
- A **custom access token hook** puts `role`, `staff_role` and `persona_key` into the JWT, so RLS and the app read them without extra queries.
- Staff sign-up keeps the access-code gate and adds admin approval.

### 7.4 Media (Cloudinary + Supabase Storage)

| Content | Where | Why |
|---|---|---|
| Portfolio, listing photos, idea boards, wedding website photos, gallery proofs | Cloudinary | transformations, CDN, `f_auto,q_auto`, responsive sizes |
| Short videos (highlights, reels) | Cloudinary (with length and size limits) | adaptive streaming |
| KYC and verification documents, contracts, invoices | Supabase Storage, private bucket, RLS | personal data must not sit on a public CDN |

- Uploads are **signed**: an Edge Function returns a signature for an upload preset per purpose (`portfolio`, `gallery`, `avatar`), with a folder per owner, a max size and allowed formats.
- Postgres stores only `public_id`, dimensions and a blur hash. The app builds URLs with a small helper and **named transformations** (`t_card`, `t_thumb`, `t_hero`), which keeps the transformation count, and so credit use, predictable.
- `expo-image` disk caching cuts repeat bandwidth.

### 7.5 Payments (Khalti, eSewa, Fonepay later)

1. The app calls Edge Function `payment-initiate(milestone_id, method)`. It computes the amount server-side from the milestone, never from the client.
2. The user pays in the Khalti or eSewa flow (web view or deep link).
3. The callback hits `payment-verify`, which calls the gateway's lookup or verify API with the secret key (eSewa v2 HMAC signature, Khalti ePayment lookup).
4. Only a verified payment calls `rpc('record_payment')`, which is idempotent on the gateway transaction id.

Both gateways are integrated and tested in their free sandboxes. Going live needs merchant registration (§9).

### 7.6 Notifications and jobs

- Inserting a row into `notifications` triggers a database webhook → Edge Function `notify-fanout`, which sends Expo push and/or Resend email according to `prefs.channels`. `emergency` always rings, as today.
- **pg_cron** (free inside Supabase) runs: milestone status sweep (DUE/OVERDUE), payable readiness (event − 7 days / event + 3 days), reminder digests, lead SLA alerts, and deleting expired OTP and draft rows.
- **Upstash QStash** handles one-off delayed HTTP jobs, such as "remind the couple 15 days before the 50% milestone".
- **Upstash Redis** rate-limits OTP sends, enquiries and RSVP submissions.

### 7.7 Web on Vercel

- `npx expo export -p web` produces the static build. Vercel serves it with SPA rewrites (`app.json` already has `web.output: "single"`).
- Preview deployments are created for every pull request. Production follows `main`.
- Public pages (`/w/[slug]`, `/rsvp/[code]`) get Open Graph tags. Later, switching Expo Router to server or static output for those routes improves SEO; check the SDK 57 docs before doing this.
- **Important licence note: Vercel's free Hobby plan is for non-commercial use only.** A marketplace that takes payments is commercial, and Vercel enforces this. **Owner decision: everything stays free.**
  - **Before launch:** Vercel Hobby for development and pull request previews.
  - **At commercial launch:** production web moves to **Cloudflare Pages** (free, commercial use allowed, unlimited static bandwidth). The build is identical, so switching takes about an hour. Vercel Pro is not used.

### 7.8 Expo Go versus production builds

`AGENTS.md` requires everything to run in Expo Go, which stays true for development and the demo. Production needs a few things Expo Go cannot provide:

- remote push notifications on Android (not supported in Expo Go since SDK 53);
- native crash reporting (Sentry);
- custom app icon and splash, deep-link domains and store builds.

Plan (owner left the choice to us; this is the recommended option): keep **Expo Go + mock backend** as the development and demo path. Add an **EAS development build** profile (free builds) for testing production-only features. Ship store builds from EAS. Library additions still go through `npx expo install`, and anything native is added only to the development and production profiles, with owner approval (§17).

---

## 8. The free stack: top 20 services for year one

Limits are as published in September 2026 and should be re-checked at sign-up. "Watch" is the limit most likely to bite first.

| # | Service | Used for | Free allowance | Watch |
|---|---|---|---|---|
| 1 | **Supabase** | Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron | 500 MB database, 1 GB storage, 50,000 MAU, 5 GB egress, 500k Edge Function calls, 200 Realtime connections, 2 projects | pauses after 7 days idle; no backups on free |
| 2 | **Expo SDK + Expo Go** | the app, development and demo | free, open source | Expo Go limits (push, native modules) |
| 3 | **EAS Build / Submit / Update** | store builds, over-the-air updates | 15 Android + 15 iOS builds per month; EAS Update for 1,000 MAU | Update MAU once live |
| 4 | **Expo Push Service + Firebase Cloud Messaging** | push to iOS and Android | free, no per-message charge; 600 notifications/s per project | batch 100 per request |
| 5 | **Vercel** | web app, PR previews | Hobby: free, **non-commercial only** | switch to Pro or Cloudflare Pages at launch |
| 6 | **Cloudinary** | images and short video | 25 credits per month (1 credit = 1 GB storage, 1 GB bandwidth or 1,000 transformations) | bandwidth from portfolio browsing |
| 7 | **Cloudflare** (DNS, CDN, WAF, Turnstile) | domain DNS, DDoS protection, bot checks on public forms | free plan | none at this scale |
| 8 | **Cloudflare R2** | nightly encrypted database backups, CSV exports | 10 GB storage, no egress fees | backup retention |
| 9 | **Cloudflare Pages** | commercial-safe fallback for the web build | unlimited static bandwidth, 500 builds per month, commercial use allowed | Functions limited to 100k requests/day |
| 10 | **GitHub + Actions** | code, pull requests, CI, cron (keep-alive, backups), Dependabot | Actions 2,000 minutes per month on private repos | CI minutes |
| 11 | **PostHog** | product analytics, feature flags (persona rollout), session replay, surveys, JS error tracking | 1M events, 5,000 web and 2,500 mobile replays, 1M flag requests, 100k exceptions per month | mobile replays |
| 12 | **Sentry** | native crash reporting and performance in production builds | 5,000 errors, 10k performance units, 50 replays per month, 1 user | 1 seat |
| 13 | **Resend** (+ React Email) | transactional email: OTP fallback, quotes, receipts, invitations | 3,000 emails per month, 100 per day | daily cap during invitation bursts |
| 14 | **Upstash Redis + QStash** | rate limiting, OTP throttling, delayed jobs | 256 MB, 500k commands per month; QStash 1,000 messages per day | commands if used for caching |
| 15 | **Better Stack** | uptime monitors, public status page, incident alerts | 10 monitors, 1 status page, 3-minute checks | check interval |
| 16 | **Google Maps Platform** | venue maps, geocoding, place autocomplete, travel distance for freelancers | 10,000 free calls per Essentials SKU per month | autocomplete; cache geocodes in Postgres |
| 17 | **MET Norway Locationforecast API** | the couple's weather and season tool | free, commercial use allowed with attribution and a proper User-Agent | cache per city per hour |
| 18 | **Khalti and eSewa sandboxes** | payment integration and testing | free test merchants and keys | live needs merchant registration |
| 19 | **Maestro** (open-source CLI) | end-to-end tests of the four role flows on Android emulators and in CI | free CLI (the cloud service is paid) | runtime on CI minutes |
| 20 | **Google Search Console + Bing Webmaster Tools** | indexing the public wedding and event pages, vendor listing pages | free | none |

Also free and used without a separate account: Supabase `pg_trgm` full-text search (no Algolia needed), OpenStreetMap/Nominatim as a low-volume geocoding fallback, Figma and Google Stitch for design, and Nepali date conversion done locally in code.

---

## 9. Costs no free tier removes (year one)

| Item | Cost | How to minimise |
|---|---|---|
| Apple Developer Program | USD 99 per year | needed only for the iOS App Store; Android can launch first |
| Google Play Console | USD 25, once | none |
| SMS OTP (Sparrow SMS / Aakash SMS) | NPR 0 in year one (email OTP only); about NPR 1.4 per SMS once added | owner decision: email only for the first year, then phone OTP for providers and staff; Redis rate limit |
| Payment gateway fees | about 1–2% per transaction; eSewa reports a one-time setup fee of roughly NPR 20,000–30,000 | pass through in the service fee; start with Khalti, add eSewa when volume justifies it |
| Domain | `.com.np` is free for Nepali entities through Mercantile's registry; a `.com` is about USD 10–15 per year | use `vivah.com.np` |
| Vercel Pro | not used | production web on Cloudflare Pages ($0), owner decision |
| WhatsApp Business API | Meta bills per message, and in-window service messages become billable from October 2026 | not in year one; push, email and SMS cover it |

**Minimum year-one cash cost:** about USD 124 (both app stores) plus payment gateway fees that scale with usage. There is no SMS cost in year one, and every platform service is on a free tier.

---

## 10. Free-tier capacity budget and guardrails

### 10.1 Will year one fit?

Planning assumption for year one: 3,000 projects, 1,500 providers, 800 freelancers, 20,000 MAU.

| Resource | Estimate | Limit | Guardrail |
|---|---|---|---|
| Postgres size | projects with events, tasks and timeline ≈ 150 MB; messages ≈ 120 MB; audit and notifications (capped) ≈ 40 MB; catalogue ≈ 20 MB | 500 MB | archive closed projects older than 12 months to R2 as JSON; keep notifications capped at 300 per account |
| Supabase Storage | KYC and contract PDFs ≈ 400 MB | 1 GB | compress scans to under 500 KB; no images here |
| Supabase egress | JSON only, paginated, cached by React Query ≈ 2–3 GB | 5 GB | no images through Supabase; select only needed columns |
| Realtime connections | subscribe only on open chat, run sheet and control room screens | 200 concurrent | unsubscribe on blur; no global subscriptions |
| Cloudinary | 8 GB stored (about 25,000 photos at 300 KB), 15 GB delivered (about 250,000 thumbnail views), 2,000 transformations | 25 credits | resize on upload (max 2,400 px), named transformations only, `expo-image` cache |
| Email | receipts, quotes, digests ≈ 2,000 per month | 3,000 per month, 100 per day | queue invitation bursts over days; push first |
| EAS Update | 1,000 MAU on free | 1,000 | plan the first paid upgrade here, or ship updates through store builds |

### 10.2 Free-tier risks handled in the design

- **Supabase pauses idle free projects after 7 days.** A GitHub Actions cron calls a health RPC every day. Real traffic keeps it awake once live.
- **No backups on Supabase free.** A nightly GitHub Action runs `pg_dump`, encrypts the dump with `age` and uploads it to R2 (30 daily + 12 monthly copies). A restore is rehearsed every quarter.
- **Two free Supabase projects** are used as **staging** and **production**. Local Docker-based Supabase is avoided because the development machine has little RAM.
- **Upgrade triggers** (move to paid when any one is reached, not before):

| Service | Trigger |
|---|---|
| Supabase Pro ($25/month) | database over 400 MB, a need for point-in-time recovery, or more than 150 concurrent Realtime connections at peak |
| Cloudinary Plus | two consecutive months over 20 credits |
| EAS Starter ($19/month) | Update MAU over 900 |
| Resend Pro | more than 80 emails per day on 5 days in a month |
| Sentry Team | a second engineer needs access |
| Vercel Pro | not planned: production web runs on Cloudflare Pages |

---

## 11. Security and privacy

- **RLS on every table** with policies written per role. Couples never see provider cost, margin or internal signals (invariant 14), enforced by the existing `quote_items_public` and `service_bookings_customer` views and column grants.
- **Every money and status change is an RPC**, `security definer`, permission-checked with `has_permission()`/`has_capability()`, idempotent, and writes `audit_log`.
- **Secrets** live in Supabase secrets, EAS environment variables and Vercel/Cloudflare environment variables. There are no secrets in the app bundle; `EXPO_PUBLIC_*` holds only public keys.
- **Payments** are verified server-side against the gateway before anything is recorded (§7.5).
- **Uploads** are signed with size, type and folder limits. KYC documents are private with short-lived signed URLs.
- **Bots:** Cloudflare Turnstile on public forms (RSVP, enquiry, sign-up on web). Upstash rate limits on OTP and enquiries.
- **Personal data:** phone numbers are masked between parties until a booking is confirmed; users can export and delete their data; retention rules apply to KYC documents after verification.
- **Dependencies:** Dependabot and `npx expo-doctor` in CI; `npx expo install` only.

---

## 12. Performance and scalability

- **The persona resolver** is a single pass over static registries, memoised by persona key. It adds no re-renders, and selectors keep stable references.
- **Adding a trade** means one `ServiceDef` with `capabilities`, plus optional trade tools. **Adding an occasion** means one `OccasionDef`. No screen code changes in either case.
- **Tool screens** are only loaded when opened, through the dynamic `/tool/[id]` routes.
- **Lists** are paginated with keyset pagination on `(created_at, id)`. Wide lists on the web console are virtualised.
- **Images** are served at the size displayed (`w_` from the layout width), in AVIF/WebP via `f_auto`, with blur-hash placeholders.
- **Database:** indexes on every foreign key and status column used by RLS or lists. Matching runs as one SQL function per requirement, not per candidate from the client.
- **Future:** the same `resolveExperience` can run in an Edge Function to target push notifications, route leads to providers by capability, and personalise email digests. Feature flags in PostHog roll persona features out gradually (for example, 10% of vendors first).

---

## 13. DevOps: environments, CI and releases

| Environment | Backend | App | Web |
|---|---|---|---|
| Demo / development | mock (on-device) | Expo Go | `npx expo start --web` |
| Staging | Supabase project 1 | EAS development build, `preview` update channel | Vercel preview per pull request |
| Production | Supabase project 2 | store builds, `production` update channel | Vercel (or Cloudflare Pages) on `main` |

**CI on every pull request (GitHub Actions):**

1. `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`
2. Registry check and **persona matrix** (§3.5): resolve every fixture persona and compare against a checked-in expected matrix, so a change that hides a tool from the wrong trade fails the build.
3. Service parity tests: the TypeScript services and SQL functions produce the same quote totals, milestones, splits and payables on shared fixtures.
4. `supabase db lint` and migrations applied to a throwaway branch or staging.
5. Maestro end-to-end flows for the four roles against the mock backend, run nightly to save minutes.
6. Vercel preview deploy.

**Releases:**

- **Database:** migrations go to staging when a pull request merges, and to production on a release tag after a backup.
- **App:** JavaScript-only changes ship through EAS Update (staged rollout); native changes go through store builds.
- **Web:** follows `main`.

The branch and pull-request rules in `AGENTS.md` §9 apply to all of this.

---

## 14. Observability

| Signal | Tool |
|---|---|
| Product analytics, funnels per persona (for example, onboarding completion by trade) | PostHog, with `persona_key`, `role`, `trade`, `occasion` as properties |
| Feature rollout | PostHog feature flags |
| JavaScript errors in development and Expo Go | PostHog exceptions |
| Native crashes and performance in production builds | Sentry |
| API and database logs, slow queries | Supabase logs and advisors |
| Uptime and public status page | Better Stack |
| Business health | the existing platform analytics and toolkit (SLA monitor, funnel, cash-flow), now on live data |

Alerts go to email and push for the on-call coordinator (the existing on-call roster tool).

---

## 15. Roadmap

Each phase is a branch cut from the latest `main` and one pull request into `main`. Sizes are relative (S ≈ a few days, M ≈ one to two weeks, L ≈ two to three weeks for one developer with AI assistance).

| Phase | Scope | Size | Done when |
|---|---|---|---|
| **P0 Persona foundation** | `types/persona.ts`, capabilities on `ServiceDef`, `data/occasions.ts`, `data/permissions.ts`, `resolveExperience`, inference, `useExperience`, `<Gate>`, `when` on all 80 tools, registry check, persona matrix fixtures | M | no visible change; the matrix passes; the six demo accounts behave exactly as before |
| **P1 Vendor trades** | trade onboarding, setup checklist, filtered tools/sidebar/home/profile/packages, per-trade labels, 13 trade tools, "Your services" settings, decor demo account | L | each trade fixture sees only its tools; claiming a listing still works; Everest and Wedding Story unchanged |
| **P2 Freelancer crafts** | craft step, craft profiles, equipment kinds and rate model per craft, gated tools, 3 new tools, strict gig feed, DJ demo | M | a DJ never sees camera fields; a photographer's flow is unchanged |
| **P3 Customer occasions** | occasion step and flows, `NWARAN`, honourees, vocabulary, module gating, celebration switcher, marketplace ranking, 3 new tools, newborn demo | L | the wedding flow is unchanged; a pasni plan builds, quotes and pays end to end |
| **P4 Platform RBAC** | permission matrix, guarded actions, Today view per role, segment filter | M | each staff role sees and can do only what the matrix allows; admin demo unchanged |
| **P5 Backend foundation** | SQL defect fixes from `AGENTS.md` §10, `0005_personas.sql`, RPC functions for every store action, repository layer, `EXPO_PUBLIC_BACKEND` switch, staging project, parity tests | L | the full core loop (§5 of `AGENTS.md`) passes on staging with RLS on |
| **P6 Auth, media, notifications** | Supabase Auth with SMS hook, email OTP and Google; Cloudinary signed uploads and named transformations; private documents bucket; notification fan-out; pg_cron jobs; Upstash rate limits | L | sign-up for all roles on staging; portfolio upload and display; push and email arrive by preference |
| **P7 Payments** | Khalti then eSewa: initiate, verify and record through Edge Functions, sandbox end to end, receipts | M | sandbox payments reconcile to milestones; duplicate callbacks are ignored |
| **P8 Launch** | production project, backups to R2, keep-alive, Sentry and PostHog in builds, Better Stack status page, Vercel/Cloudflare web, Search Console, EAS store builds, privacy policy and terms | M | Android public release; web console live; restore rehearsal passed |

P0 to P4 need no backend work and can start now. P5 can run in parallel in another worktree after P0 lands, because it depends only on the persona types.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The brand "Vivah" means wedding, which may confuse non-wedding customers | keep the brand for now and use "celebration" in copy for other occasions; the owner plans a rebrand later, so new copy takes the name from `BRAND.name` in `constants/brand.ts` (about 57 files still hard-code it and move over as they are touched) (§17) |
| Inferred vendor services are only a guess, since today's `categoryId` is group-level | a one-time "Confirm your services" card on the vendor home; `personaConfirmedAt` records it |
| Hiding tools confuses existing users who used them | tools a user already has entries in stay visible for them (checked through `toolEntries`) |
| Free-tier limits hit sooner than expected | the guardrails and triggers in §10; PostHog and Supabase usage dashboards reviewed monthly |
| Vercel Hobby commercial clause | Cloudflare Pages ready as a $0 alternative (§7.7) |
| Expo Go cannot run production-only features | development builds for those features; Expo Go remains the development and demo path (§7.8) |
| Logic drifts between the TypeScript mock and SQL | parity tests in CI (§13) |
| SMS cost grows with sign-ups | none in year one (email OTP only); later, phone OTP only where trust needs it, with rate limits |

---

## 17. Owner decisions (30 Sep 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Multi-trade vendors | **Yes.** One primary service plus any number of add-on services, from any trade. |
| 2 | Occasion list | **The nine in §2.1 are right.** Super admins can also add, edit and delete occasions from the console (`occasion.manage`). |
| 3 | Marketplace for non-wedding occasions | **Show only the related categories**; unrelated ones are hidden (§5.4). |
| 4 | Brand | **Keep "Vivah" for now**; a rebrand is planned later. |
| 5 | Web hosting at commercial launch | **All free:** Cloudflare Pages for production, Vercel Hobby for previews only. |
| 6 | Expo Go rule | Left to us: **EAS development build** for production-only features, Expo Go stays the development and demo path (§7.8). |
| 7 | SMS | **Email OTP only for the first year** (free). Phone OTP through a Nepali SMS gateway after about a year. |
| 8 | Start | **P0, then P1** (vendors first). |

## 18. Sources for the free-tier figures

- Supabase pricing: https://supabase.com/pricing
- Vercel Hobby plan and fair use: https://vercel.com/docs/plans/hobby, https://vercel.com/docs/limits/fair-use-guidelines
- Cloudinary plans: https://cloudinary.com/pricing, https://cloudinary.com/documentation/billing_and_plans
- Expo plans and push: https://docs.expo.dev/billing/plans/, https://docs.expo.dev/push-notifications/faq/
- Resend free tier: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- PostHog pricing: https://posthog.com/pricing, https://flexprice.io/blog/posthog-pricing-guide
- Sentry free plan: https://sentry.io/pricing/, https://sentrypricing.com/free-plan
- Upstash pricing: https://upstash.com/pricing/redis
- Cloudflare R2 and Pages: https://developers.cloudflare.com/r2/pricing/, https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026
- Better Stack status pages: https://betterstack.com/status-page
- Google Maps Platform free usage: https://mapsplatform.google.com/pricing/
- WhatsApp API pricing changes: https://respond.io/blog/whatsapp-business-api-pricing, https://blog.peppercloud.com/whatsapp-api-pricing-everything-you-need-to-know/
- Nepal payment gateways: https://paybridgenp.com/blog/esewa-charges-fees-nepal, https://paybridgenp.com/blog/khalti-merchant-account-guide
- Nepal SMS gateways: https://sparrowsms.com/services/sms-gateway-api/, https://www.webtechnepal.com/best-bulk-sms-service-provider-in-nepal/
