# 06. Backend

Vivah has two backends behind one interface:

- **mock** (default): the on-device zustand store (`useDb`). Runs in Expo Go with no network. Used for the demo and for development.
- **supabase**: Postgres + RLS + RPCs + Auth + Storage + Edge Functions. Written and tested locally, switched on per build with `EXPO_PUBLIC_BACKEND=supabase`. As of 2 October 2026 a Supabase project exists for the owner (`docs/SETUP_SUPABASE.md`), but production go-live is an owner task (`docs/LAUNCH.md`).

Rules: R-ARCH-6, R-PROD-10, R-SEC-* in [00-rules-and-regulations.md](00-rules-and-regulations.md). Database details: [07-database.md](07-database.md). Function list: [Edge Functions reference](../reference/edge-functions.md).

## 1. The `Backend` interface (`src/backend/`)

`src/backend/types.ts` defines the core loop as one interface:

| Method | SQL RPC (0011) |
|---|---|
| `submitPlan(input)` | `rpc_submit_plan` |
| `setProjectStatus(projectId, status, note?)` | `rpc_set_project_status` |
| `assignCoordinator(projectId, coordinatorId)` | `rpc_assign_coordinator` |
| `sendQuote(quoteId, changeSummary?)` | `rpc_send_quote` |
| `reviseQuote(quoteId)` | `rpc_revise_quote` |
| `respondToQuote(quoteId, action, note?)` | `rpc_respond_to_quote` |
| `confirmBooking(projectId, bookingId)` | `rpc_confirm_booking` |
| `cancelBooking(projectId, bookingId, reason)` | `rpc_cancel_booking` |
| `recordPayment(projectId, milestoneId, amount, method, reference?)` | `rpc_record_payment` |
| `releasePayable(payableId, kind, reference?)` | `rpc_release_payable` |
| `requestRefund(paymentId, amount, reason)` / `decideRefund(refundId, approve)` | `rpc_request_refund` / `rpc_decide_refund` |

- Every method returns `Promise<Result<T>>`: `{ ok: true, value }` or `{ ok: false, error }`. Nothing throws to the screen.
- Amounts are whole rupees; `supabase.ts` converts to paisa and app enums to SQL enums.
- `backend()` (`src/backend/index.ts`) returns `supabaseBackend` when `ENV.backend === 'supabase'` **and** Supabase is configured (`usesSupabase()`), otherwise `mockBackend`.
- `mock.ts` only adapts the existing store actions to this shape; the store stays the source of truth for the demo.

**Adding a core-loop method:** add it to `Backend` with JSDoc, implement it in `mock.ts` (calling the store action) and `supabase.ts` (calling a new `rpc_*`), add the RPC in a new migration with a check in `scripts/db/core-loop.mjs`, and keep both money implementations in step (`npm run test:parity`).

## 2. The other backend modules

| File | Does | Runs when |
|---|---|---|
| `auth.ts` | Email OTP sign-in (`emailOtp`), session in SecureStore (localStorage on web), token refresh (`getAccessToken`), `signOut`. Phone OTP later = a new `AuthProvider`. | Supabase builds |
| `account.ts` | `fetchMe` (`rpc_me`), `completeSignup` (`rpc_complete_signup`), mirror the user into a local `Account` (`accountFromMe`), `acceptLegal`, `exportMyData`, `deleteMyAccount` | Supabase builds |
| `media.ts` | Cloudinary uploads signed by `media-sign`, recorded by `rpc_register_media`; `cloudinaryUrl(publicId, 't_card')` builds URLs with **named transformations only** | when `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` is set |
| `files.ts` | Private documents (KYC, contracts, invoices) in the Supabase `documents` bucket under `<user id>/…`; read with five-minute signed links | Supabase builds |
| `payments.ts` | Khalti and eSewa: `startOnlinePayment` (→ `payment-initiate`), `checkOnlinePayment` (→ `payment-verify`); return to `/pay/result` | Supabase builds; the demo simulates gateways in `PaymentSheet` |
| `push.ts` | Registers the Expo push token (`rpc_register_push_token`) | development and store builds only (not Expo Go) |
| `telemetry.ts` + `telemetryPayloads.ts` | PostHog events, screens and `$exception`s; Sentry envelopes; over plain HTTP, batched | when the keys are set; no-op in the demo |

Sign-in on Supabase builds: every role gets a 6-digit **email** code (R-PROD-6) through `send-otp` → Supabase Auth. First sign-in goes through the same setup screens, which call `rpc_complete_signup`. Staff also need the access code an admin set (`rpc_set_staff_access_code`, stored hashed) and an approval (`rpc_decide_staff_request`). The device keeps a mirror `Account` with the auth user's id, so the role apps work unchanged.

## 3. Edge Functions (`supabase/functions/`)

Deno, **no dependencies** (plain `fetch` to Supabase REST, Cloudinary, gateways, Resend, Upstash). Shared, pure logic lives in `_shared/` and is tested in Node by `npm run test:functions`.

