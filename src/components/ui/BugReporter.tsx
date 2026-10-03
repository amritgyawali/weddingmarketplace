/**
 * Report a bug from any screen. Any of these takes a screenshot of the screen
 * exactly as it is and opens the report screen (`/report-bug`) to describe
 * the problem:
 *
 *   - taking a phone screenshot (side + volume up on iPhone, power + volume
 *     down on Android; `expo-screen-capture`);
 *   - holding three fingers on the screen for half a second;
 *   - the floating bug button (on by default in development and test builds);
 *   - shaking the phone, in installed builds (in Expo Go and development
 *     builds shaking opens the developer menu instead, so it is off there);
 *   - Alt+Shift+B on a computer, or Settings → Help → Report a problem.
 *
 * It works on every screen of every role app, signed in or not, in every
 * build. The report is saved in the app's backend for the super admins (Super
 * admin → Bug reports) and, in development and test builds, also lands in the
 * developer's `bug-reports/` folder (see `backend/bugReport.ts` and
 * `scripts/bug-inbox.cjs`).
 *
 * The report is a screen of its own, not a Modal: a screen opens on top of
 * modal screens and sheets, where a second Modal can't be shown on iOS.
 *
 * A super admin can switch it off (`app.bug_report`); each device picks its
 * triggers in Settings → Help.
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { addScreenshotListener } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { Dimensions, type GestureResponderEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureScreen } from 'react-native-view-shot';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { bugReportsAvailable, captureConsole, devInboxOffered, recordRoute, reportContext, sendBugReport, setDeviceBugInbox } from '@/backend/bugReport';
import { BRAND } from '@/constants/brand';
import { ENV } from '@/constants/env';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useFeatures } from '@/hooks/useFeatures';
import { useShake } from '@/hooks/useShake';
import { usePrefs } from '@/i18n';
import { useSession } from '@/store/useSession';

import { Button } from './Button';
import { Field } from './Field';
import { KeyboardAwareScrollView as ScrollView } from './Keyboard';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';
import { toast } from './Toast';

/** The report screen's route; never recorded as "the screen that went wrong". */
export const REPORT_ROUTE = '/report-bug';

interface Draft {
  screenshot?: string;
  /** Width / height of the screenshot, for the preview. */
  aspect: number;
  route: string;
  params: Record<string, string>;
  capturedAt: string;
}

interface BugReporterState {
  /** Per device: shaking opens the reporter (installed builds only). */
  shake: boolean;
  /** Per device: taking a phone screenshot opens the reporter. */
  screenshots: boolean;
  /** Per device: holding three fingers on the screen opens the reporter. */
  threeFingers: boolean;
  /** Per device: the floating bug button. Unset = on in development and test builds, off in store builds. */
  button?: boolean;
  /** Where the floating button was dragged to (distance from the right and bottom edges). */
  buttonAt?: { right: number; bottom: number };
  /** Per device: the bug inbox address typed in Settings (empty = the build's own). */
  inbox: string;
  draft: Draft | null;
  /** True while the screenshot is taken, so the floating button stays out of it. */
  capturing: boolean;
  setShake: (shake: boolean) => void;
  setScreenshots: (on: boolean) => void;
  setThreeFingers: (on: boolean) => void;
  setButton: (on: boolean) => void;
  moveButton: (at: { right: number; bottom: number }) => void;
  setInbox: (inbox: string) => void;
  open: (draft: Draft) => void;
  close: () => void;
}

/** The reporter's state: the open draft, and the device's triggers and inbox address (persisted). */
export const useBugReporter = create<BugReporterState>()(
  persist(
    (set) => ({
      shake: true,
      screenshots: true,
      threeFingers: true,
      inbox: '',
      draft: null,
      capturing: false,
      setShake: (shake) => set({ shake }),
      setScreenshots: (screenshots) => set({ screenshots }),
      setThreeFingers: (threeFingers) => set({ threeFingers }),
      setButton: (button) => set({ button }),
      moveButton: (buttonAt) => set({ buttonAt }),
      setInbox: (inbox) => set({ inbox: inbox.trim() }),
      open: (draft) => set({ draft }),
      close: () => set({ draft: null }),
    }),
    {
      name: 'vivah-bug-reporter',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ shake: s.shake, screenshots: s.screenshots, threeFingers: s.threeFingers, button: s.button, buttonAt: s.buttonAt, inbox: s.inbox }),
    },
  ),
);

// The backend reads the device's inbox address (restored from storage, or edited in Settings).
useBugReporter.subscribe((s) => setDeviceBugInbox(s.inbox));

/** Shaking is the developer menu's gesture in Expo Go and development builds, so the reporter only listens to it in installed builds. */
export const shakeToReportWorks = () => Platform.OS !== 'web' && !__DEV__;
/** Phone screenshots can be noticed on iOS and Android, not in a browser. */
export const screenshotToReportWorks = () => Platform.OS !== 'web';
/** Is the floating bug button showing on this device? */
export const bugButtonOn = (button: boolean | undefined) => button ?? devInboxOffered();

