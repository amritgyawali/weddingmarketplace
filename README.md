# Vivah — Wedding Platform (4 apps in one)

A React Native + Expo (SDK 57) app that runs the whole wedding business in one system. Each
user type signs in to its own app, with its own design, navigation and tools:

| User type | App | Look |
|---|---|---|
| **Couple** (customer) | Marketplace: venues, vendors, ideas, Genie, Wedika AI, **My Wedding** (quotes, payments, run sheet) | Pink · Manrope · classic tab bar |
| **Vendor** (venues & wedding businesses) | Vivah for Business: leads, **quotation builder**, projects, payments, hire freelancers | Teal · Plus Jakarta Sans · pill tab bar |
| **Freelancer** (photographers, MUAs, crew) | Gig marketplace: discover gigs, apply, **on-site check-in/out**, earnings & payouts | Dark · amber · Space Grotesk · floating bar |
| **Platform team** (Vivah ops / Genie planners) | Ops console: KPIs, **project management**, **wedding-day control room**, approvals, quotes, payouts | Navy · Inter · console rail |

## One connected workflow

```
Couple enquiry ──► Vendor lead ──► Quotation (line items, GST, discount)
      ▲                                   │
      └──── accept / request changes ◄────┘
                    │ accept
                    ▼
     Project (events, run sheet, tasks, payment milestones)
                    │
    Vendor / Platform post gigs ──► Freelancer applies ──► hired
                    │
     Wedding day: go live ─► run-sheet cues ─► crew check-in ─► incidents ─► payouts
                    │
     Platform sees everything: approvals, GMV, control room
```

Every step is an action in `src/store/useDb.ts` (the shared backend), so all four apps stay in sync.

## Run it

```bash
cd wedding-app
npm install
npx expo start          # scan the QR with Expo Go (SDK 57), or press a / i / w
```

### Log in

1. On the welcome screen tap **Get Started**, then pick a user type.
2. Enter any Indian mobile number. The OTP is **1234** (demo mode).
3. New numbers go through the setup for that role. Returning numbers log straight in.

You can also tap **Explore with a demo account** on the login screen. These accounts come with
data already filled in:

| Role | Demo account | Try |
|---|---|---|
| Couple | Ananya Sharma | My Wedding → review Petals & Kesar's quotation, pay a milestone |
| Vendor | Windflower Meadows Resort and Spa | Leads → Isha Kapoor → create a quotation → send |
| Freelancer | Riya Sharma | "You're working today" → check in → update the live run sheet |
| Platform | Kavya Menon (access code `VIVAH2026` for new team accounts) | Control room → live wedding WED-1038 |

To see a full cross-role flow, send an enquiry to *Windflower Meadows* as the couple. Then log in
as the vendor, quote it, and log back in as the couple to accept it. The platform sees each step.
**More → Reset demo data** in the platform app restores the seed data.

## Checks

```bash
npx tsc --noEmit        # type-check (typed routes are generated on `expo start`)
npx expo lint
npx expo-doctor
```

## Architecture

```
src/
  app/
    welcome/          user-type picker, OTP login, role-specific setup
    onboarding/       couple questionnaire (role → date → city)
    (tabs)/ …         couple marketplace (customer routes live at the root)
    business/         vendor app      (Stack.Protected guard: role === 'vendor')
    freelancer/       freelancer app  (guard: role === 'freelancer')
    platform/         ops console     (guard: role === 'platform')
    notifications.tsx shared by every role
  components/
    kit/              role-themed primitives (Card, KButton, KField, Segmented, KPI, charts, headers)
    work/             shared workflow UI: QuoteEditor, QuoteDocument, ProjectWorkspace, RunSheet, GigForm…
    navigation/       RoleTabBar (3 visual variants) + couple TabBar
    ui/               base UI (Text reads the role theme's font & colours)
  theme/              per-role palettes, fonts (lazy-loaded per role), RoleThemeProvider
  store/
    useSession.ts     accounts + session (mock OTP auth)
    useDb.ts          shared backend: leads, quotes, projects, gigs, payouts, approvals, notifications
    useAppStore.ts    couple's on-device data (shortlist, checklist, chats), bound to the signed-in couple
  data/               catalogue (venues, vendors, ideas) + seed.ts demo dataset
  services/           api.ts (catalogue queries), quotes.ts (quote maths), auth.ts, assistant.ts
```

**Routing and access.** The root layout switches between whole apps using
`Stack.Protected` guards on `session.role`. Signing in or out redirects automatically.

**Themes.** Each role app wraps itself in a `RoleThemeProvider`. Shared components such as
`QuoteEditor` and `ProjectWorkspace` therefore take on that role's look without any changes.
Only the active role's font is loaded.

**Permissions.** `ProjectWorkspace` has three modes:
- `platform` can do everything.
- `vendor` can edit its own tasks and the run sheet, and can run events on self-managed weddings.
- `customer` can pay milestones, complete its own tasks and follow the run sheet.

**Production notes.** Everything is mocked on the device:
- Auth uses an OTP gateway stub.
- Payments are simulated (see `genie-checkout` and `payMilestone`).
- The AI assistant is a local intent engine.

Each store action maps one-to-one to an API endpoint. Swap the bodies of `useDb` and `useSession`
for your backend (for example Supabase), and plug in Razorpay or Stripe for payments.
