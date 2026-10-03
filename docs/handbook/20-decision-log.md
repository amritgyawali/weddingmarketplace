# 20. Decision log

Dated decisions and the reasons behind them, newest last. The code shows *what* was built; this log keeps *why*, so nobody reverses a decision by accident in five years.

**Format:** date (as exact as known) · decision · who decided · why · where it shows in the code. Add an entry whenever the owner decides something, a rule changes, or an architecture choice is made. Never delete entries; mark them *superseded by* a later one.

| # | Date | Decision | By | Why | In the code |
|---|---|---|---|---|---|
| D-1 | 2026-09-29 | Nepal only: NPR, 13% VAT, Nepali cities, ceremonies and payment methods; remove the Indian catalogue, ₹ and GST | owner | The product is for the Nepali market | `src/data/*`, `utils/format.ts`, `services/pricing.ts` |
| D-2 | 2026-09-29 | Backend = on-device mock (zustand `useDb`) plus a full Postgres/Supabase SQL schema written to the repo, not deployed | owner | Demo end to end with zero infrastructure; production design ready | `src/store/db`, `supabase/migrations` |
| D-3 | 2026-09-29 | Admin/operations console lives in the same Expo app (Platform role), web-ready; no separate web project | owner | One codebase | `src/app/platform`, `useLayout` |
| D-4 | 2026-09-29/30 | Remove every "AI look": Mukta + Martel fonts, no gradients or glows, sentence case, no emoji, rename the assistant "Quick help" and Genie "Vivah Planners" | owner | The app must read as built by experienced human designers | `constants/theme.ts`, `AGENTS.md` §8 (PRs #3, #4) |
| D-5 | 2026-09-30 | Every task: new branch from `origin/main`, pushed at once, committed and opened as a PR **into `main`** when done; never stack PRs on feature branches; the owner merges | owner | Everything visible and reviewable on GitHub | `AGENTS.md` §9 |
| D-6 | 2026-09-30 | Vendors: one primary service plus any number of add-ons from any trade | owner | Real businesses span trades | `Account.services`, master plan §17 |
| D-7 | 2026-09-30 | The nine built-in occasions are right; a super admin can add, edit and delete occasions | owner | Flexibility without code changes | `data/occasions.ts`, `occasion.manage` |
| D-8 | 2026-09-30 | Non-wedding occasions show only related marketplace categories (hide, not rank lower) | owner | Relevance | `data/categories.ts` |
| D-9 | 2026-09-30 | Keep the name "Vivah" for now; rebrand later. New copy takes the name from `BRAND.name` | owner | Rebrand planned | `constants/brand.ts` |
| D-10 | 2026-09-30 | Everything on free tiers: Cloudflare Pages for production web, Vercel Hobby for previews only | owner | Pre-revenue | `deploy-web.yml`, `vercel.json` |
| D-11 | 2026-09-30 | Expo Go stays the development and demo path; EAS development builds for production-only features | owner (left to the team, team chose) | Keep the demo frictionless | `AGENTS.md` "Native rules" |
| D-12 | 2026-09-30 | Email OTP only for the first year; phone OTP through a Nepali SMS gateway after about a year | owner | SMS costs money per message | `backend/auth.ts`, `send-otp` |
| D-13 | 2026-09-30 | Build order P0 (persona foundation) then P1 (vendors first) … P8 | owner | Vendors are the supply side | `docs/MASTER_PLAN.md` §15 |
| D-14 | 2026-09-30 | Test the SQL locally with PGlite (in-process Postgres) and prove money parity between TypeScript and SQL | team (P5) | No Supabase project needed; two money implementations must agree | `scripts/db/*` |
| D-15 | 2026-09-30 | Never regenerate `package-lock.json` on Windows | team | It broke `npm ci` in CI | R-OPS-2 |
| D-16 | 2026-10-01 | Telemetry (PostHog, Sentry) over plain HTTP without SDKs | team (P8) | SDKs need native code and would break Expo Go | `backend/telemetry.ts` |
| D-17 | 2026-10-02 | Nepali language and Bikram Sambat calendar by default; super admin console | owner (PR #19) | Nepal-first; operate without code changes | `src/i18n`, `utils/bs.ts`, `/platform/admin` |
| D-18 | 2026-10-02 | "Royal Nepali Luxury" palette (burgundy, wine, champagne, ivory) across all apps; supersedes per-role accents from D-4 | owner (PR #20) | The app should feel luxurious | `constants/theme.ts`, `theme/roles.ts` |
| D-19 | 2026-10-02 | Push and open PRs only on `github.com/amritgyawali/weddingmarketplace` (`origin`), never other accounts' remotes | owner | Other remotes belong to other accounts | R-GIT-6 |
| D-20 | 2026-10-02 | Documentation system: numbered rules (00), a handbook per area, a generated code reference (`npm run docs:generate`), `llms.txt` for AI, and a weekly documentation pass | owner | A new developer or AI must understand the app even five years from now | `docs/handbook`, `docs/reference`, `scripts/docs`, `docs-weekly.yml` |
| D-21 | 2026-10-03 | Businesses get a social hub: Facebook, Instagram, WhatsApp and TikTok connected, one inbox for messages and comments, one-click publishing and scheduling to all of them ("like Postiz, more advanced") | owner | Couples in Nepal find and message vendors on social media first | [21-social-hub.md](21-social-hub.md), `/business/social`, 0017–0018 |
| D-22 | 2026-10-03 | Social hub on official APIs only (Meta Graph and WhatsApp Cloud API, TikTok Login Kit, Content Posting API and API for Business), all free; tokens server-side only; WhatsApp "posts" are opted-in template broadcasts because WhatsApp has no Status API | team | Unofficial automation gets accounts banned; tokens are account keys | `_shared/social.ts`, `social_account_secrets` |
| D-23 | 2026-10-03 | UI "finish and craft" pass inside the Royal Nepali Luxury palette: WCAG AA contrast for every text token and 3 : 1 control borders (small value shifts to `textMuted`, `textSubtle`, `goldDeep`, `warning`), gilt tab marks, photo fade-in, medallion empty states with Nepali line drawings, one wine `FocusBand` per dashboard, editorial Vendors tab, Reduce Motion support, and a lint rule against hex literals | owner request ("make every screen beautiful, 2026 standard"), team chose the means | Accessibility and craft were the gap, not colour (`docs/UI_UX_REPORT.md` §6) | [04-ui-ux.md](04-ui-ux.md), `constants/theme.ts`, `eslint.config.js` |

## Open questions and future deadlines

| Topic | Note |
|---|---|
| BS calendar table | Ends at BS 2090 (about April 2034); extend before then ([11 §2](11-i18n-dates-money.md#2-dates)) |
| Store test harness | Store actions have no in-repo unit tests yet ([12 §2](12-testing-and-qa.md#2-what-each-check-proves)) |
| Rebrand | Planned; ~57 files still hard-code "Vivah" and move to `BRAND.name` as they are touched |
| iOS release | Needs a paid Apple Developer account; conflicts with the free-only rule |
| Phone OTP | Planned after about a year of email OTP |
| Social hub go-live | Needs a Meta Business app through App Review, approved WhatsApp templates and a TikTok app audit before real (public) posting; see [SETUP_SUPABASE §6a](../SETUP_SUPABASE.md) |
