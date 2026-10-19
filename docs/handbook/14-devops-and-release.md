# 14. DevOps and release

Environments, local setup, CI, builds, hosting, backups and releases. Step-by-step runbooks: [`docs/SETUP_SUPABASE.md`](../SETUP_SUPABASE.md) (staging) and [`docs/LAUNCH.md`](../LAUNCH.md) (production).

Rules: R-OPS-1 … R-OPS-4, R-PROD-5, R-PROD-10 in [00-rules-and-regulations.md](00-rules-and-regulations.md).

## 1. Local development

Requirements: Node 24+ (the Node scripts rely on its TypeScript stripping), npm, Git, a phone with **Expo Go (SDK 57)** or a browser.

```bash
git clone https://github.com/amritgyawali/weddingmarketplace.git wedding-app
cd wedding-app
npm ci                     # or npm install; never regenerate the lockfile on Windows (R-OPS-2)
npx expo start             # scan the QR with Expo Go, or press w for web, a/i for emulators
```

Tap a user type to enter its local demo workspace. No keys are needed: `EXPO_PUBLIC_BACKEND` defaults to `mock`. The welcome/Get started, phone/OTP and setup routes are hidden in this mode. Set `EXPO_PUBLIC_ROLE_ENTRY=credentials` to restore the previous demo sign-in (OTP 1234). Direct entry is always disabled for `EXPO_PUBLIC_BACKEND=supabase`, including when keys are absent; real accounts still require authenticated sign-in.

Useful variants:

| Command | Use |
|---|---|
| `npx expo start --web` | The web build (staff console on desktop) |
| `npx expo start --clear` | Clear Metro's cache (stale routes, worktrees) |
| `npx expo start --lan --port 8081` | Phone on the same Wi-Fi |
| `node scripts/db/local-api.mjs` + `EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local npx expo start --web` | The Supabase build against a local stand-in (code 123456) |

## 2. Environments

| Environment | Backend | App | Web |
|---|---|---|---|
| Demo / development | mock (on device) | Expo Go | `npx expo start --web` |
| Staging | Supabase project 1 | EAS development/preview build | Vercel preview per pull request |
| Production | Supabase project 2 | store builds (Google Play first) | Cloudflare Pages on `main` |

Owner decisions: everything on free tiers (Cloudflare Pages for production web, Vercel Hobby only for previews), Expo Go stays the development and demo path, EAS development builds for production-only features (push, native crash reporting).

## 3. CI and scheduled workflows (`.github/workflows/`)

| Workflow | When | Does |
|---|---|---|
| `ci.yml` | every pull request and push to `main` | `npm ci`, tsc, lint, `check:personas`, `db:check`, `db:test`, `test:parity`, `test:functions`, `test:telemetry`, `expo export -p web`, checks that `_headers`, `robots.txt`, `sitemap.xml` ship |
| `deploy-web.yml` | push to `main`, manual | Builds the web app and deploys it to Cloudflare Pages (environment `production`); skips with a notice until the token exists |
| `keep-alive.yml` | daily 03:30 UTC (09:15 Kathmandu) | Calls `rpc_health` on staging and production (free projects pause after 7 idle days); Better Stack heartbeat |
| `backup.yml` | nightly | `supabase db dump`, row counts, age-encrypted tarball to Cloudflare R2 (daily 30 days, monthly 365 days); heartbeat |
| `restore-rehearsal.yml` | first day of each quarter, manual | Restores a backup into a throwaway local stack and verifies row counts and `rpc_health`; needs the owner's approval (environment `restore`) |
| `docs-weekly.yml` | Mondays, manual | Regenerates `docs/reference` and opens a pull request if anything changed ([17](17-documentation-maintenance.md)) |

Every workflow that needs secrets skips with a notice until its GitHub environment secrets exist.

## 4. Mobile builds (EAS)

EAS project `@amritgyawali/vivah-wedding-marketplace` (id in `app.json` → `extra.eas.projectId`). Builds run in Expo's cloud: no Android Studio or Xcode needed.

