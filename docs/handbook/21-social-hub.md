# 21. Social hub (Business → Social media)

A business connects its **Facebook page, Instagram profile, WhatsApp Business number and TikTok account**, answers every message and comment from one inbox, and publishes one post to all of them at once, now or at a set time. It is the business app's answer to tools like Postiz or Buffer, built for Nepali wedding businesses: Bikram Sambat dates, NPR prices in replies, romanised Nepali keywords, wedding-season hashtags and best times for Nepal.

## 1. Where it lives

| Piece | File |
|---|---|
| Screens | `src/app/business/social/index.tsx` (hub with six tabs), `social/thread/[id].tsx` (one conversation on phones), `social/compose.tsx` (new post or edit a draft, modal) |
| UI | `src/components/social/`: `Inbox.tsx` (list, conversation, sheets), `Posts.tsx` (post list, preview, calendar), `Panels.tsx` (accounts, insights, automation), `Composer.tsx`, `ConnectSheet.tsx`, `HomeCard.tsx`, `parts.tsx` (hooks and small pieces), `live.ts` (demo or server) |
| Rules (pure) | `src/services/social.ts` |
| Network catalogue | `src/data/social.ts` (limits, scopes, WhatsApp templates, starter replies) |
| Store actions | `src/store/db/social.ts` |
| Types | `src/types/social.ts` (re-exported by `types/platform.ts`) |
| Demo data | `src/data/socialSeed.ts` |
| Supabase client | `src/backend/social.ts` |
| SQL | `supabase/migrations/0017_social_lead_source.sql`, `0018_social_hub.sql`, `0020_social_live.sql` |
| Edge Functions | `supabase/functions/social-oauth`, `social-webhook`, `social-send`, `social-publish`, logic in `_shared/social.ts` |
| Nepali | `src/i18n/ne/social.ts` |
| Tests | `npm run test:social` (rules and seed), `scripts/db/social.mjs` in `npm run db:test` (SQL as each role), the social section of `npm run test:functions` |

Entry points: the **Social media** card on the business home, the Business tab row, and the wide sidebar link. A super admin can switch the whole feature off with the `vendor.social` feature flag.

## 2. The six tabs

