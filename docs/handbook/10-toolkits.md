# 10. Role toolkits

On top of the core loop, each role app has a hub of smaller tools: 20 general tools per role, five smart tools per role, plus trade, craft and occasion tools (as of October 2026: couple 28, vendor 38, freelancer 28, platform 25). Examples: the sait (auspicious date) finder and gift ledger for couples; expenses, VAT position and menu builder for vendors; rate calculator and gear checklist for freelancers; SLA monitor and payout batches for staff.

Code: `src/components/toolkit/`. Every tool component is listed in [the toolkit reference](../reference/code/components.toolkit.md) and the per-role pages next to it.

## 1. Where they live

| Role | Hub → tool route | Entry point | Registry |
|---|---|---|---|
| Couple | `/tools` → `/tool/[id]` | Profile → Planning tools | `components/toolkit/couple/index.ts` |
| Vendor | `/business/tools` → `/business/tool/[id]` | Business tab → Business tools | `components/toolkit/vendor/index.ts` (`VENDOR_TOOLS`) |
| Freelancer | `/freelancer/tools` → `/freelancer/tool/[id]` | Profile tab → Freelancer tools | `components/toolkit/freelancer/index.ts` |
| Platform | `/platform/tools` → `/platform/tool/[id]` | More → Operations tools | `components/toolkit/platform/index.ts` |

Files per role group tools by theme: couple (`ceremony`, `logistics`, `money`, `occasions`, `smart`), vendor (`clients`, `money`, `ops`, `trades`, `smart`), freelancer (`work`, `money`, `growth`, `crafts`, `smart`), platform (`insight`, `ops`, `smart`).

### Smart tools (October 2026)

Five per role, in each role's `smart.tsx`. They score, forecast or check from live data; the rules are pure functions in `src/services/insights.ts`, covered by `npm run test:insights`. Like every tool outside the top 20 they start switched off (Super admin → Features).

