# Launching Vivah (P8)

The runbook for going from the staging project in `docs/SETUP_SUPABASE.md` to a public Android release and a live web console. Everything here is on a free tier (owner decision, master plan §17); the only unavoidable costs are the Google Play registration (USD 25, once) and, later, the Apple Developer Program (§9).

The code side is done: health checks, backups, the restore rehearsal, error and analytics reporting, the legal pages, in-app account deletion and data export, web hosting config and the production build profile. What remains needs the owner's accounts and approval, so each step says who does it.

**Nothing in this repo deploys or applies SQL by itself.** Every workflow below skips with a notice until its secrets exist.

---

## 0. Before you start

- [ ] Staging works end to end (`docs/SETUP_SUPABASE.md` §7).
- [ ] The legal pages are reviewed. `src/data/legal.ts` holds the Terms, Privacy policy, Cancellation and refund policy and the account deletion page. Before launch, the owner (ideally with a lawyer) confirms them, and fills `BRAND.legalEntity` and `BRAND.registeredAddress` in `src/constants/brand.ts` with the registered company name and address. These operational promises in the text are the owner's to confirm or change: replies within 30 days, refund review in about 2 working days, refunds paid in about 7 working days, day-of problems reported within 7 days, deletion requests by email handled within 30 days. If anything changes, bump `LEGAL_VERSION` and the dates in `public/sitemap.xml`.
- [ ] `BRAND.supportEmail` (`support@vivah.app`) and the domain below (`vivah.com.np`) agree, and the mailbox exists.

## 1. Accounts (all free)

| Service | Used for | Who |
|---|---|---|
| Supabase (second project) | production database, auth, storage, Edge Functions | owner |
| Cloudflare | DNS for vivah.com.np, Pages (web), R2 (backups), Turnstile | owner |
| Better Stack | uptime monitors, heartbeats, status page | owner |
| PostHog (US or EU cloud) | product analytics and JavaScript error tracking | owner |
| Sentry | error reports from store builds | owner |
| Google Play Console | the Android release (USD 25 once) | owner |
| Google Search Console, Bing Webmaster Tools | indexing the public pages | owner |

## 2. Production Supabase project

Same steps as staging (`docs/SETUP_SUPABASE.md` §2–§6) on a second project named `vivah-production`, in the region closest to Nepal (Singapore, `ap-southeast-1`), then:

1. Apply migrations `0001`–`0015` (`npx supabase db push` after `npx supabase link --project-ref <production ref>`). `0015_launch.sql` adds `rpc_health`, consent records, data export and account deletion.
2. Deploy all Edge Functions, including the two new ones:
   ```bash
   npx supabase functions deploy health --no-verify-jwt
   npx supabase functions deploy account-delete
   ```
3. Set the function secrets (`npm run env:functions`, then `npx supabase secrets set --env-file supabase/.env.functions.local`) with the **production** values: live Khalti and eSewa keys only once the merchant accounts are approved (§9 of the master plan); until then keep the sandbox.
4. Authentication → URL configuration: site URL `https://vivah.com.np`, redirect URLs `vivah://` and `https://vivah.com.np`.
5. Check: `curl https://<ref>.supabase.co/functions/v1/health` answers `{"ok":true,"db":"up",…}`.

## 3. GitHub environments, secrets and variables

Repository → Settings → Environments. Create three:

