# 05. State and data

How the app stores data, how it changes, how it survives app updates, and the demo seed.

Rules: R-ARCH-1 … R-ARCH-3, R-STATE-1 … R-STATE-9 in [00-rules-and-regulations.md](00-rules-and-regulations.md). Every action with its signature: [store action reference](../reference/store-actions.md).

## 1. The stores

| Store | File | Persisted as | Holds |
|---|---|---|---|
| **`useDb`** | `src/store/db/index.ts` (re-exported by `src/store/useDb.ts`) | `vivah-db` | The shared backend for all four roles: every collection in `DbData` plus every action |
| `useSession` | `src/store/useSession.ts` | `vivah-session` | Accounts (all roles), the current session, the last account, the role picked on the welcome screen, impersonation |
| `useAppStore` | `src/store/useAppStore.ts` | `vivah-app-store` | Per-device couple state: onboarding answers, city, shortlist, liked photos, recent searches, joined weddings, `activeProjectId` |
| `usePrefs` | `src/i18n/index.tsx` | `vivah-prefs` | Language (`en`/`ne`) and calendar (`bs`/`ad`) |
| toast store | `src/components/ui/Toast.tsx` | not persisted | The toast queue |

On the demo backend, all roles on one device share `useDb`: a couple's enquiry appears instantly in the vendor's leads when you switch accounts. That is why the demo can show the full loop with no server.

## 2. `DbData`: the collections

Defined in `src/store/db/types.ts`. As of October 2026:

| Group | Collections |
|---|---|
| Core | `projects`, `quotes`, `leads`, `gigs` |
| Money | `payments`, `payables`, `revenue`, `refunds`, `disputes`, `invoices` |
| Calendars | `availability`, `availabilityRules` |
| Communication | `threads`, `messages`, `notes` (staff-only), `files`, `notifications`, `audit` |
| Trust | `reviews`, `verifications` |
| Couple planning | `guests`, `seating`, `budget`, `websites`, `registry`, `boards`, `contracts`, `shortlists` |
| Business | `deals`, `staff`, `packages`, `portfolio`, `settings` |
| Toolkits | `toolEntries`, `toolState` (keyed `${ownerId}:${tool}`), `broadcasts` |
| Personas | `occasions` |
| Super admin | `featureFlags`, `textOverrides`, `announcements` |

Projects are deep: events, requirements, bookings (with crew and deliverables), milestones, tasks, timeline, incidents, collaborators and status history all live inside the `Project` object (`src/types/platform.ts`).

## 3. Store actions are the API

Actions are grouped by domain, one file each in `src/store/db/`:

| File | Interface | Covers |
|---|---|---|
| `core.ts` | `CoreActions` | notifications, audit log, settings, demo reset, vendor leads |
| `quotes.ts` | `QuoteActions` | versioned quotations: draft, send, revise, respond, view |
| `projects.ts` | `ProjectActions` | plan intake (`submitPlan`), status, coordinator, matching, bookings, crew, emergency replacement, deliverables, tasks, events, incidents |
| `finance.ts` | `FinanceActions` | milestones → payments → receipts; payables → releases; refunds; disputes (freeze payouts); invoices |
| `gigs.ts` | `GigActions` | gig marketplace, applications, hiring, freelancer calendars |
| `chat.ts` | `ChatActions` | threads, messages, internal notes, simulated replies |
| `trust.ts` | `TrustActions` | reviews (ratings, replies, moderation), verification |
| `planner.ts` | `PlannerActions` | guests, RSVP, seating, budget, website, registry, boards, contracts, shortlist, staff, deals |
| `toolkit.ts` | `ToolkitActions` | generic tool records and settings, broadcasts |
| `personas.ts` | `PersonaActions` | occasion catalogue, vendor/freelancer persona edits; permission helpers |
| `admin.ts` | `AdminActions` | super admin: any record, accounts, impersonation, feature switches, text overrides, announcements |
| `index.ts` | | composes them all into `useDb`; `resetDemo`; `persist` config; `useInbox`, `useThreads` |
| `helpers.ts` | | `now`, `today`, `currentActor`, `SYSTEM`, `accountById`, `ownersOf`, `mapProject`, `mapBooking`, `bookingDates`, `firstDate`, `lastDate`, `nextNumber` |

Each file exports `xxxActions(set, get)`, which returns the implementations of its interface. The interface members carry the JSDoc that appears in the reference.

### 3.1 Anatomy of a good action

The pattern below is illustrative (`exampleAction` does not exist). Real examples: `sendQuote` in `quotes.ts`, `payMilestone` in `finance.ts`.

```ts
/** One line: what the use case is, who may call it, what it returns. */
exampleAction: (projectId, amount) => {
  const denied = staffOnly('payment.record_cash', get);        // 1. permission
  if (denied) return denied;
  const project = get().projects.find((p) => p.id === projectId);
  if (!project) return 'This celebration no longer exists';    // 2. existence
  if (!(amount > 0)) return 'Enter an amount above zero';       // 3. input
  // 4. preconditions and idempotency (already done? overpaid?)
  set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p /* 5. immutable change */ })) }));
  get().notify(project.customerId, 'Title', formatMoney(amount), '/my-wedding', 'payment'); // 6. notify with an href
  get().log(currentActor(), 'entity.verb', 'project', projectId, formatMoney(amount));      // 7. audit
  return null;                                                   // 8. null = success, string = error to show
},
```

### 3.2 Permission helpers (`store/db/personas.ts`)