| Role | Tool (id) | What it does |
|---|---|---|
| Couple | Plan health check (`couple.health`) | Readiness 0–100 from vendors booked, payments, tasks, guests and replies, contracts and budget; compares with where couples usually are for the days left; ranks the biggest gains |
| Couple | Headcount forecast (`couple.headcount`) | Expected attendance per function from RSVPs (yes in full, maybe and no-reply at editable turnout rates) and plates to order with a buffer |
| Couple | Fair price check (`couple.pricecheck`) | Where a quoted unit price sits against similar listings in the city (or the service's typical range), with a verdict, negotiation tip and saved checks |
| Couple | Family vote (`couple.votes`) | Polls shared by everyone on the plan (owner = project id); one vote per account, stored as `vote:<accountId>` fields |
| Couple | Marriage registration (`couple.registration`) | Ward-office checklist and the 35-day registration deadline; weddings only (`plan.janti`) |
| Vendor | Lead scores (`vendor.leadscore`) | Hot, warm or cold per open enquiry: budget fit, date, free or booked, guest fit, detail, stage, age |
| Vendor | Revenue forecast (`vendor.forecast`) | Scheduled payouts plus open enquiries weighted by editable stage odds, by month, against the monthly goal |
| Vendor | Date demand and pricing (`vendor.datedemand`) | High-demand open dates (sait, Saturday, peak month, requests nearby) with a suggested uplift on the starting price |
| Vendor | Review requests (`vendor.reviewask`) | Finished bookings without a review; one-tap WhatsApp ask, logged per booking |
| Vendor | Win and loss analysis (`vendor.winloss`) | Win rate by source, budget band, reply speed and month; loss reasons tagged per enquiry |
| Freelancer | Best gigs for you (`freelancer.gigfit`) | Open gigs ranked by take-home pay per hour after travel, skills, radius and calendar clashes |
| Freelancer | Season planner (`freelancer.season`) | Sait dates ahead as working, blocked or open, with a suggested peak rate |
| Freelancer | Rest and workload (`freelancer.workload`) | Back-to-back runs, heavy weeks and late finishes against the freelancer's own limits |
| Freelancer | Income statement (`freelancer.income`) | Vivah payouts and paid private invoices for a fiscal year, as PDF (`incomeStatementHtml`) or CSV |
| Freelancer | Testimonials (`freelancer.testimonials`) | Client quotes, imported from reviews or typed in, copied or shared as a block |
| Platform | Money reconciliation (`platform.reconcile`) | Checks the money invariants of §5 on every project and lists what disagrees; read-only |
| Platform | Commission simulator (`platform.commission`) | Platform fee, couple price and provider payout under proposed rates on the last 12 months; read-only |
| Platform | Peak-date capacity (`platform.peakdates`) | Dates whose functions could outrun free providers per service in the area |
| Platform | Customer satisfaction (`platform.nps`) | Net score from star reviews, by service and coordinator, and a call-back list |
| Platform | Listing quality (`platform.listings`) | Profile completeness and trust score per listing, lowest first, with what is missing |

## 2. How a tool is wired

```
registry entry (ToolDef)            components/toolkit/<role>/index.ts
   { id: 'vendor.menu', title, subtitle, icon, group, Component: MenuBuilder }
        │
        ├─ visibility rule          TOOL_RULES['vendor.menu'] in data/access.ts   (required: ToolId is typed)
        ├─ feature switch            'tool:vendor.menu' in DbData.featureFlags   (super admin; off by default unless a top-20 feature, see 09 §8)
        │
hub screen   /business/tools        ToolHub + useVisibleTools(VENDOR_TOOLS)
tool screen  /business/tool/[id]    ToolRoute: renders Component, or explains why it's hidden
        │
data         toolEntries (records) + toolState (settings) via store/db/toolkit.ts
```

- `ToolDef.id` is the registry id, the route param and the `ToolEntry.tool` value. Format: `<role>.<name>` (`couple.gifts`, `vendor.expenses`).
- `useVisibleTools(tools)` applies `TOOL_RULES` and feature switches; tools the owner already has records in stay visible (no data disappears), unless a super admin switched the tool off explicitly. Only the top-20 tools (`TOP_FEATURES`, plus one per trade and craft) are on by default.

## 3. Data: two generic collections, no new keys

Never add a persisted key for a tool (R-STATE-2). Use:

| Collection | Type | Holds |
|---|---|---|
| `toolEntries` | `ToolEntry` (`src/types/toolkit.ts`) | one record: `title`, `note`, `amount` (whole NPR), `qty`, `date` (yyyy-mm-dd), `time` (HH:mm), `status`, `group`, `done`, `refId`, free-form `fields` |
| `toolState` | `Record<string, ToolState>` keyed `${ownerId}:${tool}` | per-owner settings: targets, templates, flags |
| `broadcasts` | `Broadcast` | role-wide announcements from the ops team |

**Owner** (`useToolOwner()`): the couple's project id (so collaborators share it), the vendor's or freelancer's account id, or `'platform'` for staff.

Actions (`store/db/toolkit.ts`): `addToolEntry`, `updateToolEntry`, `removeToolEntry`, `toggleToolEntry`, `ensureToolPreset` (starter items added once per owner, never re-added after the owner edits), `setToolState`, `sendBroadcast` (audited, notifies a whole role). They clamp money and quantities to non-negative integers and drop malformed dates. Platform tools and the money tools of vendors and freelancers write the audit log.

SQL mirror: `tool_entries`, `tool_state`, `broadcasts` in `0004_toolkits.sql`.

## 4. Building blocks (`components/toolkit/core.tsx`)

| Export | Use |
|---|---|
| `ToolPage` | Page shell: title, subtitle, right slot |
| `EntryList` | **Config-driven list + add/edit sheet** for record-shaped tools. Most tools are just an `EntryList` config. |
| `useToolOwner`, `useToolEntries(owner, tool)`, `useToolState(owner, tool, defaults)`, `usePreset` | Hooks |
| `StatRow`, `Line`, `Hint`, `NumberField`, `Cols`/`Col` | Small layout and summary pieces |
| `sumAmount(entries, pick?)` | Sum of `amount` |

`EntryList` props (the important ones): `ownerId`, `tool`, `fields: FieldDef[]` (`key` is a base field such as `title`/`amount`/`date` or `f.<custom>`; `kind` is `text`, `multiline`, `money`, `number`, `date`, `time`, `select`, `toggle`), `noun` ("expense"), `presets`, `checklist`, `groupBy`, `defaults`, `subtitle`/`trailing`, `statusPill`, `sort`, `filter`, `header(entries)` for summaries, `rowActions`, empty texts, `onAdded`.

Calculators belong in `src/services/toolkit.ts` (pure), not in the component. Tax figures are labelled estimates.

## 5. Adding a tool, step by step

Example: a vendor "Deposits held" tool.

1. **Rule:** add `'vendor.deposits': { capsAny: ['core.finance'] }` (or `{}` for everyone) to `TOOL_RULES` in `data/access.ts`. Without it the id won't type-check.
2. **Component:** in the right file (`components/toolkit/vendor/money.tsx`), with a JSDoc line:
   ```tsx
   /** Deposits a vendor holds for couples, with return dates. */
   export function Deposits() {
     const owner = useToolOwner();
     return (
       <ToolPage title="Deposits held" subtitle="Security deposits and when they go back">
         <EntryList ownerId={owner} tool="vendor.deposits" noun="deposit"
           fields={[
             { key: 'title', label: 'Couple', kind: 'text', required: true },
             { key: 'amount', label: 'Amount', kind: 'money', required: true },
             { key: 'date', label: 'Return by', kind: 'date' },
           ]}
           checklist />
       </ToolPage>
     );
   }
   ```
3. **Registry:** add `{ id: 'vendor.deposits', title: 'Deposits held', subtitle: '…', icon: 'lock-closed-outline', group: 'Money', Component: Deposits }` to `VENDOR_TOOLS`.
4. **Nepali:** add the title, subtitle, labels and empty texts to `src/i18n/ne/index.ts`.
5. **Demo (optional):** starter records in `src/data/toolkitSeed.ts` (stable ids).
6. **Checks:** `npx tsc --noEmit`, `npx expo lint`, `npm run check:personas -- --update` (the matrix gains the tool for matching personas), review and commit `scripts/persona-matrix.json`.
7. **Docs:** `npm run docs:generate`; update the tool list in `README.md` if it changed.

A tool that only reads core data (a computed dashboard) must not write to core entities. The two exceptions are the platform's "Assign all" (`assignCoordinator`) and "Release batch" (`releasePayable`, behind a confirm), which reuse existing guarded actions.