| Environment | Variables (public) | Secrets |
|---|---|---|
| `staging` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | `BETTERSTACK_KEEPALIVE_HEARTBEAT_URL` (optional) |
| `production` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_BACKEND=supabase`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_PAYMENT_MODE`, `BACKUP_AGE_RECIPIENT`, `R2_BUCKET`, `CLOUDFLARE_PAGES_PROJECT` | `SUPABASE_DB_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BETTERSTACK_KEEPALIVE_HEARTBEAT_URL`, `BETTERSTACK_BACKUP_HEARTBEAT_URL` |
| `restore` (**required reviewer: the owner**) | `R2_BUCKET` | `BACKUP_AGE_IDENTITY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |

Don't add a required reviewer to `staging` or `production`: the nightly backup and daily keep-alive run unattended.

| Workflow | When | What |
|---|---|---|
| `keep-alive.yml` | daily 09:15 NPT | calls `rpc_health` on staging and production so the free projects never pause; heartbeat to Better Stack |
| `backup.yml` | nightly 03:15 NPT | encrypted dump to R2 (§5) |
| `restore-rehearsal.yml` | quarterly, and on demand | restores a backup into a throwaway local stack and checks it (§5) |
| `deploy-web.yml` | every push to `main` | builds the web app and deploys it to Cloudflare Pages (§4) |
| `ci.yml` | every pull request | also runs the telemetry tests and a full web build now |

## 4. Web: Cloudflare Pages (production) and Vercel (previews)

Vercel's free plan is non-commercial, so it only builds pull-request previews (`vercel.json`); production is on Cloudflare Pages (master plan §7.7).

1. Cloudflare → Workers & Pages → Create → Pages → **Direct upload**, name it `vivah` (or set `CLOUDFLARE_PAGES_PROJECT`). Deploys come from `deploy-web.yml`, not from Cloudflare's Git integration, so the build uses the environment variables in §3.
2. Create an API token with **Account → Cloudflare Pages → Edit**; save it and the account id as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the `production` environment.
3. Run **Deploy web** once from the Actions tab.
4. Pages → the project → Custom domains → add `vivah.com.np` (and `www`). With the domain's DNS on Cloudflare this is automatic.
5. Check: `https://vivah.com.np/legal/privacy` opens directly (not only by navigating), and the response has the headers from `public/_headers`.

The build has no `404.html`, so Pages serves `index.html` for every unknown path and Expo Router takes over; that is why there is no `_redirects` file.

## 5. Backups and the restore rehearsal

Supabase's free plan keeps no backups (master plan §10.2).

