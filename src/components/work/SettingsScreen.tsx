import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { deleteMyAccount, exportMyData } from '@/backend/account';
import { usesEmailSignIn } from '@/backend/auth';
import { bugReportsAvailable, defaultBugInbox, devInboxOffered, pingBugInbox } from '@/backend/bugReport';
import { Card, ChoiceChips, KButton, KField, ListRow, SectionTitle, StackHeader } from '@/components/kit';
import { bugButtonOn, reportBug, screenshotToReportWorks, shakeToReportWorks, useBugReporter } from '@/components/ui/BugReporter';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast, toastError } from '@/components/ui/Toast';
import { AppearanceHint, AppearancePicker } from '@/components/ui/AppearancePicker';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { BRAND } from '@/constants/brand';
import { useFeatures } from '@/hooks/useFeatures';
import { usePrefs } from '@/i18n';
import { logout } from '@/services/auth';
import { shareText } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { AccountPrefs, AppNotification } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatPhone } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export const DEFAULT_PREFS: AccountPrefs = {
  muted: [],
  channels: { push: true, sms: true, whatsapp: true, email: false },
  language: 'en',
  calendar: 'both',
  showProfileToVendors: true,
  marketing: false,
  analytics: true,
};

type Kind = NonNullable<AppNotification['kind']>;
const KINDS: { id: Kind; label: string; roles?: string[] }[] = [
  { id: 'message', label: 'New messages' },
  { id: 'quote', label: 'Quotations' },
  { id: 'booking', label: 'Bookings & contracts' },
  { id: 'payment', label: 'Payments & payouts' },
  { id: 'task', label: 'Tasks & reminders' },
  { id: 'event', label: 'Meetings & functions' },
  { id: 'review', label: 'Reviews' },
  { id: 'lead', label: 'New leads', roles: ['vendor', 'platform'] },
  { id: 'gig', label: 'Gig invites', roles: ['freelancer', 'vendor', 'platform'] },
  { id: 'system', label: 'Tips & announcements' },
];

