# 03. Frontend

Everything the user sees: routing, screens, components, hooks and the rules that keep four apps in one binary working on phones and on a desktop browser.

Rules: R-FE-1 … R-FE-9 and R-UI-* in [00-rules-and-regulations.md](00-rules-and-regulations.md). Every route is listed in [the route reference](../reference/routes.md).

## 1. Routing (Expo Router)

Every file in `src/app/` is a route. `_layout.tsx` files define navigators. Folders in parentheses, such as `(tabs)`, group routes without adding to the URL. `[id].tsx` is a dynamic segment read with `useLocalSearchParams()`. Typed routes are on (`app.json` → `experiments.typedRoutes`), so `router.push('/business/lead/123')` is type-checked; the types are generated into `.expo/types/router.d.ts` by `npx expo start`.

### 1.1 The root layout and the role guards

`src/app/_layout.tsx` is the entry point. In order, it:

1. keeps the splash screen up and loads the fonts (`APP_FONTS`);
2. waits until all four persisted stores have rehydrated (`useHydrated` on `useAppStore`, `useSession`, `useDb`, `usePrefs`), because routing depends on them;
3. installs action toasts (`installActionToasts()`) and the error boundary (`AppErrorBoundary`);
4. on Supabase builds, signs out a device whose tokens can no longer be refreshed;
5. renders one `Stack` with a **`Stack.Protected` guard per role**:

| Guard | Screens |
|---|---|
| `!role` (signed out) | `welcome` (carousel → role → login → setup) |
| couple, not onboarded | `onboarding` |
| couple, onboarded | `(tabs)` and every couple screen at the root (`plan`, `guests`, `budget`, `quote/[id]` …) |
| `role === 'vendor'` | `business` |
| `role === 'freelancer'` | `freelancer` |
| `role === 'platform'` | `platform` |
| any signed-in role | `notifications` |
| signed out or couple | `select-city`, `join-wedding` |
| no guard (public) | `w/[slug]`, `rsvp/[code]`, `legal/[doc]`, `pay/result`, `pay/esewa`, `+not-found` |

A screen that is not inside the right guard is reachable by every role. **Always register new screens inside the correct guard** (R-FE-1).

### 1.2 Role app layouts

`business/_layout.tsx`, `freelancer/_layout.tsx` and `platform/_layout.tsx` each:

- wrap their stack in `RoleThemeProvider role="…"` (colours via `useRoleTheme()`);
- set `screenLayout={keyboardScreenLayout}` (keyboard handling, see §5);
- list every screen of the app with `Stack.Screen`.

Each role app has a `(tabs)/_layout.tsx` using `RoleTabBar` (`components/navigation/RoleTabBar.tsx`). On phones it is a bottom tab bar; at ≥ 960 px it becomes a **sidebar** with the tabs plus extra `SidebarLink`s. Tabs and links are filtered by persona rules (for example `PLATFORM_ROUTE_RULES` for staff, `VENDOR_LINK_RULES` for vendors). The couple app uses `TabBar` (`components/navigation/TabBar.tsx`). Its tabs are Home, Venues, Vendors, Ideas and **My Wedding** (`(tabs)/wedding.tsx`, labelled "My plan" for non-wedding occasions). My Wedding renders `MyWeddingScreen` (`components/wedding/MyWeddingScreen.tsx`) with `inTab`; `/my-wedding` renders the same screen as a stack page for deep links and notifications, and `useOpenMyWedding()` picks the tab unless a super admin has switched it off. The planner packages screen (`(tabs)/genie.tsx`) is still a tab route but is not shown in the bar; the home banner and the profile menu link to it. A first-run tour (`components/tour/AppTour.tsx`, steps in `data/tour.ts`) points at search, each tab, messages and the menu with a small card; elements opt in by wrapping themselves in `<TourTarget id=…>`, and a step whose target isn't on screen is skipped. It shows once per account on the device (`store/useTour.ts`, AsyncStorage key `vivah-tour`), can be replayed from Profile → How Vivah works, and a super admin can switch it off (`couple.tour`).

### 1.3 Adding a screen, step by step

