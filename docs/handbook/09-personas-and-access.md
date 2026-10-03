# 09. Personas and access

Every user has a role (customer, vendor, freelancer, platform). Inside the role, the **persona** decides what they see. A photographer never sees catering tools; a pasni family never sees bridal makeup; a finance officer never sees the leads kanban.

Background: [`docs/MASTER_PLAN.md`](../MASTER_PLAN.md) §2–§5. Rules: R-PER-1 … R-PER-6 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

## 1. The model: taxonomy → capabilities → surfaces

```
what the user IS            what they CAN do                 what they SEE
(taxonomy)          ──►     (capabilities, permissions) ──►  (tools, tabs, links, widgets, screens)

customer: occasion           plan.<module>                    planning tools, marketplace categories
vendor: services + form      media.camera, food.menu, …       business tools, sidebar, setup steps
freelancer: skills → craft   (from the services of skills)    freelancer tools, gig feed, profile fields
staff: staff role + team     project.manage, payout.release…  console tabs, screens, Today focus
```

| Role | Identity | Stored in | Registry |
|---|---|---|---|
| customer | the **occasion** of the active project | `Project.occasion`; catalogue in `DbData.occasions` | `src/data/occasions.ts` (`BUILT_IN_OCCASIONS`) |
| vendor | **services** (a primary plus any add-ons, from any trade) and a **business form** (`venue`, `studio`, `shop`, `solo`) | `Account.services`, `primaryService`, `businessForm`, `tradeProfile` | `src/data/services.ts`, `src/data/trades.ts` |
| freelancer | **skills** (crew roles) with a `primarySkill`; the **craft** follows from the primary skill | `Account.skills`, `primarySkill`, `tradeProfile` | `src/data/crafts.ts`, `src/data/skills.ts` |
| platform | **staff role** (`coordinator`, `support`, `finance`, `admin`, `super_admin`) and **team** | `Account.staffRole`, `team` | `src/data/permissions.ts` |

Capabilities are listed in `src/data/capabilities.ts` (`PROVIDER_CAPABILITIES`, `PLANNER_MODULES` → `plan.<module>`). Services grant capabilities through `SERVICE_CAPABILITIES` (`data/trades.ts`); business forms add `FORM_CAPABILITIES`; every vendor gets `CORE_CAPABILITIES`. Occasions grant planner modules.

## 2. The resolver (`services/experience.ts`)

- `experienceFor(account, { project, occasions })` → `Experience` (role, caps, perms, occasion, trade, craft, rate model, equipment kinds, vocabulary, `inferred`).
- `useExperience()` (`hooks/useExperience.ts`) gives it to components. The result is cached by input, so the same persona returns the same object; it is safe in render and in selectors.
- Pure and deterministic: no React, no store.
- **Infer, don't migrate:** missing fields are inferred: vendor services from the listing or `categoryId`; form `venue` for venues, `studio` otherwise (keeps every tool); occasion from `project.eventType`, else `wedding`. `Experience.inferred` stays true until the user confirms.

Helpers:

| Helper | Answers |
|---|---|
| `has(exp, cap)` | Does the persona have this capability? |
| `can(exp, perm)` | Does the staff member have this permission? |
| `allows(exp, when)` | Does a `When` rule pass? |
| `allowsTool(exp, toolId)` / `visibleTools(exp, tools, used)` | Tool visibility (tools the user already has records in stay visible) |
| `setupSteps(exp, facts)` | The vendor setup checklist |
| `toolTitle(exp, tool)` | Per-trade names ("Site visits" becomes "Tastings", "Fittings"…) |

## 3. Visibility rules are data (`src/data/access.ts`)

A `When` rule (`src/types/persona.ts`) is an object; every key that is set must pass; `{}` passes for everyone:

```ts
interface When {
  roles?: UserRole[];
  capsAny?: Capability[];  capsAll?: Capability[];
  occasions?: OccasionId[];          // customers
  forms?: BusinessForm[];            // vendors
  perms?: Permission[]; permsAny?: Permission[]; teams?: PlatformTeam[];  // staff
  not?: When;                        // hidden when this passes
}
```

