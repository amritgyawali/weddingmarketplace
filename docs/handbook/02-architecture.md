# 02. Architecture

## 1. The stack (as of October 2026)

| Layer | Technology | Notes |
|---|---|---|
| App | React Native 0.86, React 19.2, **Expo SDK 57**, TypeScript (strict) | One binary for iOS, Android and web. Must run in Expo Go (R-PROD-4). |
| Navigation | Expo Router (file-based), typed routes | `src/app/` |
| State | zustand 5 with `persist` (AsyncStorage) | The on-device "backend" (`useDb`) and smaller stores |
| Server reads (catalogue) | TanStack React Query 5 over `services/api.ts` | Venues, vendors, ideas: async so a real API can replace the mock data |
| Compiler | React Compiler on (`app.json` → `experiments.reactCompiler`) | No hand-written memoisation (R-FE-5) |
| Production backend | Supabase: Postgres + RLS, RPCs, Auth (email OTP), Storage, Edge Functions (Deno) | Written and tested, **not deployed** until the owner says so |
| Media | Cloudinary (signed uploads) | Public images only |
| Payments | Khalti, eSewa through Edge Functions | Demo simulates gateways |
| Email, push | Resend, Expo push | Through `notify-fanout` |
| Analytics, errors | PostHog, Sentry over plain HTTP (no SDKs) | Keeps Expo Go working |
| Web hosting | Cloudflare Pages (production), Vercel (previews) | `npx expo export -p web` |
| Builds | EAS (cloud) | `eas.json` profiles |
| CI | GitHub Actions | `.github/workflows/` |

## 2. Layers and the direction of dependencies

```
┌──────────────────────────────────────────────────────────────────────┐
│ src/app/            Screens and layouts (routes only)                │
│   reads:  useDb(selector), useWorkspace hooks, React Query hooks     │
│   writes: store actions only                                          │
├──────────────────────────────────────────────────────────────────────┤
│ src/components/     UI: kit (role apps), ui (primitives), work         │
│                     (shared workflow panels), toolkit, persona …      │
├──────────────────────────────────────────────────────────────────────┤
│ src/hooks/          useWorkspace, useExperience, useLayout, queries … │
├──────────────────────────────────────────────────────────────────────┤
│ src/store/          useDb (the on-device backend: store/db/*),        │
│                     useSession (accounts + session), useAppStore,     │
│                     actionToasts, lazyStorage                          │
├──────────────────────────────────────────────────────────────────────┤
│ src/backend/        Backend interface: mock (the store) | supabase     │
│                     + auth, media, files, payments, push, telemetry   │
├──────────────────────────────────────────────────────────────────────┤
│ src/services/       Pure business logic: quotes, pricing, matching,   │
│                     risk, planner, experience (personas), toolkit …   │
├──────────────────────────────────────────────────────────────────────┤
│ src/data/           Static catalogue + registries + the demo seed     │
│ src/types/          The domain model (mirrors the SQL schema)         │
│ src/utils/ i18n/    Formatting, dates (BS), links, translation        │
│ src/theme/ constants/  Design tokens, role themes, env                │
└──────────────────────────────────────────────────────────────────────┘
          ▲ dependencies point down only. Services never import React or stores.

supabase/migrations/   The production schema, RLS, RPCs (mirror of store actions)
supabase/functions/    Edge Functions (Deno), pure logic in _shared/
scripts/               Node checks: personas, PGlite SQL harness, parity, docs
```

Rules for the layers are R-ARCH-1 to R-ARCH-6 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

## 3. Folder map

