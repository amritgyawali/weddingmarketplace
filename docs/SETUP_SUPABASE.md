# Putting Vivah on Supabase (staging)

This turns the app from the on-device demo into a real backend: email sign-in for every role, uploads to Cloudinary, private documents, push and email notifications, and scheduled jobs. Everything here is on free tiers (master plan §8).

Nothing in this guide has been run yet. The SQL is checked locally on every change (`npm run db:check`, `npm run db:test`), but applying it to a real project is the owner's call (AGENTS.md §1).

Time: about an hour.

## 1. Accounts to create (all free)

| Service | What for | Where the keys go in `.env.local` |
|---|---|---|
| [Supabase](https://supabase.com) | database, sign-in, files, Edge Functions | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN` |
| [Cloudinary](https://cloudinary.com) | photos and short video | `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| [Resend](https://resend.com) | email notifications | `RESEND_API_KEY`, `RESEND_FROM` |
| [Upstash](https://upstash.com) (Redis) | rate limits on codes and uploads | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| [Expo](https://expo.dev) | push notifications, builds | `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_ACCESS_TOKEN` |

Also set `NOTIFY_WEBHOOK_SECRET` to any long random string.

Name the Supabase project `vivah-staging`, region Mumbai (`ap-south-1`, closest to Nepal).

## 2. Database

```bash
npx supabase login
npx supabase link --project-ref <SUPABASE_PROJECT_REF>
npm run db:check                  # every migration applies locally first
npx supabase db push              # applies supabase/migrations to staging
```

Then, in the Supabase dashboard:

1. **Database → Extensions:** turn on `pg_cron` and `pg_net`. Then paste the `do $$ … $$` block at the end of `0013_jobs.sql` into the SQL editor and run it, so the five jobs get scheduled (the migration only schedules them when pg_cron is already on).
2. **Project settings → Vault:** add two secrets:
   - `functions_url`: `https://<ref>.supabase.co/functions/v1`
   - `notify_webhook_secret`: the same value as `NOTIFY_WEBHOOK_SECRET`
3. **Authentication → Hooks:** the custom access token hook points to `public.custom_access_token_hook` (it is in `supabase/config.toml`; check it is on).
4. **Authentication → Email templates → Magic link:** paste `supabase/templates/otp.html`. The template must contain `{{ .Token }}`, which is the 6-digit code.
5. **Authentication → SMTP:** use Resend's SMTP (`smtp.resend.com`, user `resend`, password = `RESEND_API_KEY`), so sign-in codes don't hit Supabase's built-in limit of a few emails an hour.

Set the first staff access code as a super admin in the SQL editor (it is stored hashed):

```sql
insert into staff_access_codes (code_hash) values (crypt('<A-LONG-CODE>', gen_salt('bf')));
```

Then make yourself the first super admin. Sign up in the app as staff with that code, then approve your own request in the SQL editor (after that, approvals happen in the app):

```sql
update staff_requests set status = 'APPROVED', staff_role = 'super_admin' where user_id = (select id from auth.users where email = '<your email>');
insert into user_roles (user_id, role) select id, 'SUPER_ADMIN' from auth.users where email = '<your email>';
```

## 3. Edge Functions

```bash
npm run test:functions                                   # 59 checks, locally
npm run env:functions                                    # writes supabase/.env.functions.local
npx supabase secrets set --env-file supabase/.env.functions.local
npx supabase functions deploy send-otp
npx supabase functions deploy media-sign
npx supabase functions deploy notify-fanout
npx supabase functions deploy payment-initiate
npx supabase functions deploy payment-verify            # no JWT check: the gateways call it (config.toml)
```

Also run the `do $$ … $$` block at the end of `0014_payments.sql` once pg_cron is on (it closes abandoned payment attempts hourly).

## 4. Cloudinary

```bash
node scripts/cloudinary-setup.mjs          # shows what it will create
node scripts/cloudinary-setup.mjs --apply  # creates the upload presets and named transformations
```

Then **Settings → Security → Strict transformations: on**.

## 5. The app

In `.env.local`:

```
EXPO_PUBLIC_BACKEND=supabase
```

Restart `npx expo start`. The login screen now asks for an email and a 6-digit code. For Vercel, run `npm run env:vercel` and import `.env.vercel.local`.

Push notifications need a development build (they don't work in Expo Go since SDK 53): `npx eas-cli@latest build --profile development`.

## 6. Payments: Khalti and eSewa sandboxes (P7)

- **eSewa** works with no keys: with `ESEWA_PRODUCT_CODE=EPAYTEST` the functions use eSewa's published test secret. Pay with eSewa ID `9711111111`, password `Nepal@123`, token `123456`.
- **Khalti:** sign up at test-admin.khalti.com, copy the `live_secret_key` of the test merchant into `KHALTI_SECRET_KEY`, run `npm run env:functions` and set the secrets again. Pay with Khalti ID `9800000000`, MPIN `1111`, OTP `987654`.
- eSewa only accepts a form POST, so phones open the web app's `/pay/esewa` page, which posts the signed form. Until the web app is deployed at `EXPO_PUBLIC_APP_URL`, test eSewa from the web build; add a preview host to `PAYMENT_RETURN_HOSTS` if you test from a Vercel preview.
- Going live: merchant accounts first (master plan §9), then `KHALTI_BASE_URL=https://khalti.com/api/v2`, your eSewa product code and secret with `ESEWA_BASE_URL=https://epay.esewa.com.np`, and `EXPO_PUBLIC_PAYMENT_MODE=live` (hides the test-account hint).

Check (master plan P7 "done when"): pay a milestone with each gateway, then in the SQL editor `select status, receipt_no from payment_intents i join payments p on p.id = i.payment_id order by i.created_at desc limit 5;`. Opening the gateway's return link again (a duplicate callback) must not add a second payment.

## 7. Check it works (master plan P6 "done when")

- Sign up once for each role: couple, business, freelancer, staff (with the access code, then approve in the console).
- Upload three photos from Business → Portfolio. They appear in Cloudinary under `vivah/portfolio/<user id>/` and in the app.
- Upload a KYC document in Verification. It is in Storage → documents → `<user id>/kyc/`, and only Vendor Success and admins can open it.
- Trigger a notification (for example, send a quotation). The couple gets a push on a development build and an email for quotes and payments, unless they muted that kind in Settings.

## Test without a project

`node scripts/db/local-api.mjs` runs a small stand-in for Supabase's sign-in and RPC endpoints on `http://localhost:54321`, backed by the real migrations on an in-process Postgres (email code `123456`, staff code `VIVAH-2027-OPS`). Start the app with `EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local` to try the email sign-in and sign-up flows end to end.
