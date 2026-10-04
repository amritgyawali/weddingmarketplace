# Bug report audit — 4 October 2026

All 19 local reports in `wt-run/bug-reports` were checked against the running worktree. Eight existing fixes remain implemented; eleven open reports received fixes in `fix/reported-bugs-audit`.

| Report time (Nepal time) | Issue | Result and evidence |
| --- | --- | --- |
| Oct 3, 14:05:21 | Vendor categories and text overlap | Already fixed. Current category cards have separate captions and service lists; phone browser screen opens without errors. |
| Oct 3, 14:14:21 | Next up goes to the wrong destination | Existing destination fix retained; task and payment links now highlight and reveal the relevant row without opening a sheet. Browser verified. |
| Oct 3, 14:16:37 | Task calendar should be a popup | Already fixed by `DatePopup`. Browser verified opening, choosing a date and saving a task. |
| Oct 3, 14:17:21 | Smart checklist only shows a message | Already fixed by Suggest tasks. Browser verified selecting and adding a task to the persisted project. |
| Oct 3, 14:19:01 | Task toast should name the new status | Already fixed. Browser verified destination-specific feedback after a status change. |
| Oct 3, 14:23:07 | Home checklist layout and five rows | Already fixed. Browser verified five rows and non-overlapping geometry after three successive ticks. |
| Oct 3, 14:24:29 | Planning guide is confusing | Existing explanation retained and updated for the remaining-days guide; browser verified. |
| Oct 3, 14:37:29 | Home design collapses | Existing removal of layout transitions retained. Repeated-tick browser check passes; the original iOS symptom still warrants a device check. |
| Oct 3, 16:50:28 | Guide should fit the time remaining | Fixed. Groups stay within the remaining days; earlier preparation moves into Do now. Existing task ids and completion state are retained. |
| Oct 4, 10:37:27 | Keyboard hides partner name | Fixed in code. Footer now participates in layout; focus revealing respects the keyboard and the scroll viewport. Native bundles compile. Physical iPhone keyboard verification remains pending. |
| Oct 4, 10:40:43 | More service choices and a separate step | Fixed. All occasion-appropriate services have a dedicated onboarding step. Browser verified. |
| Oct 4, 10:41:58 | Changing one answer repeats the questionnaire | Fixed. A review edit opens that step; Save changes returns directly to review. Browser verified with a budget change. |
| Oct 4, 10:45:33 | Add related events after the questions | Fixed. Event step shows the main event and related functions, with individual dates/cities and an optional party name. Browser verified Wedding + Reception + Haldi plan submission; pure tests cover every built-in occasion and custom occasions. |
| Oct 4, 10:47:22 | Next up opens editing | Fixed. Exact task is visible and highlighted without an editor; payments also require an explicit Pay tap. Browser verified both paths. |
| Oct 4, 10:50:33 | Re-entering enquiry details, automatic sending, vendor availability/capacity | Fixed for the existing mock backend. Saved details prefill; complete listing CTAs send enquiries automatically, with duplicate protection. Vendor Calendar publishes daily capacity. Public calendar uses the same reservations and closures. Browser verified enquiry delivery, capacity publication and a blocked customer date. |
| Oct 4, 10:54:58 | Guide newly created accounts | Existing tour was device-scoped. Fixed to remember each account separately, with migration and Profile replay. Browser verified a new account receives guidance after the previous account saw it. |
| Oct 4, 10:58:30 | Vendor prices should use customer requirements | Fixed. Package estimates use active requirement-linked functions, quantities and explicitly priced extras. Unpriced extras are confirmed in the vendor quotation. Browser and pure tests verified. |
| Oct 4, 11:00:45 | Wedding plan should open its section | Fixed. Home shortcut opens services at the plan section. Browser verified. |
| Oct 4, 11:21:23 | Ten days remaining needs a days guide | Fixed. A ten-day plan shows Do now and upcoming days, including unfinished earlier preparation. Browser and pure tests verified. |

Validation: TypeScript and lint; 32 customer-planning checks; 46 persona fixtures; 47 feature checks; complete SQL workflow suite; 1,272 money parity cases; generated documentation check; affected customer and vendor browser journeys at 393px and 1280px. Metro returned successful full iOS and Android bundles.

Expo Doctor remains at the documented baseline of 20/21: existing patch mismatches for Expo, expo-constants, expo-document-picker and expo-router. No dependency changes were introduced.

The report index and individual notes are updated locally. Reports and screenshots remain excluded from Git under the repository's existing privacy rule. Screenshot artifacts from isolated browser tests are under `.expo/audit-*.png`. No physical iPhone was available; native keyboard visibility and the original iOS animation symptom are not claimed as device-tested. The Supabase schema was not deployed.
