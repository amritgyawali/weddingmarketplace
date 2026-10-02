# 10. Role toolkits

On top of the core loop, each role app has a hub of smaller tools: 20 general tools per role plus trade, craft and occasion tools (as of October 2026: couple 23, vendor 33, freelancer 23, platform 20). Examples: the sait (auspicious date) finder and gift ledger for couples; expenses, VAT position and menu builder for vendors; rate calculator and gear checklist for freelancers; SLA monitor and payout batches for staff.

Code: `src/components/toolkit/`. Every tool component is listed in [the toolkit reference](../reference/code/components.toolkit.md) and the per-role pages next to it.

## 1. Where they live

| Role | Hub → tool route | Entry point | Registry |
|---|---|---|---|
| Couple | `/tools` → `/tool/[id]` | Profile → Planning tools | `components/toolkit/couple/index.ts` |
| Vendor | `/business/tools` → `/business/tool/[id]` | Business tab → Business tools | `components/toolkit/vendor/index.ts` (`VENDOR_TOOLS`) |
| Freelancer | `/freelancer/tools` → `/freelancer/tool/[id]` | Profile tab → Freelancer tools | `components/toolkit/freelancer/index.ts` |
| Platform | `/platform/tools` → `/platform/tool/[id]` | More → Operations tools | `components/toolkit/platform/index.ts` |

Files per role group tools by theme: couple (`ceremony`, `logistics`, `money`, `occasions`), vendor (`clients`, `money`, `ops`, `trades`), freelancer (`work`, `money`, `growth`, `crafts`), platform (`insight`, `ops`).

## 2. How a tool is wired

```
registry entry (ToolDef)            components/toolkit/<role>/index.ts
   { id: 'vendor.menu', title, subtitle, icon, group, Component: MenuBuilder }
        │
        ├─ visibility rule          TOOL_RULES['vendor.menu'] in data/access.ts   (required: ToolId is typed)
        ├─ feature switch            'tool:vendor.menu' in DbData.featureFlags   (super admin, optional)
        │
hub screen   /business/tools        ToolHub + useVisibleTools(VENDOR_TOOLS)
tool screen  /business/tool/[id]    ToolRoute: renders Component, or explains why it's hidden
        │
data         toolEntries (records) + toolState (settings) via store/db/toolkit.ts
```

- `ToolDef.id` is the registry id, the route param and the `ToolEntry.tool` value. Format: `<role>.<name>` (`couple.gifts`, `vendor.expenses`).
- `useVisibleTools(tools)` applies `TOOL_RULES` and feature switches; tools the owner already has records in stay visible (no data disappears).

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