let current: { path: string; params: Record<string, string> } = { path: '/', params: {} };
/** Whether the super admin switch is on; kept for the touch handlers, which live outside React. */
let reporterOn = true;
let capturing = false;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Starts keeping console errors for reports. Root layout calls it once. */
export function installBugReporter() {
  if (bugReportsAvailable()) captureConsole();
}

/** Screenshots the screen as it is now and opens the report screen. `screenshot: false` opens it without one. */
export async function reportBug({ screenshot = true }: { screenshot?: boolean } = {}) {
  if (capturing || current.path === REPORT_ROUTE || !bugReportsAvailable()) return;
  capturing = true;
  try {
    const { width, height } = Dimensions.get('window');
    let shot: string | undefined;
    if (screenshot) {
      // Hide the floating button first, so it isn't in the picture.
      useBugReporter.setState({ capturing: true });
      await nextFrame();
      await nextFrame();
      try {
        // JPEG keeps the report small enough to send over a phone connection.
        const base64 = await captureScreen({ format: 'jpg', quality: 0.7, result: 'base64' });
        shot = `data:image/jpeg;base64,${base64}`;
      } catch {
        // The screen still opens; a picture can be attached by hand.
      } finally {
        useBugReporter.setState({ capturing: false });
      }
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useBugReporter.getState().open({ screenshot: shot, aspect: width / height, route: current.path, params: current.params, capturedAt: new Date().toISOString() });
    router.push(REPORT_ROUTE);
  } finally {
    capturing = false;
  }
}

const reportNow = () => void reportBug();

// Three fingers held still for half a second -------------------------------------

const HOLD_MS = 500;
const MAX_MOVE = 24;
let hold: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
const cancelHold = () => {
  if (hold) clearTimeout(hold.timer);
  hold = null;
};
const fingers = (e: GestureResponderEvent) => e.nativeEvent.touches?.length ?? 0;
const centre = (e: GestureResponderEvent) => {
  // An array on phones, a TouchList in browsers.
  const t = Array.from(e.nativeEvent.touches as ArrayLike<{ pageX: number; pageY: number }>);
  return { x: t.reduce((s, p) => s + p.pageX, 0) / t.length, y: t.reduce((s, p) => s + p.pageY, 0) / t.length };
};

/**
 * Touch handlers for the app's root view: holding three fingers on any screen
 * reports a bug. They only watch touches (they never take them), so taps,
 * scrolling and gestures underneath work as usual.
 */
export const bugTouchHandlers = {
  onTouchStart: (e: GestureResponderEvent) => {
    const s = useBugReporter.getState();
    if (fingers(e) < 3 || !s.threeFingers || hold || !reporterOn) return;
    const { x, y } = centre(e);
    hold = { x, y, timer: setTimeout(() => {
      hold = null;
      reportNow();
    }, HOLD_MS) };
  },
  onTouchMove: (e: GestureResponderEvent) => {
    if (!hold) return;
    if (fingers(e) < 3) return cancelHold();
    const { x, y } = centre(e);
    if (Math.abs(x - hold.x) > MAX_MOVE || Math.abs(y - hold.y) > MAX_MOVE) cancelHold();
  },
  onTouchEnd: cancelHold,
  onTouchCancel: cancelHold,
};

const asParams = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(',') : v]])));