1. **Inbox.** Messages (Messenger, Instagram DMs, WhatsApp) and comments (Facebook, Instagram, TikTok) in one list, filtered by network and by Open / Waiting / Starred / Done, with search over names, labels and message text. A conversation shows the messages, delivery ticks, internal notes, the network's reply window, up to three suggested replies for what the customer asked, saved replies, labels, assignment to a team member, snooze, and **Create lead**, which reads the date (BS or AD), guests, budget, phone and functions from the conversation and makes a CRM lead with source `social`. On wide screens the list and the conversation sit side by side.
2. **Posts.** Every post with its status on each network (queued, publishing, published with reach and engagement, failed with the network's reason and a Retry), plus Publish now, Edit, Duplicate and Delete.
3. **Calendar.** A Nepali month grid with scheduled, published and failed posts, the posts of the chosen day, and the next best times to post (Nepal audience times per network, plus the hour the business's own posts did best once it has three).
4. **Accounts.** Connect, reconnect (tokens expire), disconnect, followers, the permissions granted in plain words.
5. **Insights.** Audience, reach, engagement rate, conversations waiting, average first reply, leads from social (and how many were won), keyword replies sent, reach by network and the best post.
6. **Automation.** The away message (sent once per night to a new message outside the hours), a signature under message replies, keyword auto-replies (`price, rate, kati, कति` → the starting price) per network, and saved replies. `{price}`, `{city}`, `{business}` and `{name}` are filled in when sent.

The **composer** writes one caption with optional per-network versions, adds photos from the portfolio or the device, suggests hashtags (services, city, the coming wedding month such as `#Mangsir2083`), checks the post against every network's rules before anything is sent, previews it per network, and publishes now, schedules it or keeps it as a draft.

## 3. The networks' rules (enforced in the app and on the server)

| Rule | Where |
|---|---|
| Caption limits (Facebook 63,206, Instagram and TikTok 2,200, WhatsApp 1,024 with media), Instagram's 30 hashtags, media required on Instagram and TikTok, max files, TikTok photos or one video | `checkPost()` in `services/social.ts`, `NETWORKS` in `data/social.ts` |
| Reply window: any reply within 24 hours of the customer's last message; after that Messenger and Instagram allow a person's reply for 7 days with the `HUMAN_AGENT` tag; WhatsApp needs an approved template; comments can always be answered | `replyWindow()` (app) and `replyWindowState()` (`_shared/social.ts`), kept the same |
| WhatsApp has no API for Status, so a WhatsApp "post" is a broadcast of an approved marketing template to customers who opted in (`social_contacts`) | `publishTo()` |
| TikTok pulls the files from our URLs (domain must be verified) and reports by webhook; posts stay private (`SELF_ONLY`) until TikTok audits the app | `publishTo()`, `social-webhook` |

## 4. Demo and live

**Demo (mock backend, Expo Go).** The store actions stand in for the networks: connecting delivers a sample message a few seconds later, replies get delivery and read ticks, publishing takes about a second per network and reports reach worked out from the followers (`projectedMetrics`, deterministic), the hub's refresh button brings in the next sample message, and while the hub is open scheduled posts go out and snoozed threads come back (`runDueSocialPosts`, every 30 seconds). Timers are cleared by `resetDemo`. Seed: Everest Grand (Facebook, Instagram, WhatsApp; TikTok left to connect), Wedding Story Nepal (Instagram, Facebook, TikTok), Phoolbari Decor (Instagram; Facebook access expired).

**Live (`EXPO_PUBLIC_BACKEND=supabase`).** Every change goes through `socialAct()` (`components/social/live.ts`): the server call, its refusal shown as a toast, then `syncSocialFromServer()` reads `rpc_social_inbox` into the device mirror (`mirrorSocialData`). The hub re-reads every 30 seconds while open. Tokens never reach the device.

## 5. Server design (0018)

- `social_accounts` (one live connection per network per business; a network account belongs to one business), `social_account_secrets` (RLS on, **no policies**: only the service role reads tokens), `social_threads`, `social_messages` (unique network id, so webhook retries are stored once), `social_posts` → `social_post_targets` (one row per network, the post's status follows its targets), `social_settings`, `social_contacts`.
- Members (`can_use_social(org)` = organisation member) read and triage; owners and managers (`can_manage_social`) connect, disconnect and change the automation. Clients can only change triage columns of a thread, can only add notes (never a reply), and can only write drafts and schedules (never mark a post published).
- App RPCs: `rpc_social_inbox`, `rpc_social_save_post`, `rpc_social_schedule`, `rpc_social_triage`, `rpc_social_note`, `rpc_social_lead`, `rpc_social_disconnect`, `rpc_social_save_settings`. Service-only helpers: `vivah_social_*` (save account, ingest, send context, record reply, publish context, begin, target result, publish update, claim due, broadcast list, update token).
- Scheduled posts: `job_social_due()` (pg_cron, every five minutes) calls `social-publish` with the shared `notify_webhook_secret` from Vault; `vivah_social_claim_due` claims due posts with `skip locked`, wakes snoozed threads and marks expired tokens.
- Webhooks are only accepted when signed: Meta's `X-Hub-Signature-256` with the app secret, TikTok's `TikTok-Signature` (`t=…,s=…`, five-minute tolerance). The OAuth round trip carries an HMAC-signed state (user, network, return address, 15-minute expiry) and only returns to the app, Expo Go, the app's web host or localhost.

## 5a. Live extras (0020)

- **Assignment** is stored by name (`assignee_name`), because team members in the business app are names, not always sign-in profiles; `rpc_social_triage` takes `assignee`.
- **WhatsApp broadcast consent.** WhatsApp only allows marketing messages to people who agreed. A customer who writes START, SUBSCRIBE or सुरु joins the list; STOP, UNSUBSCRIBE or बन्द leaves it at once (trigger `social_messages_consent`, the same words as `optInKeyword()`). A member can record consent given another way from the conversation ("Add to updates", `rpc_social_optin`, audited). The WhatsApp account's audience is the opted-in count; `social-publish` broadcasts only to them.
- **Insights** are read back from the networks every six hours for posts published in the last 30 days (`job_social_metrics` → `social-publish { metrics: true }` → `fetchMetrics()`): Facebook post insights and reaction, comment and share counts; Instagram media insights; TikTok's video query after finding the public post from the publish id.
- **Media.** The networks fetch files from public URLs, so in Supabase builds files picked from the device are uploaded to Cloudinary first (they also land in the portfolio), and portfolio items carry their Cloudinary id. Publishing refuses files that exist only on the device.

## 6. Changing it safely

- Keep `replyWindow()` and `replyWindowState()` identical, and `optInKeyword()` and `social_optin_keyword()`; all have tests.
- A new network: add it to `SocialNetwork`, `NETWORKS`, the SQL `check` lists, `socialColors`, `_shared/social.ts` (consent, webhook parsing, reply and publish), and the tests.
- Never store or log a token on the device or in a non-secret table. Never let a client mark a post published or insert an outgoing message: those come from the Edge Functions after the network answers.
- New UI text needs its line in `src/i18n/ne/social.ts`.
- Setup for real accounts (Meta app, WhatsApp templates, TikTok app, secrets): [`docs/SETUP_SUPABASE.md` §6a](../SETUP_SUPABASE.md).