| Helper | Use |
|---|---|
| `actorCan(perm, get)` | Boolean: may the signed-in actor do this? |
| `staffOnly(perm, get)` | For staff-only actions (payouts, holds, refunds, waivers, verification, suspension, broadcasts, cash payments). Returns an error string for anyone else. |
| `staffDenied(perm, get, project?)` | For actions other roles also use (project status, coordinator assignment, platform quotes, bookings, emergency replacement, settings, demo reset). Refuses only staff who lack the permission; a coordinator's `project.manage` and `quote.send` apply to their own or unowned projects (`PERMISSION_SCOPE`). |

### 3.3 Toasts and quiet actions

`installActionToasts()` (`store/actionToasts.ts`) wraps every action once at start-up. After a screen calls an action, a toast says what happened, unless the screen showed its own toast. An action that returns an error string shows it in red. Internal actions are listed in `SILENT`. Code that calls actions from timers (simulated replies) wraps them in `quietly()` (`store/quiet.ts`) so the user isn't toasted for something they didn't do.

## 4. Adding things

### A new field

Add it as optional (`field?: T`) in `src/types/platform.ts` and handle `undefined` everywhere it is read. If the SQL should store it, add a migration ([07-database.md](07-database.md)).

### A new action

1. Add the member with a JSDoc line to the domain's `XxxActions` interface.
2. Implement it in the same file following §3.1.
3. If it is part of the core loop and has a server equivalent, add it to the `Backend` interface and both adapters ([06-backend.md](06-backend.md)) and an `rpc_*` in a new migration.
4. If it should not toast, add it to `SILENT`.
5. Run `npm run docs:generate` so the reference lists it.

### A new persisted collection

1. Add it to `DbData` in `store/db/types.ts`.
2. Add its initial value to `buildSeedData()` in `src/data/seed.ts`. The list of persisted keys (`DATA_KEYS`) is derived from the seed, so a collection missing from the seed is **not saved**.
3. Older installs won't have it: read it as `data.x ?? []` or add it in `migrate` (bump `version`).
4. For role toolkits, **don't** add a collection; use `toolEntries`/`toolState` ([10-toolkits.md](10-toolkits.md)).

## 5. Persistence and migrations

- `useDb` uses `lazyStorage` (`store/lazyStorage.ts`): writes 400 ms after the last change, and at once when the app goes to the background or the web page unloads.
- `partialize` saves only the data keys, never functions.
- `migrate(persisted, version)` upgrades old data. History (October 2026): v3 Nepal orchestration model (older data is replaced by the seed); v4 adds the newborn demo project, demo tool records and the nwaran function; v5 adds vehicle services to built-in occasions, feature flags, text overrides and announcements, and replaces wedding-only checklist items on non-wedding celebrations.
- Migrations must be **additive**: add missing records and fields; never delete user data.
- **Never `setState` a persisted store at module load** (R-STATE-6): it would save the initial state over the user's data before rehydration finishes.
- The session store has its own `version` and `migrate`; `syncDemoAccounts()` copies demo accounts and their persona fields onto older installs. Bump the session `version` when you add a demo account or persona field (R-STATE-8).

## 6. The seed: the demo contract

`src/data/seed.ts` builds one coherent demo world (`buildSeedData()`), with `DEMO_ACCOUNTS`, the demo listings (`DEMO_VENUE`, `DEMO_STUDIO`, `DEMO_DECOR`) and toolkit records from `toolkitSeed.ts`. Demo flows depend on specific records; keep them working:

- `DEMO_ACCOUNTS` ids, phones and roles;
- WP-1021 (Aakriti's wedding): quote v1 → v2, payments, guests, seating, website slug `aakriti-weds-sujan`;
- WP-1017: live today, with the emergency replacement;
- WP-1040: Sarita's newborn pasni;
- other seeded projects cover every status;
- the Everest Grand Party Palace, Wedding Story Nepal and Phoolbari Decor listings and their persona fields.

Rules for seed data (R-STATE-7):

- dates are relative to today: `day(n)` (a date n days from today) and `at(n)` (a timestamp);
- ids and slugs never change;
- money is consistent: `agreedPrice = providerPayable + platformFee` for every booking, milestones sum to the accepted quote total, payables sum to the provider payable;
- `resetDemo` (admins, permission `demo.reset`) clears simulated-reply timers and restores `buildSeedData()`; it must always produce a working demo.

Known seed defect (October 2026): WP-1051's quote, milestones and booking disagree (`AGENTS.md` §10).

## 7. Simulated third parties

In the demo, some outside parties are simulated with timers. R-STATE-9 says `resetDemo` must clear them all.

| Simulation | Delay | Where | Cleared by `resetDemo`? (2 Oct 2026) |
|---|---|---|---|
| Unclaimed listing replies in chat | 2.2 s | `chat.ts` (`replyTimers`) | yes (`clearReplyTimers`) |
| Auto-quote for leads to unclaimed listings | 4 s | `core.ts` (`createLead` → `autoQuoteFor`) | **no**, untracked `setTimeout` |
| Provider confirms by phone | 3.5 s | `projects.ts` (`respondToBooking` through `quietly`) | **no**, untracked `setTimeout` |
| Payment gateways | instant | `PaymentSheet` in `components/work/Payments.tsx` (mock only) | n/a |
| OTP | code `1234` | `app/welcome/login.tsx` (mock only) | n/a |

The two untracked timers are a small known gap: a reset within four seconds of an enquiry or a booking proposal can still receive the simulated reply. Fix it by tracking them in the same set as `replyTimers` (and record the fix in `AGENTS.md` §10).