/** Follows the current screen, listens for the triggers and shows the floating button. Root layout only. */
export function BugReporterHost() {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const on = useFeatures()('app.bug_report');
  const shake = useBugReporter((s) => s.shake);
  const screenshots = useBugReporter((s) => s.screenshots);
  const button = useBugReporter((s) => s.button);
  const available = bugReportsAvailable() && on;
  const onReport = path === REPORT_ROUTE;

  useEffect(() => {
    reporterOn = available;
  }, [available]);

  useEffect(() => {
    if (path === REPORT_ROUTE) return;
    current = { path, params: asParams(params) };
    recordRoute(path);
  }, [path, params]);

  useShake(reportNow, available && shake && shakeToReportWorks() && !onReport);

  // A phone screenshot (side + volume button) means "look at this": offer to report it.
  useEffect(() => {
    if (!available || !screenshots || !screenshotToReportWorks()) return;
    try {
      const subscription = addScreenshotListener(reportNow);
      return () => subscription.remove();
    } catch {
      return undefined;
    }
  }, [available, screenshots]);

  // Desktop browsers can't shake: Alt+Shift+B does the same.
  useEffect(() => {
    if (Platform.OS !== 'web' || !available || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        reportNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available]);

  if (!available || onReport || !bugButtonOn(button)) return null;
  return <BugButton />;
}

// The floating bug button -------------------------------------------------------

const BUTTON = 40;

/** A small round button that reports a bug when tapped; drag it anywhere out of the way. */
function BugButton() {
  const insets = useSafeAreaInsets();
  const hidden = useBugReporter((s) => s.capturing);
  const saved = useBugReporter((s) => s.buttonAt);
  const moveButton = useBugReporter((s) => s.moveButton);
  const [at, setAt] = useState(() => saved ?? { right: 8, bottom: Math.round(Dimensions.get('window').height * 0.4) });

  // Starts on the right edge, a little below the middle (clear of tab bars and bottom buttons).
  // Created once; the drag keeps its own start point and "did it move" flag.
  const [pan] = useState(() => {
    const drag = { origin: at, moved: false };
    const clamp = (p: { right: number; bottom: number }) => {
      const { width, height } = Dimensions.get('window');
      return { right: Math.min(Math.max(p.right, 4), width - BUTTON - 4), bottom: Math.min(Math.max(p.bottom, insets.bottom + 4), height - BUTTON - insets.top - 4) };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        drag.moved = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) drag.moved = true;
        setAt(clamp({ right: drag.origin.right - g.dx, bottom: drag.origin.bottom - g.dy }));
      },
      onPanResponderRelease: (_, g) => {
        if (!drag.moved) return reportNow();
        const next = clamp({ right: drag.origin.right - g.dx, bottom: drag.origin.bottom - g.dy });
        drag.origin = next;
        setAt(next);
        moveButton(next);
      },
    });
  });

  if (hidden) return null;
  return (
    <View
      {...pan.panHandlers}
      style={[styles.fab, { right: at.right, bottom: at.bottom }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Report a bug"
      accessibilityHint="Takes a screenshot of this screen. Drag to move the button.">
      <Ionicons name="bug-outline" size={20} color={colors.white} />
    </View>
  );
}

// The report screen (src/app/report-bug.tsx) --------------------------------------

/** The report screen's content: the screenshot, the screen it came from and what went wrong. */
export function BugReportScreen() {
  const insets = useSafeAreaInsets();
  const draft = useBugReporter((s) => s.draft);
  const close = useBugReporter((s) => s.close);
  // Opened directly (a link or a reload): report without a screenshot.
  const [fallback] = useState<Draft>(() => ({ aspect: 0.5, route: current.path, params: current.params, capturedAt: new Date().toISOString() }));
  const report = draft ?? fallback;
  const [description, setDescription] = useState('');
  const [shot, setShot] = useState(report.screenshot);
  const [aspect, setAspect] = useState(report.aspect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => close(), [close]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const pickPicture = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.8 });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    const uri = asset.uri.startsWith('data:') ? asset.uri : asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : undefined;
    if (!uri) return;
    setShot(uri);
    if (asset.width && asset.height) setAspect(asset.width / asset.height);
  };

  const send = async () => {
    if (!description.trim()) return setError('Describe what went wrong');
    setError(null);
    setBusy(true);
    const { session, accounts } = useSession.getState();
    const account = session ? accounts.find((a) => a.id === session.accountId) : undefined;
    const { lang, calendar } = usePrefs.getState();
    const { appVersion, ...context } = reportContext();
    const sent = await sendBugReport({
      ...context,
      description: description.trim(),
      screenshot: shot,
      route: report.route,
      params: report.params,
      capturedAt: report.capturedAt,
      account: account ? { id: account.id, name: account.name, role: account.role, staffRole: account.staffRole } : undefined,
      app: { name: BRAND.name, version: appVersion, backend: ENV.backend, language: lang, calendar },
    });
    setBusy(false);
    if (!sent.ok) return setError(sent.error);
    toast('Bug report sent. Dhanyabad!');
    leave();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Report a bug" back={false} right={<Button label="Cancel" variant="ghost" size="sm" onPress={leave} />} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.shotRow}>
          {shot ? (
            <Image source={{ uri: shot }} style={[styles.shot, { aspectRatio: aspect }]} contentFit="contain" accessibilityLabel="Screenshot" />
          ) : (
            <View style={[styles.shot, styles.noShot, { aspectRatio: aspect }]}>
              <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              <Text size={11} color={colors.textMuted} align="center">
                No screenshot
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Text size={12} color={colors.textMuted}>
              Screen
            </Text>
            <Text raw size={13} weight="medium" color={colors.heading} numberOfLines={3}>
              {report.route}
            </Text>
            <Button label={shot ? 'Use another picture' : 'Attach a picture'} icon="images-outline" variant="outline" size="sm" onPress={pickPicture} />
            {!!shot && <Button label="Remove screenshot" variant="ghost" size="sm" onPress={() => setShot(undefined)} />}
          </View>
        </View>
        <Field
          label="What went wrong?"
          required
          multiline
          autoFocus
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            if (error) setError(null);
          }}
          placeholder="What did you tap, what did you expect, and what happened instead?"
          error={error}
        />
        <Button label="Send report" icon="send-outline" loading={busy} onPress={send} />
        <Text size={12} color={colors.textMuted}>
          The screenshot, this screen’s address, your account and device details go to the Vivah team so they can fix it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { paddingHorizontal: GUTTER, paddingTop: 16, gap: 16 },
  shotRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  shot: { height: 220, maxWidth: 170, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSoft },
  noShot: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  fab: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: colors.primary,
    opacity: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
