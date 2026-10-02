# 07. Database

The production data model is Postgres on Supabase. It lives in `supabase/migrations/` as plain SQL files that apply in number order. Every table, view, function, trigger and job per migration is listed in [the database reference](../reference/database.md).

Rules: R-DB-1 … R-DB-5, R-BIZ-10, R-PROD-10 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

> **Never apply SQL to a Supabase project without the owner's go-ahead** (R-PROD-10). Check it locally instead: `npm run db:check`, `npm run db:test`, `npm run test:parity` run on PGlite, an in-process Postgres. Nothing leaves the machine.

## 1. The migrations (as of October 2026)

| # | File | Phase | Adds |
|---|---|---|---|
| 0001 | `core_schema` | | 83 tables and 40 enums: projects, events, requirements, bookings, assignments, quotes and versions, milestones, payments, payables, revenue, tasks, deliverables, conversations, files, guests, seating, websites, registry, reviews, verification… Audit, calendar-blocking and quote-freeze triggers. |
| 0002 | `rls` | | Row-level security on every table: customers see their projects, providers their bookings (never others' prices), freelancers their gigs, staff by role |
| 0003 | `matching_risk_reliability` | | `match_providers`, `match_freelancers`, `start_emergency_replacement`, `recompute_reliability`, `project_risks` view (same weights as `services/matching.ts`) |
| 0004 | `toolkits` | | `tool_entries`, `tool_state`, `broadcasts` |
| 0005 | `personas` | P0 | capabilities, trades, occasions, permissions as reference tables; `has_capability()`, `has_permission()` |
| 0006 | `freelancer_crafts` | P2 | crafts; gig applications need the skill unless invited (trigger) |
| 0007 | `nwaran_event_type` | P3 | the `NWARAN` event type |
| 0008 | `customer_occasions` | P3 | several celebrations per customer, honourees, `project_has_module()` |
| 0009 | `platform_rbac` | P4 | role-name checks become permission checks; `can_manage_project()` |
| 0010 | `sql_defect_fixes` | P5 | security definer triggers, column protections, viewer collaborators, quote freeze, refund caps, project codes |
| 0011 | `core_rpc` | P5 | the core loop as `rpc_*` functions + money helpers in paisa |
| 0012 | `auth_media_notifications` | P6 | sign-up RPCs, staff access codes and approval, JWT hook, media registry, private documents bucket, push tokens, notification fan-out |
| 0013 | `jobs` | P6 | pg_cron jobs: milestone sweep, payable readiness, lead SLA, reminders, clean-up |
| 0014 | `payments` | P7 | `payment_intents`, `rpc_begin_payment`, `rpc_settle_payment` |
| 0015 | `launch` | P8 | `rpc_health`, legal acceptances, data export, account deletion |
| 0016 | `super_admin_vehicles` | | `admin.full`, feature flags, text overrides, announcements, vehicles trade |

## 2. Conventions

- **Append-only.** New change = new file with the next number (`0017_short_name.sql`). Never edit a migration that exists (R-DB-1). Start the file with a `--` header comment explaining what it adds and which app files it mirrors; the reference shows it.
- **Mirrors.** Each migration says which TypeScript it mirrors (types in `src/types/platform.ts`, registries in `src/data/`, actions in `src/store/db/`). Change both sides in the same pull request.
- **Money is paisa** (`bigint`, 1 NPR = 100 paisa). The app uses whole rupees; helpers in 0011 (`vivah_rupees()` etc.) round to whole rupees so both give identical numbers (R-DB-5).
- **RLS on every table** (R-DB-2). `db:check` fails otherwise.
- **Couples never see provider cost or margin**: column grants plus the `quote_items_public` and `service_bookings_customer` views (R-BIZ-9).
- **Functions.**
  - `rpc_*`: the client-callable surface. `security definer`, `set search_path = public`, permission-checked with `has_permission()` / `has_capability()` / `can_manage_project()`, idempotent where it matters, audited, notifying. Listed in the header of 0011. Each has a check in `scripts/db/*.mjs` (R-DB-4).
  - `vivah_*`: internal helpers, never granted to clients.
  - `job_*`: scheduled jobs; idempotent.
  - Trigger functions that write to RLS-protected tables: `security definer set search_path = public`. Guard triggers that must let RPCs through: `security invoker` and check `current_user in ('authenticated','anon')` (R-DB-3).
- **Enums** mirror the TypeScript status unions. Adding a value: `alter type … add value` in its own migration (it can't be used in the same transaction; see 0007/0008). Never remove or rename a value.
- **Indexes** on every foreign key and every status column used by RLS or lists.
- **Do not deploy from a laptop**: production migrations go through the release process in [14-devops-and-release.md](14-devops-and-release.md) and `docs/LAUNCH.md`.

## 3. The local harness (`scripts/db/`)

| Command | Script | Proves |
|---|---|---|
| `npm run db:check` | `db-check.mjs` | Every migration applies on a fresh Postgres; RLS is on for every table |
| `npm run db:test` | `core-loop.mjs`, `accounts.mjs`, `payments.mjs`, `launch.mjs` | The core loop, sign-up, media, files, notifications, jobs, payments and launch features, run **as each role with RLS on**; every invariant and every fixed defect has a check |
| `npm run test:parity` | `parity.mjs` | App money (`src/services`) equals SQL money (0011) on `scripts/parity-fixtures.json` plus a few hundred generated cases |
| `node scripts/db/local-api.mjs` | `local-api.mjs` | A local stand-in for Supabase's HTTP API on `http://localhost:54321` (email code always `123456`) for testing the Supabase build in a browser. Never expose it to the internet. |

`harness.mjs` is the shared PGlite setup with shims for what Supabase provides: the `auth` schema and `auth.uid()`, the `anon`/`authenticated`/`service_role` roles and grants, and the `storage` schema.

Gotchas learned the hard way (P5):

- Inserting a parent and child in one CTE fails RLS (the child's policy can't see the new parent). Use separate statements.
- JavaScript `Math.round` drifts on exact halves with binary floats; the app uses `roundMoney()`.

## 4. Adding a table or RPC, step by step

1. Add the TypeScript type (optional fields) and the store action first, so the demo works.
2. Create `supabase/migrations/00NN_name.sql` with a header comment.
3. Create the table with `enable row level security` and policies per role; add indexes.
4. Add the `rpc_*` function: `security definer`, `set search_path = public`, permission check, validation, audit (`audit_logs`), notification.
5. `grant execute` to `authenticated` (or `anon` for genuinely public functions only).
6. Add checks to the right `scripts/db/*.mjs` (as the roles that may and may not call it).
7. If money is involved, add parity cases and run `npm run test:parity`.
8. Run `npm run db:check && npm run db:test`.
9. If the app should call it, add a `Backend` method ([06-backend.md](06-backend.md)).
10. Run `npm run docs:generate` so [the database reference](../reference/database.md) lists it.

## 5. Data protection in the schema

- Profiles are anonymised on account deletion, never hard-deleted, because bookings, payments and contracts point at them (`rpc_delete_my_account`, 0015).
- Private files sit in the `documents` storage bucket under `<user id>/…`; bucket RLS decides who reads them; links last five minutes.
- Audit logs record who changed money, status and permissions.