| Registry | Decides |
|---|---|
| `TOOL_RULES` | every tool of every role (`ToolId` is derived from its keys, so a tool without a rule does not compile) |
| `VENDOR_LINK_RULES` | vendor sidebar links and hub rows (crew hiring, team) |
| `PLATFORM_ROUTE_RULES` | staff console tabs, sidebar links, More rows and screens |
| `ROUTE_AUDIENCE` | the explanation shown on `NoAccess` |
| `TODAY_FOCUS` | which focus panel staff see on Today (admin, finance, Vendor Success, support, coordinator) |
| `VENDOR_SETUP_STEPS` | the vendor home's setup checklist |

In components: `<Gate cap=… perm=… occasion=… when=… fallback=…>` (`components/persona/Gate.tsx`); for whole staff screens `export default staffScreen('/platform/finance', FinanceScreen)` (`components/persona/StaffGate.tsx`), which shows `NoAccess` to others.

**Hide, don't disable, never dead-end** (R-PER-3): a deep link to a hidden tool shows why and how to unlock it (for vendors, a link to Your services).

## 4. Staff permissions (`src/data/permissions.ts`)

As of October 2026:

| Staff role | Permissions |
|---|---|
| `coordinator` | `project.view_all`, `project.manage`*, `quote.send`*, `incident.manage`, `emergency.start` |
| `support` | `project.view_all`, `incident.manage`, `emergency.start`, `broadcast.send` (+ `provider.verify` on the Vendor Success team) |
| `finance` | `project.view_all`, `payment.record_cash`, `refund.approve`, `payout.release`, `payout.batch`, `audit.view` |
| `admin` | everything except `payout.release`, `payout.batch`, `occasion.manage`, `admin.full` |
| `super_admin` | everything |

\* Coordinators' `project.manage` and `quote.send` apply only to their own projects or unowned ones (`PERMISSION_SCOPE`).

Store actions enforce these themselves (`staffOnly`, `staffDenied`, `actorCan` in `store/db/personas.ts`); SQL mirrors them with `has_permission()` and `can_manage_project()` (0005, 0009) (R-PER-4).

## 5. Customers: occasions

Built-in occasions (`BUILT_IN_OCCASIONS`): `wedding`, `engagement`, `anniversary`, `baby_shower`, `newborn`, `bratabandha`, `birthday`, `corporate`, `other`. Each `OccasionDef` sets the functions offered (`eventTypes`), the honourees (`couple`, `baby`, `person`, `org`), the default and allowed services, the planner modules, whether it is a ritual, and its vocabulary (`vocab`: "wedding website" vs "event page").

- A couple can hold several celebrations; `useAppStore.activeProjectId` picks the active one (`CelebrationSwitcher`), `useCustomerWorkspace()` returns it.
- The marketplace shows **only** the occasion's services (`categoriesFor`, `homeCategoriesFor` in `data/categories.ts`); search still finds everything (R-PROD-9).
- Super admins edit occasions in Platform → More → Occasions (`addOccasion`, `updateOccasion`, `removeOccasion`; permission `occasion.manage`). `wedding` and `other` are protected (`PROTECTED_OCCASIONS`); an occasion used by a project can be switched off but not deleted (R-PER-6).

## 6. Vendors: trades, services and forms

- `TRADES` in `data/trades.ts` groups the services in `data/services.ts` for sign-up tiles, headings and setup steps: venue, photo and film, beauty, decor, food, music, sound and AV, fashion, rituals, transport, vehicles, stationery, planning.
- Sign-up asks the trade, then the main service and add-ons (any trade), the business form and two or three trade essentials (`EssentialField`), then name, city, listing claim and PAN. Business → **Your services** (`/business/services`, `setProviderPersona`) edits the same later and records `personaConfirmedAt`.
- 13 trade tools in `components/toolkit/vendor/trades.tsx` appear only for the trades that use them.

