# 00. Rules and regulations

These are the binding rules of the Vivah codebase. Each has an id, the rule, and the reason. The reason matters: when a situation is not covered, follow the reason.

`AGENTS.md` holds the same rules in short form for AI agents; if this file and `AGENTS.md` disagree, `AGENTS.md` wins and this file must be fixed.

**How to use the ids.** Quote them in reviews ("breaks R-BIZ-2"), commit messages and pull request descriptions. Never reuse a retired id; mark it *retired* with the date instead.

---

## R-GEN: general

| Id | Rule | Why |
|---|---|---|
| R-GEN-1 | **Never break existing functionality.** Every change MUST be additive or strictly equivalent for existing flows, roles, routes, store actions, persisted data and the seed demo. | Real users' saved data and the owner's demos depend on today's behaviour. A "small cleanup" that renames a field silently wipes data on every installed phone. |
| R-GEN-2 | When in doubt, add a new action, field or route instead of changing the meaning of an existing one. | Additions cannot break callers; changed meanings can. |
| R-GEN-3 | MUST NOT delete or rename routes, store actions, persisted keys, status values or seed ids that other code or users depend on. | Persisted data, deep links, SQL enums and tests use them by name. |
| R-GEN-4 | MUST NOT disable lint rules or type checks, or cast to `any`, to get a green build. | The checks are the safety net. Silencing one hides the bug it found. |
| R-GEN-5 | Run the Definition of Done ([12-testing-and-qa.md §1](12-testing-and-qa.md#1-definition-of-done)) before saying work is finished. Report failures honestly. | "It compiles on my machine" has broken the demo before. |
| R-GEN-6 | Update the documentation in the same pull request as the behaviour change: `AGENTS.md` when a rule changes, the matching handbook guide, `README.md` when the product overview changes, JSDoc on changed exports, then `npm run docs:generate`. | Docs that lag behind the code are worse than none: they mislead with confidence. |
| R-GEN-7 | Fix known defects deliberately, with a test, and remove them from `AGENTS.md` §10 and `TEST_REPORT.md`. MUST NOT "fix" them as a side effect of unrelated work. | Silent side-effect fixes change behaviour nobody reviewed. |

## R-PROD: product decisions (owner-owned; never reverse without the owner)

| Id | Rule | Why |
|---|---|---|
| R-PROD-1 | **Nepal only.** Places, ceremonies, holidays and copy are Nepali. | The product is built for one market and does it well. |
| R-PROD-2 | Money is **NPR**, formatted through `formatMoney` (`NPR 150,000`), `formatMoneyCompact` (`NPR 45K`) or `formatLakh` ("7.5 lakh"). Tax is **13% VAT** (`VAT_RATE`/`TAX_RATE`). MUST NOT use ₹, INR or GST anywhere. | Early versions were built on an Indian template; leftovers confuse Nepali users and break invoices. |
| R-PROD-3 | Payments: eSewa, Khalti, Fonepay QR, ConnectIPS, IME Pay, card, bank transfer; cash is recorded by staff only. | These are the methods Nepali couples use. Cash must be traceable to a staff member. |
| R-PROD-4 | **Everything must keep running in Expo Go (SDK 57).** MUST NOT add a library with custom native code without the owner's approval. | Expo Go is the demo and development path; one native module ends that for everyone. |
| R-PROD-5 | **Free stack only** in year one: no paid services or paid tiers without the owner's approval. | Owner decision (30 Sep 2026); the business is pre-revenue. |
| R-PROD-6 | **Email OTP only** for the first year; no SMS sign-in. | SMS costs money per message; owner decision. |
| R-PROD-7 | Every role keeps a one-tap demo account, and the seed tells one coherent story. | The owner sells the product by demoing it. |
| R-PROD-8 | The admin/operations console is the same Expo app (Platform role), web-ready. There is no separate web project. | One codebase to maintain. |
| R-PROD-9 | Non-wedding occasions show **only related** marketplace categories (hidden, not ranked lower). | Owner decision; a pasni family should not scroll past bridal makeup. |
| R-PROD-10 | MUST NOT apply SQL to any Supabase project, or call live third-party services with the owner's keys, without the owner's go-ahead. | Production data and paid quotas belong to the owner. |

## R-ARCH: architecture and layering

| Id | Rule | Why |
|---|---|---|
| R-ARCH-1 | Screens read with `useDb(selector)` or the `useWorkspace` hooks and write **only by calling store actions**. MUST NOT mutate store state from a screen. | Store actions are the future API. A screen that writes state directly has no server equivalent and skips audit and notifications. |
| R-ARCH-2 | MUST NOT put business rules (money, status transitions, matching, permissions) in components. They live in `src/services` (pure) or `src/store/db` (state changes). | Rules in JSX get duplicated, drift, and can't be tested in Node or mirrored in SQL. |
| R-ARCH-3 | One store action = one use case, and each maps to a future server endpoint. Side effects (notifications, audit log, revenue, payables, calendar) happen **inside** the action. | The Supabase RPCs mirror actions one to one (0011). |
| R-ARCH-4 | `src/services` are pure and deterministic: no React, no store imports. Exceptions: `services/auth.ts` (wires stores), `exporters.ts` and `documents.ts` (I/O and HTML). | Pure modules run in Node scripts (`check:personas`, `test:parity`) and can move to the server. |
| R-ARCH-5 | Imports use the `@/…` alias. Non-route code MUST NOT live in `src/app/`. | Every file in `src/app` becomes a route. |
| R-ARCH-6 | New backend-dependent features go through the `Backend` interface (`src/backend`), which has a `mock` and a `supabase` implementation. The demo (`mock`) MUST keep working. | One build switch (`EXPO_PUBLIC_BACKEND`) moves the app from demo to production. |

## R-FE: frontend

| Id | Rule | Why |
|---|---|---|
| R-FE-1 | Register every new screen in its role's `_layout.tsx` (or the root layout for couple and public screens) **inside the correct `Stack.Protected` guard**. A role MUST NOT be able to reach another role's app. | The guard is the only thing keeping a freelancer out of the finance console on device. |
| R-FE-2 | Every screen MUST work at phone width (≈430 px) and at ≥ 960 px (wide layout, `useLayout().wide`). | The staff console is used on desktop browsers. |
| R-FE-3 | A missing id or entity MUST show an empty state, never `return null` or a crash. | Deep links from notifications and old shares point at records that may be gone. |
| R-FE-4 | Zustand selectors MUST return stable references: select the raw array or object and filter during render. | A selector returning a fresh array re-renders forever (see `useInbox` in `store/db/index.ts` for the pattern). |
| R-FE-5 | React Compiler is on. MUST NOT add manual memoisation that fights it; MUST obey the rules of hooks (no hooks after an early `return`). | The compiler memoises for us; hand-written `useMemo` with wrong deps causes stale UI. |
| R-FE-6 | On web, MUST NOT nest pressables (a `Card onPress` containing buttons). Make the tappable area and the buttons siblings. | It renders `<button>` inside `<button>`, which browsers reject. |
| R-FE-7 | MUST NOT add `KeyboardAvoidingView`. Import `KeyboardAwareScrollView as ScrollView` from `components/ui/Keyboard`. | Every navigator already lifts screens above the keyboard; a second mechanism double-pads. |
| R-FE-8 | Confirmations use `utils/confirm` (the app `Dialog`); loading uses `Loader`/`LoadingState`; errors from actions are toasted. MUST NOT use `Alert.alert` in new code. | One look and one behaviour on all platforms, including web where `Alert` is a no-op. |
| R-FE-9 | Use the role kit (`components/kit`) in role apps and `useRoleTheme()` for colours. | Keeps four apps visually one product. |

## R-UI: visual design and copy

| Id | Rule | Why |
|---|---|---|
| R-UI-1 | Colours come from tokens (`src/constants/theme.ts`, `src/theme/roles.ts`). MUST NOT hard-code a hex in a screen; add a token instead. ESLint enforces this in `src/app` and `src/components` (allow-list in `eslint.config.js`). | The palette changed once already (2 Oct 2026); tokens made it a one-file change. |
| R-UI-2 | No gradients except dark scrims over photos; no glows; no coloured shadows. Shadows only on things that float (sheets, toasts, floating filter bar). | The owner rejected the "AI template" look. |
| R-UI-3 | Fonts: Mukta for all UI, Martel (`<Text serif>`) for display lines only. MUST NOT add another font family. | Both have Devanagari, so Nepali sets in the same voice. |
| R-UI-4 | Cards: 10 px radius, 1 px border, no shadow. Buttons 8 px. Chips 4–6 px. | Consistency; see [04-ui-ux.md](04-ui-ux.md). |
| R-UI-5 | **Sentence case everywhere.** No all-caps eyebrows, no letter-spaced labels, no emoji in UI chrome or notifications, no "AI", "magic" or sparkle language. | Owner decision: the app must read as built by experienced human designers. |
| R-UI-6 | Gold (`gold`) is a thin accent, never a large fill and never body text on ivory (use `goldDeep`). | Contrast and taste. |
| R-UI-7 | Stats: label above, number below in Martel, in ink. Colour a number only when it flags a problem. | Colour must mean something. |
| R-UI-8 | Copy is Nepal-first and friendly ("Namaste", "Dhanyabad"). New UI text MUST get its Nepali line in `src/i18n/ne/index.ts`. | The app ships in English and Nepali. |

## R-STATE: state, persistence and the seed

| Id | Rule | Why |
|---|---|---|
| R-STATE-1 | New optional fields (`field?: T`) only; MUST NOT make an existing field required or change its type. | Persisted data and seed data must stay valid. |
| R-STATE-2 | A new persisted collection MUST be added to `DbData` (`store/db/types.ts`) **and** to `buildSeedData()`. If old data can't be read any more, bump `version` in `store/db/index.ts` and handle it in `migrate`. | The persisted key list is derived from the seed. |
| R-STATE-3 | Update immutably (`mapProject`, `mapBooking`). | Zustand subscribers compare references. |
| R-STATE-4 | Every action that touches money, status or permissions MUST write the audit log (`log(currentActor(), 'entity.verb', …)`) and `notify()` the affected party with an `href` into their role's routes. | Ops staff reconstruct disputes from the audit log. |
| R-STATE-5 | Actions MUST validate their own input and preconditions (amounts > 0, status preconditions, idempotency, permissions via `actorCan`/`staffOnly`/`staffDenied`). MUST NOT rely on the UI only. | Actions become server endpoints; the server can't trust the client. |
| R-STATE-6 | MUST NOT `setState` a persisted store at module load. | It saves the initial state over the user's data before rehydration. |
| R-STATE-7 | Seed dates stay relative to today (`day(n)`, `at(n)`); seed ids and slugs stay stable; new seed data is internally consistent (booking price = payable + fee, milestones sum to the accepted total). | The demo must work on any day, and `Reset demo data` must always restore it. |
| R-STATE-8 | Adding a demo account or a persona field on demo accounts MUST bump the session store `version` (`useSession.ts`, `syncDemoAccounts`). | Older installs copy demo accounts only through the migration. |
| R-STATE-9 | Timers that simulate third parties MUST be cleared by `resetDemo` and run their actions through `quietly()`. | Otherwise a reset demo receives ghost replies. |

## R-BIZ: business invariants (tests assert these)

| Id | Rule | Why |
|---|---|---|
| R-BIZ-1 | **Quote versions are immutable once sent.** Changes go through `reviseQuote` (version N+1). | The couple must always be able to compare v1, v2, v3; it is also a legal record. |
| R-BIZ-2 | Quote maths lives only in `quoteTotals()`. MUST NOT re-implement it. | One formula, mirrored once in SQL. |
| R-BIZ-3 | Milestones sum exactly to the accepted total (`buildMilestones()`; last step absorbs rounding). Default schedule 30/50/20. | A couple must never owe one rupee more or less than the quote. |
| R-BIZ-4 | Booking split: `agreedPrice = providerPayable + platformFee` for every pricing model (`splitBooking`). | Reconciliation. |
| R-BIZ-5 | Two payables per confirmed booking: 40% before (event − 7 days), 60% after (event + 3 days), summing to `providerPayable`. `ON_HOLD`, `CANCELLED`, `PAID` payables can never be released. | Providers are paid fairly and disputes can freeze money. |
| R-BIZ-6 | `activateBooking` is idempotent. | Double taps and retries must not double revenue or payables. |
| R-BIZ-7 | Money is integer NPR in the app (paisa in SQL). Customer payments and payouts never share a record. Direct vendor bookings are priced pre-VAT. | Ledgers must stay separable for accounting. |
| R-BIZ-8 | Matching recommends and never awards. Weights sum to 100 and mirror `0003`; change both together. | A human (coordinator or provider) always confirms. |
| R-BIZ-9 | Couples never see provider cost, margin or internal provider signals. | Commercial confidentiality; enforced by UI mode props and SQL views/grants. |
| R-BIZ-10 | Money rules in `src/services` and SQL MUST agree; run `npm run test:parity` after touching either. | Two implementations of money will drift unless tested. |
| R-BIZ-11 | Risk flags are computed, never stored. | Stored flags go stale. |
| R-BIZ-12 | `emergency` notifications always ring, even when muted. | A missing photographer on the wedding day is the emergency. |

## R-PER: personas and access

| Id | Rule | Why |
|---|---|---|
| R-PER-1 | Screens ask capabilities and permissions (`has(exp, 'media.camera')`, `can(exp, 'payout.release')`, `<Gate>`), never "is this a photographer?". | New trades and staff roles then need data changes only. |
| R-PER-2 | Every tool has a rule in `TOOL_RULES` (`data/access.ts`); `{}` means universal on purpose. | A tool without a rule does not compile; that is deliberate. |
| R-PER-3 | Hide, don't disable, and never dead-end: a deep link to a hidden tool or screen explains why and how to unlock it. | Users follow old links. |
| R-PER-4 | Store actions check permissions themselves; SQL mirrors them (`has_permission()`, `has_capability()`). | The UI hiding a button is not security. |
| R-PER-5 | After an intended change to what a persona sees, run `npm run check:personas -- --update` and commit the new matrix. | The matrix is the regression test for visibility. |
| R-PER-6 | Only `occasion.manage` (super admin) may add, edit or delete occasions; `wedding` and `other` can't be deleted or switched off; an occasion in use can't be deleted. | Projects reference occasions. |

## R-DB: database (Supabase / Postgres)

| Id | Rule | Why |
|---|---|---|
| R-DB-1 | Migrations are append-only: add `00NN_name.sql`; MUST NOT edit an existing migration. | Environments that already applied it would diverge. |
| R-DB-2 | RLS on every table. `npm run db:check` enforces it. | Supabase exposes tables to clients; RLS is the only gate. |
| R-DB-3 | Trigger functions that write to RLS-protected tables are `security definer set search_path = public`. Guard triggers that must let RPCs through are `security invoker`. | Learned from P5 defects. |
| R-DB-4 | Every server-side use case is an `rpc_*` function (security definer, permission-checked, audited) listed in the header of `0011`, with a check in `scripts/db/core-loop.mjs`. Internal `vivah_*` helpers stay closed to clients. | One reviewed surface for clients. |
| R-DB-5 | Money in SQL is paisa (`bigint`); app money is whole rupees; convert at the edge (`vivah_rupees()`). | Avoids float errors. |

## R-SEC: security and privacy

| Id | Rule | Why |
|---|---|---|
| R-SEC-1 | MUST NOT commit secrets. `.env.local` stays local; templates end in `.example`. Only public keys get the `EXPO_PUBLIC_` prefix. | Everything `EXPO_PUBLIC_*` ships inside the app and can be read by anyone. |
| R-SEC-2 | Gateway money is recorded **only** by `payment-verify` after the gateway's own lookup, never from a redirect or the app. | Redirect parameters can be forged. |
| R-SEC-3 | Telemetry sends route patterns and the account id with persona fields only: never names, emails, phones, ids in paths or RSVP codes. | Privacy law and trust. |
| R-SEC-4 | Legal page text MUST describe what the app really does; when data collection, processors, retention, deletion or refunds change, update `src/data/legal.ts` and bump `LEGAL_VERSION`. | Store listings and gateways link to these pages. |
| R-SEC-5 | Private files (KYC, contracts, invoices) go to the private `documents` bucket and are read through short signed links. Images go through `media-sign` and named Cloudinary transformations only. | Public CDNs are public forever. |
| R-SEC-6 | MUST NOT print, log or commit the GitHub token or any API key, including in scripts and CI logs. | Leaked tokens are used within minutes. |

## R-OPS: devops and dependencies

| Id | Rule | Why |
|---|---|---|
| R-OPS-1 | Install packages with `npx expo install <pkg>` only. | It picks versions that match SDK 57. |
| R-OPS-2 | MUST NOT regenerate `package-lock.json` on Windows. | It drops Linux-only entries (`@emnapi`) that `npm ci` in CI needs. |
| R-OPS-3 | MUST NOT create or edit `ios/` or `android/` by hand (Continuous Native Generation). Configure native behaviour in `app.json`. | They are generated. |
| R-OPS-4 | Expo APIs change every SDK. Read the versioned docs (`https://docs.expo.dev/versions/v57.0.0/`) before using an Expo API; don't trust memory. | Renamed and removed APIs are common. |

## R-GIT: git and collaboration

| Id | Rule | Why |
|---|---|---|
| R-GIT-1 | Never commit to `main`. One branch per task (`feature/…`, `fix/…`, `docs/…`) from the latest `origin/main`, pushed immediately. | The owner reviews everything as a pull request. |
| R-GIT-2 | Every pull request targets `main`. MUST NOT target another feature branch. | Owner decision (30 Sep 2026). |
| R-GIT-3 | Stage only the files your task changed (`git add <paths>`), never `git add -A`. | Several sessions may share one working tree. |
| R-GIT-4 | MUST NOT merge pull requests, push to `main`, force-push, or rewrite pushed history. The owner merges. | Safety and auditability. |
| R-GIT-5 | Don't switch branches under another session's uncommitted work; use `git worktree add`. | A checkout moves the tree for everyone. |
| R-GIT-6 | Push and open pull requests only to `github.com/amritgyawali/weddingmarketplace` (`origin`). | Other remotes belong to other accounts. |

## R-DOC: documentation

| Id | Rule | Why |
|---|---|---|
| R-DOC-1 | Every exported function, component, hook, type and store action SHOULD have a one-line JSDoc that says what it is for (not how). New exports MUST have one. | The code reference and AI tools are built from it. |
| R-DOC-2 | Every new file SHOULD start with a header comment saying what the file is for and where it fits. | `docs/reference` shows it as the file summary. |
| R-DOC-3 | MUST NOT edit `docs/reference/` by hand; change the code and run `npm run docs:generate`. | It is regenerated weekly and would overwrite you. |
| R-DOC-4 | A weekly documentation pass runs ([17](17-documentation-maintenance.md)): regenerate the reference, review every guide against the week's merged changes, raise JSDoc coverage. | Small, regular upkeep keeps docs trustworthy for years. |
| R-DOC-5 | Write docs in plain English, sentence case, short sentences; explain *why*, not only *what*. Date every time-sensitive statement (`as of 2 Oct 2026`). | Readers in five years need context that the code can't give. |

---

## Changing a rule

1. Discuss it with the owner. Product rules (R-PROD) are the owner's alone.
2. Change `AGENTS.md` and this file in the same pull request, and add an entry to [20-decision-log.md](20-decision-log.md).
3. If a check enforces the rule (`check:personas`, `db:check`, parity, lint), update the check in the same pull request.