/** Notification, language, calendar and privacy settings plus data export and account deletion. */
export function SettingsScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const updateAccount = useSession((s) => s.updateAccount);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const prefs = { ...DEFAULT_PREFS, ...account.prefs };
  const set = (patch: Partial<AccountPrefs>) => updateAccount(account.id, { prefs: { ...prefs, ...patch } });
  const kinds = KINDS.filter((k) => !k.roles || k.roles.includes(account.role));

  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const calendar = usePrefs((s) => s.calendar);
  const setCalendar = usePrefs((s) => s.setCalendar);
  const live = usesEmailSignIn();
  const featureOn = useFeatures();
  const bugReports = bugReportsAvailable() && featureOn('app.bug_report');
  const shake = useBugReporter((s) => s.shake);
  const setShake = useBugReporter((s) => s.setShake);
  const screenshots = useBugReporter((s) => s.screenshots);
  const setScreenshots = useBugReporter((s) => s.setScreenshots);
  const threeFingers = useBugReporter((s) => s.threeFingers);
  const setThreeFingers = useBugReporter((s) => s.setThreeFingers);
  const bugButton = useBugReporter((s) => s.button);
  const setBugButton = useBugReporter((s) => s.setButton);
  const inbox = useBugReporter((s) => s.inbox);
  const setInbox = useBugReporter((s) => s.setInbox);
  const [inboxDraft, setInboxDraft] = useState(inbox);
  const [checkingInbox, setCheckingInbox] = useState(false);

  const checkInbox = async () => {
    setInbox(inboxDraft);
    setCheckingInbox(true);
    const reached = await pingBugInbox();
    setCheckingInbox(false);
    if (reached.ok) toast('Connected to the bug inbox');
    else toastError(reached.error);
  };

  const exportData = async () => {
    const db = useDb.getState();
    const mine: Record<string, unknown> = {
      account,
      projects: db.projects.filter((p) => p.customerId === account.id || p.collaborators.some((c) => c.accountId === account.id)).map((p) => p.code),
      reviews: db.reviews.filter((r) => r.authorId === account.id),
      messages: db.messages.filter((m) => m.senderId === account.id).length,
      notifications: db.notifications.filter((n) => n.to === account.id).length,
      exportedAt: new Date().toISOString(),
    };
    if (live) {
      // What the server holds is the real record; the device copy comes along for completeness.
      setBusy('export');
      const server = await exportMyData();
      setBusy(null);
      if (!server.ok) return toast(server.error);
      mine.server = server.value;
    }
    shareText(JSON.stringify(mine, null, 2), `${BRAND.name.toLowerCase()}-my-data.json`, 'application/json');
  };

  const removeAccount = async () => {
    if (live) {
      setBusy('delete');
      const closed = await deleteMyAccount();
      setBusy(null);
      // Open bookings, refunds or payouts come back as a message saying what to settle first.
      if (!closed.ok) return toast(closed.error);
      logout();
    }
    deleteAccount(account.id);
    toast('Account deleted');
    router.replace('/');
  };

  const row = (label: string, value: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <View style={[styles.row, { borderTopColor: t.c.border }]} key={label}>
      <View style={{ flex: 1 }}>
        <Text size={14} color={t.c.text}>
          {label}
        </Text>
        {!!hint && (
          <Text size={12} color={t.c.muted}>
            {hint}
          </Text>
        )}
      </View>
      <Toggle value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Settings" subtitle={`${account.name} · ${formatPhone(account.phone)}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <SectionTitle title="Appearance" />
        <Card style={{ gap: 10 }}>
          <AppearancePicker />
          <AppearanceHint />
        </Card>

        <SectionTitle title="Notify me about" />
        <Card padded={false}>{kinds.map((k) => row(k.label, !prefs.muted.includes(k.id), (on) => set({ muted: on ? prefs.muted.filter((x) => x !== k.id) : [...prefs.muted, k.id] })))}</Card>
        <Text size={12} color={t.c.muted}>
          Muted updates still appear in your notification list, just without a badge. Emergency alerts always come through.
        </Text>

        <SectionTitle title="Channels" />
        <Card padded={false}>
          {row('Push notifications', prefs.channels.push, (v) => set({ channels: { ...prefs.channels, push: v } }))}
          {row('SMS', prefs.channels.sms, (v) => set({ channels: { ...prefs.channels, sms: v } }), 'Payment receipts and day-of alerts')}
          {row('WhatsApp', prefs.channels.whatsapp, (v) => set({ channels: { ...prefs.channels, whatsapp: v } }))}
          {row('Email', prefs.channels.email, (v) => set({ channels: { ...prefs.channels, email: v } }), account.email ?? 'Add an email in your profile')}
        </Card>

        <SectionTitle title="Language & dates" />
        <Card style={{ gap: 10 }}>
          <Text size={13} color={t.c.muted}>
            App language
          </Text>
          <LanguageSwitch onChange={(language) => set({ language })} />
          <Text size={13} color={t.c.muted}>
            Calendar
          </Text>
          <ChoiceChips
            options={['Nepali (BS)', 'English (AD)']}
            selected={[calendar === 'ad' ? 'English (AD)' : 'Nepali (BS)']}
            onToggle={(v) => {
              const next = v === 'English (AD)' ? 'ad' : 'bs';
              setCalendar(next);
              set({ calendar: next === 'ad' ? 'AD' : 'BS' });
              toast(next === 'ad' ? 'Dates now show in AD' : 'Dates now show in Bikram Sambat');
            }}
          />
          <Text size={12} color={t.c.muted}>
            Calendars show the Nepali month with the English date in small type. Dates are saved the same either way.
          </Text>
        </Card>

        <SectionTitle title="Privacy" />
        <Card padded={false}>
          {row(account.role === 'customer' ? 'Let vendors see my wedding details' : 'Show my profile in search', prefs.showProfileToVendors, (v) => set({ showProfileToVendors: v }), account.role === 'customer' ? 'Date, city and guest count — never your phone number' : undefined)}
          {row('Offers & wedding tips', prefs.marketing, (v) => set({ marketing: v }))}
          {row('Share usage analytics', prefs.analytics !== false, (v) => set({ analytics: v }), 'Which screens are used, never your details. Crash reports are sent either way.')}
        </Card>

        <SectionTitle title="Your data" />
        <Card style={{ gap: 10 }}>
          <KButton label="Download my data" icon="download-outline" variant="secondary" loading={busy === 'export'} onPress={exportData} />
          <KButton label="Log out" icon="log-out-outline" variant="secondary" onPress={() => confirm('Log out?', live ? 'You can sign back in with a code sent to your email.' : 'You can sign back in with your mobile number.', 'Log out', logout)} />
          <KButton
            label="Delete my account"
            icon="trash-outline"
            variant="danger"
            loading={busy === 'delete'}
            onPress={() =>
              confirm(
                'Delete your account?',
                'Your profile, contact details, devices and private documents are removed and you are signed out. Bookings, payments and contracts are kept as long as Nepal’s tax law requires, without your name.',
                'Delete',
                () => void removeAccount(),
              )
            }
          />
        </Card>

        {bugReports && (
          <>
            <SectionTitle title="Help" />
            <Card padded={false} style={{ overflow: 'hidden' }}>
              <ListRow icon="bug-outline" title="Report a problem" subtitle="Or, on the screen that went wrong, take a screenshot or hold three fingers on it" onPress={() => void reportBug({ screenshot: false })} />
              {screenshotToReportWorks() && row('Screenshot to report a bug', screenshots, setScreenshots, 'Taking a phone screenshot (side and volume buttons) opens a bug report with it')}
              {row('Hold three fingers to report a bug', threeFingers, setThreeFingers, 'Hold three fingers on any screen for half a second')}
              {row('Bug button', bugButtonOn(bugButton), setBugButton, 'A small button on every screen; drag it out of the way')}
              {shakeToReportWorks() && row('Shake to report a bug', shake, setShake, 'Takes a screenshot of the screen you are on')}
              {devInboxOffered() && (
                <View style={[styles.inbox, { borderTopColor: t.c.border }]}>
                  <KField
                    label="Bug inbox address"
                    value={inboxDraft}
                    onChangeText={setInboxDraft}
                    onEndEditing={() => setInbox(inboxDraft)}
                    placeholder={defaultBugInbox() ?? '192.168.1.10:8790'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    hint="Test builds also send each report to this computer (npx expo start or npm run bugs:inbox, on the same Wi-Fi). Leave empty to use the one shown."
                  />
                  <KButton label="Check connection" icon="wifi-outline" variant="secondary" size="sm" loading={checkingInbox} onPress={checkInbox} />
                </View>
              )}
            </Card>
          </>
        )}

        <SectionTitle title="Legal" />
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <ListRow icon="document-text-outline" title="Terms of use" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
          <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
          <ListRow icon="receipt-outline" title="Cancellation and refunds" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'refunds' } })} />
        </Card>
        <Text size={11} color={t.c.muted} align="center">
          {BRAND.name} · support {BRAND.supportPhone} · {BRAND.supportEmail}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  inbox: { gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
