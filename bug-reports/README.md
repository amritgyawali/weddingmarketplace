# Bug reports

Testers report bugs from inside the app, and each report lands in this folder.

## How a report is made

1. On the screen that went wrong, **shake the phone**. On a computer, press **Alt+Shift+B**. You can also go to **Settings → Help → Report a problem**.
2. The app takes a screenshot of the screen exactly as it was, then opens a sheet.
3. The tester writes what they tapped, what they expected and what happened instead, then taps **Send report**.

## Where reports go

The app sends the report to the bug inbox on the developer's computer (`scripts/bug-inbox.cjs`).

- **Development (Expo Go, dev builds and `expo start --web`):** nothing to set up. `metro.config.js` mounts the inbox on the dev server, so the report goes to the computer running `npx expo start`. The phone must be on the same Wi-Fi.
- **Test builds without a dev server:** run `npm run bugs:inbox` (port 8790) and build with `EXPO_PUBLIC_BUG_INBOX_URL=http://<computer-ip>:8790`. Android release builds block plain `http://`, so use an HTTPS tunnel to the inbox there.
- **Store builds:** the feature is hidden.

A super admin can switch it off for everyone (Super admin → Features → "Shake to report a bug"). Each device can turn shaking off in Settings.

## What is in a report

Every report gets its own folder, `<date>_<time>_<first-words>/`:

| File | Contents |
| --- | --- |
| `README.md` | The description; the screen path and its params; the signed-in account and role; device, runtime, app version, backend, language and calendar; the screenshot; the screens visited before it; the last console errors and warnings |
| `screenshot.png` | The screen as it was when the phone was shaken (or the picture the tester attached instead) |
| `report.json` | The same data as JSON, for scripts |

`INDEX.md` lists every report, newest last, as a checklist.

## Fixing a report (people and AI agents)

1. Open `INDEX.md` and pick an unticked line.
2. Read its `README.md` and look at `screenshot.png`.
3. Sign in as the same role (demo OTP `1234`) and open the same screen. Reproduce the bug, then fix it following `AGENTS.md`.
4. Tick the line in `INDEX.md`. You can delete the folder once the fix is merged.

Reports stay on this computer. Git ignores everything here except this file, because screenshots can contain personal data.