```
src/
  app/                 Expo Router screens only (every file is a route; _layout.tsx = navigators)
    (tabs)/            couple marketplace tabs
    business/ freelancer/ platform/   the three role apps (each has (tabs)/ and a _layout.tsx)
    welcome/ onboarding/              sign-in and first-run
    w/ rsvp/ legal/ pay/              public pages
  components/
    kit/               role-themed primitives (Card, KButton, KField, Segmented, KpiCard, BarChart…)
    ui/                base primitives (Text, PressableScale, Toast, Dialog, Sheet, Keyboard, Calendar…)
    work/              shared workflow UI used by several roles (MatchPanel, QuoteEditor, Bookings…)
    toolkit/           role toolkits: core.tsx (EntryList), hub.tsx, couple/ vendor/ freelancer/ platform/
    persona/           Gate, StaffGate, persona pickers, setup checklist
    admin/             super admin console building blocks
    home/ listing/ detail/ planner/ wedding/ onboarding/ navigation/ ideas/ genie/
  store/
    db/                THE shared backend, split by domain (core, quotes, projects, finance, gigs,
                       chat, trust, planner, toolkit, personas, admin) + helpers.ts + types.ts
    useDb.ts           re-export of store/db
    useSession.ts      accounts and session (mock auth)
    useAppStore.ts     per-device couple state (onboarding answers, city, shortlist, active project)
  backend/             Backend interface + Supabase adapters (auth, account, media, files, payments, push, telemetry)
  services/            pure business logic
  data/                Nepal catalogue, registries (services, trades, crafts, occasions, permissions, access, features) and seed.ts
  hooks/               useWorkspace, useExperience, useLayout, useFeatures, queries (React Query) …
  i18n/                language and calendar prefs, translation runtime, Nepali dictionary (ne/)
  theme/ constants/    tokens, role themes, fonts, env, brand, images
  types/               platform.ts (domain), persona.ts, toolkit.ts, index.ts (catalogue/legacy)
  utils/               format (money/dates/phone), bs (Bikram Sambat), confirm, links, random
supabase/
  migrations/          0001 … 0016, append-only
  functions/           send-otp, media-sign, notify-fanout, payment-initiate, payment-verify, health, account-delete, _shared/
  templates/           auth email templates
scripts/               check-personas, db/ (PGlite harness), test-functions, test-telemetry, docs/, ops/
docs/                  handbook/ (this), reference/ (generated), MASTER_PLAN, SETUP_SUPABASE, LAUNCH
.github/workflows/     ci, keep-alive, backup, restore-rehearsal, deploy-web, docs-weekly
```

The exact contents of every folder are in [the code reference](../reference/README.md).

## 4. How data flows: one action, end to end

Example: a coordinator sends a quote.

1. **Screen** `src/app/platform/quote/[id].tsx` takes the action with `const sendQuote = useDb((s) => s.sendQuote)` and, on "Send", calls `sendQuote(quote.id, summary)`.
2. **Store action** `sendQuote` in `src/store/db/quotes.ts`:
   - checks permission (`staffDenied('quote.send', project)`) and preconditions;
   - freezes the working copy with `snapshot()` from `services/quotes.ts` into `versions[]`;
   - updates state immutably, moves the project status, writes the audit log and notifies the couple with an `href`;
   - returns `null` or an error string.
3. **Action toasts** (`store/actionToasts.ts`) wrap every action once: the screen shows "Quote sent" or the error in red, without code in the screen.
4. **Persistence**: `lazyStorage` writes the store to AsyncStorage 400 ms later (or at once if the app goes to the background).
5. **Other roles** see the change instantly on the same device (demo) because they read the same store. On Supabase the same step is `rpc_send_quote` (`0011_core_rpc.sql`), called through `backend().sendQuote`.

## 5. Two backends, one app

```
screens → store actions (unchanged) → Backend
                                      ├─ mock: the zustand store (demo, Expo Go) — default
                                      └─ supabase: the RPCs in supabase/migrations/0011
```

`backend()` in `src/backend/index.ts` picks one from `EXPO_PUBLIC_BACKEND` (`mock` or `supabase`; it falls back to `mock` when Supabase is not configured). Every method returns a `Result` (`{ ok, value } | { ok: false, error }`) instead of throwing. Amounts are whole rupees in the app; the Supabase adapter converts to paisa. Details in [06-backend.md](06-backend.md).

The money logic exists twice (TypeScript in `src/services`, SQL helpers in `0011`), and `npm run test:parity` proves they agree on shared fixtures (`scripts/parity-fixtures.json`).

## 6. Persistence

| Store | Key | Holds | Version |
|---|---|---|---|
| `useDb` | `vivah-db` | every shared collection in `DbData` (projects, quotes, payments, gigs, threads, toolkit records, occasions…) | 5 |
| `useSession` | `vivah-session` | accounts and the current session (mock auth; a mirror of the Supabase user on live builds) | 6 |
| `useAppStore` | `vivah-app-store` | per-device couple state (onboarding answers, city, shortlist, likes, active project) | 1 |
| `usePrefs` | `vivah-prefs` | language and calendar | 1 |

Versions are as of October 2026; the current number is in each file's `persist` options.

The root layout waits for all of them to rehydrate before routing (`useHydrated`). Migrations are additive (`migrate` in `store/db/index.ts`). See [05-state-and-data.md](05-state-and-data.md).

## 7. Key architecture decisions

Each is explained in [20-decision-log.md](20-decision-log.md).

- On-device mock backend first, with the full SQL written alongside, so the product can be demoed end to end with zero infrastructure.
- Store actions as the API: one action per use case, side effects inside.
- Personas as data (`taxonomy → capabilities → surfaces`), so adding a trade or occasion is a data change.
- No native SDKs (analytics, errors, payments go over HTTP) to keep Expo Go working.
- Free-tier production stack (Supabase, Cloudflare, Cloudinary, Resend, PostHog, Sentry, Better Stack, Upstash).