## 7. Freelancers: crafts and skills

- `CRAFTS` in `data/crafts.ts`: photo and film, editing, makeup and mehendi, music and hosting, decor, kitchen and service, driving, sound and AV, rituals, event crew.
- The craft decides the rate model (`day`, `event`, `package` → "per project") and the equipment asked about; crafts without equipment get no equipment section ("a DJ never sees camera fields").
- The gig feed is **strict**: only gigs for a skill on the profile, plus invitations and emergencies addressed to them. `applyToGig` refuses others; SQL mirrors it with a trigger (0006).

## 8. Feature switches (super admin)

`data/features.ts` lists switches for tabs, screens, tools (`tool:<ToolId>`), services (`service:<id>`) and sections. Stored in `DbData.featureFlags`; a missing id takes its **default** (`featureDefault`, read through `featureOn`). Read with `useFeatures()`; for links use `useLinkOn()`. Mirror: `feature_flags` in 0016 (a missing row = the default).

**Top 20 per app (owner's call, 2026-10-03).** So new people aren't lost, each app shows only its 20 most-used features out of the box: `TOP_FEATURES` lists them per role (couples, businesses, freelancers, staff). Everything else is an **extra** that starts off until a super admin switches it on in Platform → More → Super admin → Features:

- fixed surfaces in `EXTRA_FEATURES` (seating, registry, mood boards, compare, deals, calendar, plan another celebration, shop and promotions pages, three home carousels; business social media, team, customers, analytics, promotions);
- every tool that isn't a top feature, except the one main tool of each trade (`TRADE_TOOLS`) and craft (`CRAFT_TOOLS`), which only that trade or craft sees anyway;
- account basics (home, notifications, settings, profile, language, support, log out, and the couple's first-run tour in `BASIC_FEATURES`), services, sign-up paths and content switches are never extras.

A tool someone already has records in stays visible to them unless a super admin switched it off explicitly. Screens belong to features through `FEATURE_ROUTES`: menus and sidebars drop links with `useLinkOn()`, and `FeatureRouteGuard` (root layout) covers a switched-off screen opened from an old link or notification. The Features screen has "Recommended" (back to the defaults: clears `featureFlags`) and "Switch every feature on". `npm run test:features` checks the 20s, the defaults and that every feature route has a screen. When you add a screen or tool, decide whether it is a top feature or an extra; if it joins the top 20, something else leaves.

## 9. The registry check and persona matrix

`npm run check:personas` (`scripts/check-personas.mjs` → `scripts/personaCheck.ts`) fails when:

- a registry references an unknown capability, permission, occasion or service;
- a service has no capabilities or no trade;
- a crew role is in no craft or in two;
- a fixture persona sees fewer than three tools;
- any fixture's visible tools (and, for staff, console routes) differ from `scripts/persona-matrix.json`.

After an **intended** visibility change: `npm run check:personas -- --update`, review the diff of `persona-matrix.json`, and commit it (R-PER-5).

## 10. Recipes

**Add a trade or service.** Add the `ServiceDef` (with `capabilities` via `SERVICE_CAPABILITIES`) to `data/services.ts` and its trade in `data/trades.ts`; add any trade tools with `TOOL_RULES` entries; mirror in a new migration; run `check:personas`. No screen code should need to change.

**Add an occasion (built-in).** Add an `OccasionDef` to `BUILT_IN_OCCASIONS`; add a `migrate` step if existing installs need it; mirror in SQL. (Super admins can add non-built-in occasions at runtime without code.)

**Add a permission.** Add it to `PERMISSIONS` and `PERMISSION_LABELS`, grant it in `STAFF_PERMISSIONS`/`TEAM_PERMISSIONS`, guard the action with `staffOnly`/`staffDenied`, add route rules, mirror `staff_permissions` in a new migration, update the matrix.

**Add a staff screen.** See [03-frontend.md §1.3](03-frontend.md#13-adding-a-screen-step-by-step): add a `PLATFORM_ROUTE_RULES` entry and wrap with `staffScreen()`.
