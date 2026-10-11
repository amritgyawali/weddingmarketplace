# 22. Appearance, profile and support

Three things every role shares: **light and dark mode**, **Edit profile**, and **Help and support** (with the staff **Help desk**). Added on 11 October 2026.

## 1. Light and dark mode

### What people see

- **Settings → Appearance** (every role) shows three tiles with a small preview each: **Light**, **Dark** and **Auto** (same as the phone). `components/ui/AppearancePicker.tsx`.
- A compact sun / moon / phone switch sits on the couple's Profile menu, the business tab, the freelancer profile and the staff console's More tab (`AppearanceSwitch`).
- The choice is kept per device in `usePrefs().appearance` (`src/i18n/index.tsx`, persisted as `vivah-prefs`; missing on older installs means `system`).

### How it works

| Piece | Where | Job |
|---|---|---|
| `LIGHT`, `DARK` palettes | `src/constants/theme.ts` | Same keys. Dark is "Wine night": warm espresso blacks for surfaces, a dusty rose `primary` that reads both as text and as a fill (with dark text on it), champagne gold unchanged. |
| `colors` | same | The live palette. `applyColorScheme(scheme)` copies the chosen palette into it **in place** and tells listeners (`onColorScheme`). |
| `themed(factory)` | same | Wraps a module-level `StyleSheet.create({...})`. The sheet is rebuilt the first time it is read after a scheme change. |
| `ROLE_THEMES`, `ROLE_MARK`, `gradients` | `src/theme/roles.ts`, `theme.ts` | Rebuilt in place on every scheme change; `RoleTheme.dark` is true in dark mode. |
| `useResolvedScheme()` | `src/hooks/useColorMode.ts` | The person's choice, or the phone's (`useColorScheme`) for Auto. |
| Root layout | `src/app/_layout.tsx` | Calls `applyColorScheme` before anything renders, wraps the tree in `<Fragment key={scheme}>` so every screen remounts with the new colours (navigation state is kept by the container), and sets the status bar (`statusBarStyle()`), the system background (`expo-system-ui`) and, on web, `color-scheme`. |

`app.json` has `userInterfaceStyle: "automatic"` so the phone's setting reaches the app.

### Rules for new screens (R-UI-9)

1. Read colours **during render** (`colors.x`, `t.c.x`) or inside `themed(() => StyleSheet.create({...}))`. Never copy a token into a module-level constant (`const ICON = colors.textBody` stays light forever). Use a function (`const tones = () => ({...})`) or `themed(() => ({...}))` for lookup tables.
2. `colors.white` is the **card surface**: it turns dark in dark mode. Text on a `primary`, `success` or `danger` fill can stay `colors.white` (those fills turn light in dark mode, so the pair inverts together).
3. Text and icons on things that stay dark in both modes (photos and their scrims, wine bands, `inkFill` pills, brand-coloured payment tiles) use **`colors.onDark`**.
4. A fill that must stay dark in both modes (a floating pill, a photo placeholder) uses **`colors.inkFill`**, never `colors.heading` (headings turn light).
5. Look at the screen in both modes before you finish: sign in, Settings → Appearance → Dark.

## 2. Edit profile

One screen for every role, `components/work/EditProfileScreen.tsx`, at `/edit-profile` (couple), `/business/edit-profile`, `/freelancer/edit-profile` and `/platform/edit-profile`.

| Everyone | Couple | Business | Freelancer | Staff |
|---|---|---|---|---|
| Photo (add, change, remove), full name, email (demo only), city | Partner's name, "I am the", main date | Business name, about the business | Headline, about you, years of experience, languages | Role and team (read only) |

- Saving calls `useSession().updateMyProfile(patch)`, which cleans the patch with `cleanProfile()` (`services/profile.ts`: name 2–60 characters, valid email, a Nepal city, a safe photo address, role fields only for their role) and returns an error string or null. The couple's per-device profile in `useAppStore` is kept in step.
- **Mobile number** (and, on Supabase builds, the sign-in email) can't be edited: they are how people sign in. "Change" opens a help request under My account.
- Photos: `keepProfilePhoto()` (`backend/contentMedia.ts`) uploads to Cloudinary as the account's avatar on Supabase builds (`rpc_register_media`), and keeps the file on the device in the demo (on the web, inline up to 300 KB). `Avatar` (kit) shows `account.photo` when there is one.
- Supabase builds also call `rpc_update_my_profile` (0022), which applies the same rules on the server.

## 3. Help and support

### For couples, businesses and freelancers

`/support`, `/business/support`, `/freelancer/support` (`components/support/SupportCenter.tsx`):

- a wine "Namaste" band with a search box over the answers;
- call, WhatsApp and email tiles (`BRAND.supportPhone`, `supportWhatsApp`, `supportEmail`), plus Quick help for couples;
- **Your requests**: open ones first, solved ones on request; a burgundy rail marks the ones waiting for the person's reply;
- **Common questions** for the role (`faqFor(role)` in `data/support.ts`), filtered by topic chips and the search box. Keep the answers true to how the app works; when behaviour changes, change the answer;
- report a bug, refunds, privacy and terms.

**Ask the team** (`.../support/new`, `NewSupportRequest.tsx`): topic, which celebration (couples), subject, details, and how soon (Normal, Soon, Urgent). The draft is kept on the device. A request (`SupportThread.tsx`) shows the conversation, a reply box, **My problem is solved**, **I still need help**, and a 1–5 rating once it is solved.

Entry points: couple Profile → Help → Help and support (with a badge when the team asked something), Business tab, freelancer Profile, and Edit profile → Mobile number → Change.

### For staff: the Help desk

`/platform/support` (`HelpDesk.tsx`), for staff with **`support.manage`** (coordinators, support, admins, super admins; not finance). Tiles for new, urgent, yours and the average rating; filters New, Mine, Waiting, All open, Solved; search. A request (`/platform/support/[id]`) adds the customer's contact details, **Assign to me**, priority, status, internal notes (dashed border, never shown to the customer) and a link to the project. On wide screens the conversation and the panel sit side by side.

### Data and rules

- `DbData.supportTickets: SupportTicket[]` (`types/platform.ts`), seeded by `data/supportSeed.ts` (four requests, one per demo story), added to older installs by the DB `migrate` v9.
- Actions in `store/db/support.ts`: `openSupportTicket`, `replySupportTicket`, `setSupportTicketStatus`, `assignSupportTicket`, `rateSupportTicket` (and `mirrorSupportTickets` for Supabase builds). They check who is asking themselves: owners only touch their own requests and may only mark them solved, closed or open again; staff need `support.manage`; five open requests per person at most. Each one notifies the other side and writes the audit log.
- Status words: the person reads "Waiting for Vivah / Being looked at / Waiting for your reply / Solved / Closed"; staff read "New / In progress / Waiting on customer / Resolved / Closed" (`SUPPORT_STATUS_LABEL`, `SUPPORT_DESK_STATUS_LABEL`).
- Supabase builds go through `backend/support.ts` (`openTicket`, `replyTicket`, `setTicketStatus`, `assignTicket`, `rateTicket`, `syncSupportTickets`), which call the RPCs in `supabase/migrations/0022_profile_support.sql` and mirror `rpc_my_support_tickets` into the store. The tables keep RLS on: owners read their own requests and only the public messages; `support.manage` reads all; nobody writes them directly. `npm run db:test` runs `scripts/db/support.mjs` (51 checks).

New UI text for all three areas lives in `src/i18n/ne/support.ts`.
