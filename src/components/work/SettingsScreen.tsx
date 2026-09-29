import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, SectionTitle, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { logout } from '@/services/auth';
import { shareText } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { AccountPrefs, AppNotification } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatPhone } from '@/utils/format';

export const DEFAULT_PREFS: AccountPrefs = {
  muted: [],
  channels: { push: true, sms: true, whatsapp: true, email: false },
  language: 'en',
  calendar: 'both',
  showProfileToVendors: true,
  marketing: false,
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

  const exportData = () => {
    const db = useDb.getState();
    const mine = {
      account,
      projects: db.projects.filter((p) => p.customerId === account.id || p.collaborators.some((c) => c.accountId === account.id)).map((p) => p.code),
      reviews: db.reviews.filter((r) => r.authorId === account.id),
      messages: db.messages.filter((m) => m.senderId === account.id).length,
      notifications: db.notifications.filter((n) => n.to === account.id).length,
      exportedAt: new Date().toISOString(),
    };
    shareText(JSON.stringify(mine, null, 2), `${BRAND.name.toLowerCase()}-my-data.json`, 'application/json');
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
          <ChoiceChips options={['English', 'नेपाली']} selected={[prefs.language === 'ne' ? 'नेपाली' : 'English']} onToggle={(v) => set({ language: v === 'नेपाली' ? 'ne' : 'en' })} />
          <Text size={13} color={t.c.muted}>
            Show dates in
          </Text>
          <ChoiceChips options={['AD', 'BS (Bikram Sambat)', 'Both']} selected={[prefs.calendar === 'AD' ? 'AD' : prefs.calendar === 'BS' ? 'BS (Bikram Sambat)' : 'Both']} onToggle={(v) => set({ calendar: v === 'AD' ? 'AD' : v === 'Both' ? 'both' : 'BS' })} />
        </Card>

        <SectionTitle title="Privacy" />
        <Card padded={false}>
          {row(account.role === 'customer' ? 'Let vendors see my wedding details' : 'Show my profile in search', prefs.showProfileToVendors, (v) => set({ showProfileToVendors: v }), account.role === 'customer' ? 'Date, city and guest count — never your phone number' : undefined)}
          {row('Offers & wedding tips', prefs.marketing, (v) => set({ marketing: v }))}
        </Card>

        <SectionTitle title="Your data" />
        <Card style={{ gap: 10 }}>
          <KButton label="Download my data" icon="download-outline" variant="secondary" onPress={exportData} />
          <KButton label="Log out" icon="log-out-outline" variant="secondary" onPress={() => confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)} />
          <KButton
            label="Delete my account"
            icon="trash-outline"
            variant="danger"
            onPress={() =>
              confirm(
                'Delete your account?',
                'This removes your profile from this device and signs you out. Bookings, payments and contracts are kept for 7 years as required by Nepal’s tax law, but anonymised.',
                'Delete',
                () => {
                  deleteAccount(account.id);
                  toast('Account deleted');
                  router.replace('/');
                },
              )
            }
          />
        </Card>
        <Text size={11} color={t.c.subtle} align="center">
          {BRAND.name} · support {BRAND.supportPhone} · {BRAND.supportEmail}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
});