1. Create the file in the right folder (`src/app/business/payouts.tsx` → URL `/business/payouts`). Only the default-exported component goes in the file; helpers go in `src/components` or `src/services`.
2. Add a one-line JSDoc above the default export saying what the screen is for. It appears in [the route reference](../reference/routes.md).
3. Register it: `<Stack.Screen name="payouts" />` in `business/_layout.tsx` (for couple or public screens, in the root layout, **inside the right guard**).
4. If only some personas should see it, add a rule (`PLATFORM_ROUTE_RULES`, `VENDOR_LINK_RULES`…) and, for staff screens, wrap the component: `export default staffScreen('/platform/payouts', PayoutsScreen)`; it shows `NoAccess` to others.
5. Use the role kit (`StackHeader`, `Card`, `KButton`, `KField`…) and `useRoleTheme()`.
6. Handle a missing entity with `EmptyBlock` / `EmptyState`, not `return null` (R-FE-3).
7. Check it at phone width and at desktop width (`useLayout().wide`).
8. Add any new English text to the Nepali dictionary (`src/i18n/ne/index.ts`).
9. Run `npx tsc --noEmit` (start `npx expo start` once if the new route isn't typed yet; see [19-troubleshooting.md](19-troubleshooting.md)).

## 2. Which component library to use

| Folder | Use for | Examples |
|---|---|---|
| `components/ui/` | Base primitives used everywhere, especially in the couple app | `Text` (translation, `serif`, `raw`), `PressableScale`, `Button`, `Field`, `SearchBar`, `Sheet`, `Dialog`/`DialogHost`, `Toast`/`toast()`, `EmptyState`, `Loader`/`LoadingState`, `Calendar`, `Keyboard`, `Toggle`, `Chip`, `Rating`, `ScreenHeader` |
| `components/kit/` | Role apps (business, freelancer, platform): themed by role | `Card`, `KButton`, `StatusPill`, `Avatar`, `ProgressBar`, `SectionTitle`, `EmptyBlock`, `KeyValue`, `KField`, `Segmented`, `ChoiceChips`, `ListRow`, `Fab`, `KpiCard`, `BarChart`, `RoleHeader`, `StackHeader`, `QuickAction` |
| `components/work/` | Workflow panels shared by several roles | `MatchPanel`, `QuoteEditor`, `QuoteDocument`, `Bookings` (`CrewPanel`, `DeliverablesPanel`), `Payments`, `TaskBoard`, `Timeline`, `ThreadView`, `AvailabilityCalendar`, `RunSheet`, `ContractView`, `SignaturePad`, `GigForm`, `ApplicantsList`, `VerificationScreen`, `SegmentFilter`, `TodayFocus`, `SettingsScreen` |
| `components/toolkit/` | The role toolkits | `EntryList`, `ToolPage`, `ToolHub`, `ToolRoute` ([10-toolkits.md](10-toolkits.md)) |
| `components/persona/` | Persona-aware rendering and pickers | `Gate`, `staffScreen`/`NoAccess`, `TradeTiles`, `ServicePicker`, `CraftTiles`, `SkillPicker`, `SetupChecklist` |
| `components/admin/` | Super admin console building blocks | record editor, collection metadata |
| others | Couple marketplace sections | `home/`, `listing/`, `detail/`, `planner/`, `wedding/`, `onboarding/`, `ideas/`, `genie/` |

Before writing a new component, search [the code reference](../reference/README.md) for one that already does the job. A shared panel used by two roles belongs in `components/work`, and takes a `mode` prop when roles must see different things (for example, couples never see provider cost: R-BIZ-9).

## 3. Reading and writing data

| Need | Use |
|---|---|
| Shared data (projects, quotes, gigs…) | `useDb((s) => s.projects)`; select the raw collection and filter in render (R-FE-4) |
| The current user | `useAccount()` / `useCurrentAccount()` from `store/useSession` |
| Role-scoped slices | `useVendorWorkspace(account)`, `useFreelancerWorkspace(account)`, `useCustomerWorkspace(accountId)` (`hooks/useWorkspace.ts`) |
| Notifications and threads | `useInbox(account)`, `useThreads(account)`, `useUnreadMessageCount(account)` (`store/db/index.ts`) |
| Persona (what this user may see) | `useExperience()`; helpers `has`, `can`, `allows` from `services/experience.ts` |
| Feature switches | `useFeatures()` |
| Catalogue (venues, vendors, ideas) | React Query hooks in `hooks/queries.ts` (`useVenues`, `useVendor`…), backed by `services/api.ts` |
| Layout | `useLayout()` → `{ wide, medium, columns, contentWidth }` |
| Change anything | call a store action: `const addGuest = useDb((s) => s.addGuest); addGuest(...)` |

Actions that can fail return an error string or `null`. Screens don't need to toast success: `installActionToasts()` does it ("Guest added"). When an action returns an error, it is shown in red automatically; a screen can still show its own message for context.

## 4. Feedback, dialogs and errors

- **Toasts:** automatic after actions; manual with `toast()`, `toastError()`, `toastInfo()` from `components/ui/Toast`.
- **Confirmations:** `confirm(title, message, confirmLabel, onConfirm)` from `utils/confirm` (renders the app `Dialog`). Never `Alert.alert` (R-FE-8).
- **Loading:** `Loader` (inline) or `LoadingState` (full area); skeletons in `components/ui/Skeleton.tsx` for lists.
- **Empty and error states:** `EmptyState`/`ErrorState` (`components/ui`), `EmptyBlock` (`components/kit`).
- **Crashes:** the root `ErrorBoundary` is `AppErrorBoundary`; it reports to PostHog/Sentry and offers a retry.

## 5. Keyboard, taps and platform details

- Every navigator passes `screenLayout={keyboardScreenLayout}`, which wraps each screen in `KeyboardLift`. Use `KeyboardAwareScrollView as ScrollView` from `components/ui/Keyboard` in forms. Don't add `KeyboardAvoidingView` (R-FE-7). `Sheet` lifts itself.
- `PressableScale` is a plain `Pressable` with a 350 ms double-tap guard and optional haptics (`triggerHaptic`). An animated press style made Android drop taps, so don't reintroduce one.
- Web: no nested pressables (R-FE-6). Text inputs use `inputReset` to drop the browser focus ring. `public/` holds files copied as-is into the web build (`_headers`, `robots.txt`, `sitemap.xml`). Unknown URLs render `src/app/+not-found.tsx`.
- Images: `expo-image`. Remote images on live builds come from Cloudinary through `cloudinaryUrl(publicId, 't_card')` (see [06-backend.md](06-backend.md)).
- Icons: `Ionicons` from `@expo/vector-icons`; the `IconName` type is exported by `components/kit/primitives`.
- Links and sharing: `utils/links.ts` (`webUrl`, `appUrl`, `sitePath`, `rsvpPath`, `shareMessage`, `openWhatsApp`, `openSms`).

## 6. Wide layout (the web console)

`useLayout()` returns `wide` at ≥ 960 px, `medium` at ≥ 640 px, `columns` (1, 2 or 3) and a readable `contentWidth`. Role tab bars become sidebars when `wide`. Lists should become grids (use `columns`), and detail screens should cap their width at `contentWidth`. Test every role-app screen at both widths (R-FE-2), for example with `npx expo start --web` and the browser's device toolbar.

## 7. Performance

- React Compiler memoises components; don't add `useMemo`/`useCallback` unless a profiler shows a need (R-FE-5).
- Selectors return stable references (R-FE-4). Derive lists in render.
- Persisted stores write lazily (`store/lazyStorage.ts`): saving the whole demo database on every tap used to drop taps.
- Tool screens load only when opened (`/…/tool/[id]`).
- Use `FlatList` for long lists; keep row components small.

## 8. Checklist for a frontend pull request

- [ ] Screen registered in the right layout and guard; persona rule added if needed.
- [ ] Works at 430 px and ≥ 960 px; empty state for missing ids.
- [ ] Uses kit/ui components and tokens; no hex colours; sentence case; no emoji in chrome.
- [ ] Writes only through store actions; no business rules in JSX; no arithmetic on money in JSX.
- [ ] New text has Nepali lines; names and codes use `<Text raw>`.
- [ ] JSDoc on the default export and any new exported component.
- [ ] `npx tsc --noEmit` and `npx expo lint` clean; `npm run check:personas` if visibility changed.

## Customer report fixes (4 October 2026)

Onboarding separates services and related functions from the review. Each additional function accepts its own date and city; an optional display name lets families name a party. Changing a review row edits that step and returns directly through Save changes. The sticky footer participates in layout so the scroll viewport excludes its height, including while the keyboard is open.

Home ? Wedding plan opens `/my-wedding?tab=services&section=plan` at the plan section. Next up uses its tab and focus id to highlight and scroll to a task or payment; editing and paying remain explicit taps. Existing payment-sheet callers can still use `openMilestoneId`.

Listing detail screens show the vendor calendar. Enquiries prefill saved account and project information; listing CTAs request automatic delivery if required details are complete. Missing details remain editable. The first-run tour records accounts separately in the existing `vivah-tour` store, preserving legacy seen tours and Profile replay.