| Profile (`eas.json`) | Output | Notes |
|---|---|---|
| `preview` | Android APK / iOS ad hoc, internal distribution | `EXPO_PUBLIC_BACKEND=mock`, payments sandbox |
| `ios-simulator` | iOS simulator build | |
| `production` | Android App Bundle, auto-incremented version | mock backend, sandbox payments, direct role selection, bug reporting off; upload to Play internal track as a draft |

```bash
npx -y eas-cli@latest build -p android --profile preview --no-wait
npx -y eas-cli@latest build:view <id> --json
```

iOS installable builds need a paid Apple Developer account, which conflicts with the free-only rule; the owner decides. App identifiers: `com.vivah.marketplace` on both platforms; URL scheme `vivah`.

The October 2026 direct-role AAB is a local demo edition: Super admin controls only that device's demo data. It does not connect users or process live payments. Before a live marketplace release, configure the authenticated Supabase environment and an appropriate build profile.

JavaScript-only changes can later ship through EAS Update; native changes need a new store build. Don't create or edit `ios/`/`android/` (R-OPS-3).

Android media uploads use the system image/video picker. `app.json` blocks `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` and `READ_EXTERNAL_STORAGE`, including permissions inherited from dependencies. The screenshot reporter's automatic detection is available on iOS and Android 14+ only; Android 13 and earlier can still use the other report entry points when reporting is enabled. Legacy camera capture retains `WRITE_EXTERNAL_STORAGE` (Android 9 and earlier). Verify the final AAB's merged manifest before upload: it must contain none of the three blocked permissions. Upload the new, higher version-code bundle to replace any earlier bundle requesting broad photo access; do not submit a broad-access justification for selected-photo uploads.

## 5. Web hosting

`npx expo export -p web` produces `dist/` (single-page app, `web.output: "single"`). Cloudflare Pages serves it in production with `public/_headers`; Vercel previews use `vercel.json` (same headers, SPA rewrite). Deep links like `/w/…`, `/rsvp/…`, `/pay/…`, `/legal/…` work when opened directly.

## 6. Database releases

- Migrations go to staging when a pull request merges, and to production on a release after a backup ([`docs/LAUNCH.md`](../LAUNCH.md)).
- Only with the owner's go-ahead (R-PROD-10).
- `npm run setup:supabase` (`scripts/supabase-setup.mjs`, on `main` since PR #34, 3 Oct 2026) automates project setup through the Management API; the owner runs it. Metro's transform cache lives in `.expo/metro-cache` inside each checkout (`metro.config.js`, PR #29), so git worktrees sharing `node_modules` don't read each other's cached routes ("Unable to resolve @/..."). CI also runs `npm run test:social`.

## 7. Dependencies

- Add packages only with `npx expo install <pkg>` (R-OPS-1), and only modules bundled in Expo Go SDK 57 (R-PROD-4).
- `npx expo install --fix` aligns versions; `npx expo-doctor` diagnoses.
- Don't regenerate `package-lock.json` on Windows (R-OPS-2): it drops Linux-only optional entries and breaks `npm ci` in CI. If a lockfile change is unavoidable, let CI or a Linux machine produce it.
- **Upgrading Expo SDK** (roughly yearly): read the SDK changelog and the versioned docs first (R-OPS-4), upgrade on a dedicated branch with `npx expo install expo@^NN --fix`, run the whole Definition of Done, smoke-test every role in Expo Go of the new SDK, then update the SDK number in `AGENTS.md`, this handbook and `README.md`.

## 8. Monitoring

| Signal | Tool |
|---|---|
| Uptime | Better Stack → `health` function |
| Product analytics, JS errors | PostHog (`src/backend/telemetry.ts`) |
| Errors in production builds | Sentry (envelopes over HTTP) |
| Database and API logs | Supabase logs and advisors |
| Missed backups | Better Stack heartbeats |

Setup: [`docs/LAUNCH.md`](../LAUNCH.md) §6.