1. On a trusted computer, install [age](https://github.com/FiloSottile/age) and run `age-keygen -o vivah-backup.key`. It prints the public key (`age1…`): save it as the `BACKUP_AGE_RECIPIENT` variable in `production`. **The private key file is the only way to read backups.** Keep it offline in two places (for example a password manager and an encrypted USB drive).
2. Cloudflare → R2 → create bucket `vivah-backups`. Settings → Object lifecycle rules: delete objects with prefix `daily/` after 30 days, prefix `monthly/` after 365 days.
3. R2 → Manage API tokens → create a token with **Object Read & Write** on that bucket only. Save the access key id, secret and account id in `production` and `restore`.
4. `SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** connection string (IPv4, port 5432), with the database password. Save it in `production`.
5. Run **Database backup** from the Actions tab and check a `daily/vivah-<date>.tar.gz.age` object appears.
6. **Restore rehearsal:** paste the private key file's contents into the `restore` environment's `BACKUP_AGE_IDENTITY` secret, run **Restore rehearsal**, approve it, and read the summary: every table's row count must match the dump, and `rpc_health` must answer. P8 is done only after one rehearsal has passed. Afterwards you may delete the secret again and re-add it for each quarterly run (the run waits for approval anyway).

What a backup holds: roles, schema and all rows (including `auth.users`), plus row counts. It does **not** hold the files in Supabase Storage (KYC documents, contracts, invoices; under 1 GB in year one) or Cloudinary media. Cloudinary keeps its own copies; for the documents bucket, download it from the dashboard monthly until a file backup is added.

To restore for real: create a new project, then run the same `psql` commands as the rehearsal workflow against it, redeploy the functions and secrets (§2), and point the app's variables at it.

## 6. Monitoring: Better Stack, PostHog, Sentry

**Better Stack** (free: 10 monitors, 1 status page):

| Monitor | Type | Target |
|---|---|---|
| API | Keyword, every 3 min | `https://<prod ref>.supabase.co/functions/v1/health`, keyword `"ok":true` |
| Web | HTTP status | `https://vivah.com.np` |
| Legal pages | HTTP status | `https://vivah.com.np/legal/privacy` |
| Keep-alive | Heartbeat, daily with 2 h grace | URL → `BETTERSTACK_KEEPALIVE_HEARTBEAT_URL` |
| Backups | Heartbeat, daily with 2 h grace | URL → `BETTERSTACK_BACKUP_HEARTBEAT_URL` |

Create a status page at `status.vivah.com.np` with the API and Web monitors, and alert the on-call coordinator by email and push.

**PostHog:** create a project, turn on Error tracking, and copy the project API key (`phc_…`) and host into `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` (GitHub `production` variables and EAS `production` environment). The app sends screen views by route pattern (never ids, codes or slugs), the account id with role, staff role, trade and craft (never names, emails or phones), and JavaScript errors as `$exception`. Users can switch analytics off in Settings; errors are still sent.

**Sentry:** create a React Native project and copy its DSN into `EXPO_PUBLIC_SENTRY_DSN`. The app reports JavaScript errors (uncaught, unhandled promise rejections and render errors) from store and preview builds over Sentry's HTTP API. Native crash capture needs `@sentry/react-native`, which adds native code; that means a development build instead of Expo Go and the owner's approval (AGENTS.md §10). Add it in a follow-up once the owner agrees; the DSN stays the same.

## 7. Search Console and Bing

1. Google Search Console → Add property → **Domain** `vivah.com.np` → add the TXT record in Cloudflare DNS.
2. Sitemaps → submit `https://vivah.com.np/sitemap.xml`.
3. Bing Webmaster Tools → Import from Google Search Console.

`public/robots.txt` keeps the signed-in consoles, payment returns and RSVP codes out of search.

## 8. Android release (Google Play)

1. EAS → project → Environment variables → **production**: add every `EXPO_PUBLIC_*` value from §3 (including `EXPO_PUBLIC_BACKEND=supabase`). The `production` build profile reads them (`eas.json` → `"environment": "production"`); without them the build falls back to the demo backend.
2. Build: `npx eas-cli@latest build -p android --profile production` (an `.aab`; the version code counts up by itself).
3. Play Console → Create app → fill the store listing. Use:
   - Privacy policy: `https://vivah.com.np/legal/privacy`
   - Account deletion URL (Data safety → Data deletion): `https://vivah.com.np/legal/delete-account`
   - App access: explain the email-code sign-in and give a reviewer test account.
4. Data safety form (from what the app actually does; see the privacy policy):
   - Collected: name, email, phone number, approximate and precise location (check-in, only while in use), photos and videos (uploads), files and docs (verification), messages, contacts (only the ones picked), purchase history (payments), app interactions, crash logs, diagnostics, device ids (push token).
   - Shared with third parties: none sold; processors listed in the policy.
   - Encrypted in transit: yes. Users can request deletion: yes (in app and on the web page).
5. The **first** upload of a new app must be done by hand in Play Console (Internal testing → Create release → upload the `.aab`). After that, `npx eas-cli@latest submit -p android --profile production` sends builds to the internal track as drafts (`eas.json` → `submit.production`), using a Google service account key uploaded to EAS credentials.
6. Internal testing → closed testing (Play requires 12 testers for 14 days for new personal developer accounts) → production.

## 9. Go-live checklist (P8 "done when")

- [ ] Production project on 0015, functions deployed, `health` answers.
- [ ] Keep-alive and backup workflows green for three nights; heartbeats received.
- [ ] Restore rehearsal passed (summary shows every table matching).
- [ ] Web console live on `https://vivah.com.np`; legal pages open directly.
- [ ] Better Stack monitors and status page up.
- [ ] PostHog shows screens and a test error; Sentry shows a test error from a preview build.
- [ ] Sitemap submitted to Search Console and Bing.
- [ ] Legal text reviewed; `BRAND.legalEntity` and address filled.
- [ ] Account deletion tested on staging: blocked while a booking is confirmed, works after; the email can't sign in again; files gone from the documents bucket.
- [ ] Android production release published.