| Function | Auth | Purpose |
|---|---|---|
| `send-otp` | public | Email a sign-in code; rate-limited per email and IP (Upstash) |
| `media-sign` | user JWT | Cloudinary signature pinned to `vivah/<purpose>/<user id>` and the preset |
| `notify-fanout` | shared secret (`x-webhook-secret`) | Called by the database for each new notification (pg_net); sends Expo push and Resend email by preference; muted kinds send nothing, `emergency` always rings |
| `payment-initiate` | user JWT | `rpc_begin_payment` works out the amount from the milestone; returns the gateway URL or eSewa form |
| `payment-verify` | gateway redirect / user JWT | Asks the gateway itself, then `rpc_settle_payment` (service role) records the payment exactly once |
| `health` | public | `rpc_health`; for the Better Stack monitor |
| `account-delete` | user JWT | `rpc_delete_my_account`, remove private files, soft-delete the auth user |

`_shared/` modules: `env.ts` (secrets), `http.ts` (CORS, JSON, `safeEqual`), `supabase.ts` (`serviceRpc`, `userRpc`, storage), `ratelimit.ts` (`LIMITS`), `cloudinary.ts` (`PURPOSES`, `NAMED_TRANSFORMATIONS`), `fanout.ts` (`planFanout`), `payments.ts` (Khalti/eSewa request building, HMAC, outcome parsing, `safeReturnTo`).

**Writing a new function:** keep the handler thin; put logic in `_shared/` as pure functions; add Node tests in `scripts/test-functions.mjs`; document the request and response at the top of `index.ts` (it becomes the reference entry); never log secrets or personal data.

## 4. Payments: why it works this way

```
couple taps Pay → payment-initiate → rpc_begin_payment (amount from the milestone, as the couple)
   → gateway page → gateway redirects to payment-verify
   → payment-verify asks the gateway (Khalti /epayment/lookup, eSewa status API)
   → rpc_settle_payment (service role, locks the intent) → payment + receipt
   → 302 back to /pay/result, which checks the attempt again
```

- Money is recorded **only** after the gateway's own lookup (R-SEC-2). A forged redirect records nothing.
- `rpc_settle_payment` locks the `payment_intents` row, so duplicate callbacks, refreshes and "check again" record one payment.
- Money a milestone can no longer take becomes `REFUND_DUE` and finance is told.
- Return hosts are allow-listed (`PAYMENT_RETURN_HOSTS`, `safeReturnTo`).
- Tests: `scripts/db/payments.mjs` (in `npm run db:test`) and the payment checks in `npm run test:functions`. Sandbox setup: `docs/SETUP_SUPABASE.md` §6.

## 5. Notifications and jobs

- In the app: `notify(to, title, body, href?, kind?)` (store action). `to` is an account id or a role (`'platform'`). Capped at 300; the audit log at 500. Muted kinds arrive already read, except `emergency`.
- On Supabase: a new `notifications` row triggers `notify-fanout` (pg_net + Vault secret).
- Scheduled jobs (`0013_jobs.sql`, pg_cron): milestone status, payable readiness, lead SLA, payment reminders, clean-up.

## 6. Telemetry and privacy

- `src/backend/telemetry.ts` sends PostHog events and errors and Sentry envelopes without SDKs (so Expo Go still works). Payloads are built in `telemetryPayloads.ts` and tested by `npm run test:telemetry`.
- Only route **patterns** and the account id with persona fields leave the device: never names, emails, phones, ids in paths or RSVP codes (R-SEC-3).
- `prefs.analytics === false` stops analytics, not error reports.

## 7. Configuration

Environment variables are documented line by line in `.env.example`. Two kinds:

| Kind | Prefix | Where it lives | Example |
|---|---|---|---|
| Public (bundled into the app; anyone can read it) | `EXPO_PUBLIC_` | `.env.local`, EAS env, Vercel/Cloudflare env | `EXPO_PUBLIC_BACKEND`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_PAYMENT_MODE` |
| Secret (servers only) | none | Supabase function secrets, GitHub environment secrets, EAS secrets | `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `KHALTI_SECRET_KEY`, `ESEWA_SECRET_KEY`, `UPSTASH_*`, `NOTIFY_WEBHOOK_SECRET`, `R2_*`, `CLOUDFLARE_API_TOKEN` |

- The app reads public config only through `ENV` in `src/constants/env.ts`; each variable must be written literally as `process.env.EXPO_PUBLIC_NAME` because Expo inlines them at build time.
- `npm run env:vercel` writes `.env.vercel.local` for import into Vercel; `npm run env:functions` writes the function secrets file for `supabase secrets set --env-file`.
- `npm run setup:supabase` (on the `feature/live-backend-config` branch as of 2 Oct 2026) automates migrations, Vault, Auth/SMTP, function secrets and deploys through the Management API; the owner runs it with their own token.
- With `EXPO_PUBLIC_BACKEND=mock` the app needs no keys at all.

## 8. Moving the demo to Supabase without breaking it

1. Keep store actions as they are; they remain the demo backend.
2. For each use case, the RPC mirrors the action one to one (same name minus `rpc_`), checks permissions with `has_permission()`, writes the audit log and notifies.
3. Screens that need the live backend call `backend().method()` and handle the `Result`.
4. Money logic stays in `src/services` and in SQL helpers, proved equal by `npm run test:parity`.
5. The switch is one environment variable per build. The demo build (`mock`) must keep working (R-ARCH-6).
