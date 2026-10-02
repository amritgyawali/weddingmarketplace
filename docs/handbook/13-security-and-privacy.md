# 13. Security and privacy

How Vivah protects money, accounts and personal data, and what every change must respect.

Rules: R-SEC-1 … R-SEC-6, R-PER-4, R-DB-2 in [00-rules-and-regulations.md](00-rules-and-regulations.md). Background: [`docs/MASTER_PLAN.md`](../MASTER_PLAN.md) §11.

## 1. Threat model in one paragraph

The app is a public client: anyone can read its bundle and call the backend with their own token. So **the server decides** who may do what (RLS, `rpc_*` permission checks), **money is verified with the gateway** before it is recorded, **secrets never ship in the app**, and **personal data stays minimal** in logs and analytics. The on-device demo has no real security (everything is local); it mirrors the checks so the logic is ready for the server.

## 2. Secrets

- `.env.local` holds the owner's keys; git ignores it (`.gitignore`: `.env`, `.env*.local`, `.env.vercel`). Templates end in `.example` (R-SEC-1).
- `EXPO_PUBLIC_*` variables are **public**: they are compiled into the app. Only publishable keys go there (Supabase publishable/anon key, Cloudinary cloud name, PostHog key, Sentry DSN, Turnstile site key).
- Server secrets (Supabase secret key, gateway secrets, Resend, Upstash, R2, Cloudflare, webhook secret) live in Supabase function secrets, GitHub environment secrets or EAS secrets.
- Never print, log or commit a token (R-SEC-6). For GitHub API calls, read the token from `git credential fill` into a variable and never echo it.
- If a secret leaks: rotate it at the provider first, then remove it from history with the owner.

## 3. Access control

| Layer | Mechanism |
|---|---|
| App routing | `Stack.Protected` guard per role (`src/app/_layout.tsx`); `staffScreen()` for staff screens |
| Store actions | `staffOnly`, `staffDenied`, `actorCan` (`store/db/personas.ts`); validation inside the action |
| Database | RLS on every table (0002, 0009); `has_permission()`, `has_capability()`, `can_manage_project()`; column grants; `quote_items_public` and `service_bookings_customer` views hide provider cost and margin from couples |
| RPCs | `security definer`, `set search_path = public`, explicit permission checks, audit log |
| Staff sign-up | access code (stored hashed, `rpc_set_staff_access_code`) + admin approval (`rpc_decide_staff_request`) |
| Super admin | `admin.full` only; impersonation (`impersonate`/`endImpersonation`) shows a bar and is audited |

Hiding a button is never security (R-PER-4).

## 4. Payments

- The app never decides that money arrived. `payment-initiate` computes the amount from the milestone (as the couple); `payment-verify` asks the gateway's own lookup API, then `rpc_settle_payment` (service role) records exactly one payment (R-SEC-2).
- Return URLs are allow-listed (`safeReturnTo`, `PAYMENT_RETURN_HOSTS`).
- Cash and bank transfers are recorded by finance staff only (`payment.record_cash`), audited.
- Payouts can be frozen by an open dispute (`ON_HOLD`).

## 5. Files and media

- Public images: Cloudinary, uploaded with a signature from `media-sign` pinned to `vivah/<purpose>/<user id>` and the preset's size and type limits; displayed only through named transformations (R-SEC-5).
- Private documents (KYC, contracts, invoices): Supabase `documents` bucket, `<user id>/…`, five-minute signed links, bucket RLS.

## 6. Personal data

| Topic | Rule |
|---|---|
| Analytics and errors | Only route patterns and the account id with persona fields; never names, emails, phones, ids in paths or RSVP codes (R-SEC-3). Tested by `npm run test:telemetry`. Users can turn analytics off (`prefs.analytics === false`); error reports continue. |
| Consent | Login screen states that continuing accepts the terms and privacy policy; Supabase builds record the version (`rpc_accept_legal`). |
| Export | Settings → Download my data (`rpc_export_my_data`). |
| Deletion | Settings → Delete my account → `account-delete` → `rpc_delete_my_account`: refused while a confirmed celebration, open booking, refund or payout remains, or for the last super admin; profiles are anonymised (not hard-deleted, because bookings, payments and contracts reference them); private files removed; auth user soft-deleted. The demo deletes the on-device account. |
| Legal pages | `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/delete-account` from `src/data/legal.ts`. When behaviour they describe changes, update the text and bump `LEGAL_VERSION` (R-SEC-4). |
| Contacts import | Only the names and numbers the user selects are added (`expo-contacts` permission text in `app.json`). |
| Location | Used for nearby listings and crew GPS check-in only. |

## 7. Abuse protection

- `send-otp` is rate-limited per email and per IP (Upstash `LIMITS`), protecting inboxes and the free email quota.
- Cloudflare Turnstile is planned for public forms on the web (RSVP, enquiry, sign-up); keys are in `.env.example`.
- Web security headers ship in `public/_headers` (Cloudflare) and `vercel.json`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`.

## 8. Security review checklist for a pull request

- [ ] No secret, token or personal data in code, logs, fixtures or screenshots.
- [ ] New table: RLS on, policies per role, indexes; checks in `scripts/db`.
- [ ] New RPC: definer + search_path + permission check + validation + audit.
- [ ] New action: validates input and permission itself.
- [ ] Couples can't see cost/margin through the new surface.
- [ ] Telemetry: nothing identifying added to payloads.
- [ ] Legal text still true; `LEGAL_VERSION` bumped if it changed.
