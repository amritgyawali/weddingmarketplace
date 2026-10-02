/**
 * Shake to report a bug. Shaking the phone (or Alt+Shift+B on the web, or
 * Settings → Report a problem) takes a screenshot of the screen exactly as it
 * is, then opens a sheet to describe the problem. The report goes to the bug
 * inbox on the developer's computer and lands in `bug-reports/` (see
 * `backend/bugReport.ts` and `scripts/bug-inbox.cjs`).
 *
 * Only builds that have an inbox show it: development builds, and test builds
 * with EXPO_PUBLIC_BUG_INBOX_URL. A super admin can switch it off
 * (`app.bug_report`) and each device can turn shaking off in Settings.
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { bugReportsAvailable, captureConsole, recordRoute, reportContext, sendBugReport, setDeviceBugInbox } from '@/backend/bugReport';
import { BRAND } from '@/constants/brand';
import { ENV } from '@/constants/env';
import { colors, radius } from '@/constants/theme';
import { useFeatures } from '@/hooks/useFeatures';
import { useShake } from '@/hooks/useShake';
import { usePrefs } from '@/i18n';
import { useSession } from '@/store/useSession';

import { Button } from './Button';
import { Field } from './Field';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { toast } from './Toast';

interface Draft {
  screenshot?: string;
  /** Width / height of the screenshot, for the preview. */
  aspect: number;
  route: string;
  params: Record<string, string>;
  capturedAt: string;
}

interface BugReporterState {
  /** Per device: shaking opens the reporter. */
  shake: boolean;
  /** Per device: the bug inbox address typed in Settings (empty = the build's own). */
  inbox: string;
  draft: Draft | null;
  setShake: (shake: boolean) => void;
  setInbox: (inbox: string) => void;
  open: (draft: Draft) => void;
  close: () => void;
}

/** The reporter's state: the open draft, and the device's shake setting and inbox address (persisted). */
export const useBugReporter = create<BugReporterState>()(
  persist(
    (set) => ({
      shake: true,
      inbox: '',
      draft: null,
      setShake: (shake) => set({ shake }),
      setInbox: (inbox) => set({ inbox: inbox.trim() }),
      open: (draft) => set({ draft }),
      close: () => set({ draft: null }),
    }),
    { name: 'vivah-bug-reporter', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ shake: s.shake, inbox: s.inbox }) },
  ),
);

// The backend reads the device's inbox address (restored from storage, or edited in Settings).
useBugReporter.subscribe((s) => setDeviceBugInbox(s.inbox));

let current: { path: string; params: Record<string, string> } = { path: '/', params: {} };
let capturing = false;

/** Starts keeping console errors for reports, in builds that can send them. Root layout calls it once. */
export function installBugReporter() {
  if (bugReportsAvailable()) captureConsole();
}

/** Screenshots the screen as it is now and opens the report sheet. `screenshot: false` opens it without one. */
export async function reportBug({ screenshot = true }: { screenshot?: boolean } = {}) {
  if (capturing || useBugReporter.getState().draft || !bugReportsAvailable()) return;
  capturing = true;
  try {
    const { width, height } = Dimensions.get('window');
    let shot: string | undefined;
    if (screenshot) {
      try {
        const base64 = await captureScreen({ format: 'png', result: 'base64' });
        shot = `data:image/png;base64,${base64}`;
      } catch {
        // The sheet still opens; a picture can be attached by hand.
      }
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useBugReporter.getState().open({ screenshot: shot, aspect: width / height, route: current.path, params: current.params, capturedAt: new Date().toISOString() });
  } finally {
    capturing = false;
  }
}

const shakeToReport = () => void reportBug();

const asParams = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(',') : v]])));

/** Follows the current screen, listens for shakes and shows the report sheet. Root layout only. */
export function BugReporterHost() {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const on = useFeatures()('app.bug_report');
  const shake = useBugReporter((s) => s.shake);
  const draft = useBugReporter((s) => s.draft);
  const available = bugReportsAvailable() && on;

  useEffect(() => {
    current = { path, params: asParams(params) };
    recordRoute(path);
  }, [path, params]);

  useShake(shakeToReport, available && shake && !draft);

  // Desktop browsers can't shake: Alt+Shift+B does the same.
  useEffect(() => {
    if (Platform.OS !== 'web' || !available || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        void reportBug();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available]);

  if (!available || !draft) return null;
  return <ReportSheet key={draft.capturedAt} draft={draft} />;
}

function ReportSheet({ draft }: { draft: Draft }) {
  const close = useBugReporter((s) => s.close);
  const [description, setDescription] = useState('');
  const [shot, setShot] = useState(draft.screenshot);
  const [aspect, setAspect] = useState(draft.aspect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      route: draft.route,
      params: draft.params,
      capturedAt: draft.capturedAt,
      account: account ? { id: account.id, name: account.name, role: account.role, staffRole: account.staffRole } : undefined,
      app: { name: BRAND.name, version: appVersion, backend: ENV.backend, language: lang, calendar },
    });
    setBusy(false);
    if (!sent.ok) return setError(sent.error);
    close();
    toast('Bug report sent. Dhanyabad!');
  };

  return (
    <Sheet
      visible
      onClose={close}
      title="Report a bug"
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={close} />
          <Button label="Send report" icon="send-outline" loading={busy} style={{ flex: 1 }} onPress={send} />
        </View>
      }>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
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
              {draft.route}
            </Text>
            <Button label={shot ? 'Use another picture' : 'Attach a picture'} icon="images-outline" variant="outline" size="sm" onPress={pickPicture} />
            {!!shot && <Button label="Remove screenshot" variant="ghost" size="sm" onPress={() => setShot(undefined)} />}
          </View>
        </View>
        <Field
          label="What went wrong?"
          required
          multiline
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            if (error) setError(null);
          }}
          placeholder="What did you tap, what did you expect, and what happened instead?"
          error={error}
        />
        <Text size={12} color={colors.textMuted}>
          The screenshot, this screen’s address, your account and device details go to the developer’s computer.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  shotRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  shot: { height: 200, maxWidth: 160, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSoft },
  noShot: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
});
