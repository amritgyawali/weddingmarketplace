import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RecordFields, ROLE_NAMES } from '@/components/admin/shared';
import { Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast, toastError } from '@/components/ui/Toast';
import { impersonate } from '@/services/auth';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account, PlatformTeam, StaffRole, UserRole } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate } from '@/utils/format';

const ROLES: UserRole[] = ['customer', 'vendor', 'freelancer', 'platform'];
const STAFF_ROLES: StaffRole[] = ['coordinator', 'support', 'finance', 'admin', 'super_admin'];
const TEAMS: PlatformTeam[] = ['Wedding Coordination', 'Wedding Operations', 'Vendor Success', 'Finance', 'Admin'];
const staffLabel = (r: string) => r.replace('_', ' ').replace(/^./, (c) => c.toUpperCase());

type Draft = Pick<Account, 'role' | 'name' | 'phone' | 'city'> & Partial<Account>;

/** Edit any account of any role, create one, sign in as it, or delete it. */
function AccountEditor() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const account = useSession((s) => s.accounts.find((a) => a.id === id));
  const me = useSession((s) => s.session?.accountId);
  const save = useDb((s) => s.adminSaveAccount);
  const create = useDb((s) => s.adminCreateAccount);
  const remove = useDb((s) => s.adminDeleteAccount);
  const projects = useDb((s) => s.projects);
  const [draft, setDraft] = useState<Draft>(() => account ?? { role: 'customer', name: '', phone: '', city: 'Kathmandu', verified: true });
  const [advanced, setAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const settingsCities = useDb((s) => s.settings.cities);
  const cities = [...new Set([...settingsCities, draft.city].filter(Boolean))];

  if (!isNew && !account) {
    return (
      <ToolPage title="Account">
        <EmptyBlock icon="person-outline" title="Account not found" message="It may have been deleted." action="All accounts" onAction={() => router.replace('/platform/admin/users')} />
      </ToolPage>
    );
  }

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };

  /** Checks the form before the store does, so each problem shows under its field. */
  const validate = () => {
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 2) next.name = 'Enter a name of at least 2 characters';
    if (!/^9[678]\d{8}$/.test(draft.phone.replace(/\D/g, '').slice(-10))) next.phone = 'Enter a valid Nepali mobile number (98XXXXXXXX)';
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) next.email = 'Enter a valid email address';
    if (draft.role === 'vendor' && !draft.businessName?.trim()) next.businessName = 'Enter the business name';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return toastError('Check the highlighted fields');
    if (isNew) {
      const res = create({ ...draft, staffRole: draft.role === 'platform' ? (draft.staffRole ?? 'coordinator') : undefined });
      if (res.error) return toastError(res.error);
      router.replace({ pathname: '/platform/admin/user/[id]', params: { id: res.account!.id } });
      return;
    }
    const err = save(account!.id, draft);
    if (err) toastError(err);
  };

  const owned = account ? projects.filter((p) => p.customerId === account.id).length : 0;

  return (
    <ToolPage title={isNew ? 'New account' : (account?.businessName ?? account?.name ?? 'Account')} subtitle={isNew ? 'Any role' : `${ROLE_NAMES[draft.role]} · joined ${formatLongDate(account!.createdAt)}`}>
      {!isNew && account!.id !== me && (
        <Card style={{ gap: 10 }}>
          <Text size={14} color={t.c.text}>
            See exactly what {account!.name.split(' ')[0]} sees. A bar at the top brings you back here.
          </Text>
          <KButton label={`Sign in as ${account!.name.split(' ')[0]}`} icon="eye-outline" variant="secondary" onPress={() => impersonate(account!)} />
        </Card>
      )}

      <SectionTitle title="Role" />
      <Card style={{ gap: 12 }}>
        <ChoiceChips options={ROLES.map((r) => ROLE_NAMES[r])} selected={[ROLE_NAMES[draft.role]]} onToggle={(v) => set({ role: ROLES.find((r) => ROLE_NAMES[r] === v) ?? draft.role })} />
        {draft.role === 'platform' && (
          <>
            <Text size={13} weight="medium" color={t.c.text}>
              Staff role
            </Text>
            <ChoiceChips options={STAFF_ROLES.map(staffLabel)} selected={[staffLabel(draft.staffRole ?? 'coordinator')]} onToggle={(v) => set({ staffRole: STAFF_ROLES.find((r) => staffLabel(r) === v) })} />
            <Text size={13} weight="medium" color={t.c.text}>
              Team
            </Text>
            <ChoiceChips options={TEAMS} selected={draft.team ? [draft.team] : []} onToggle={(v) => set({ team: v as PlatformTeam })} />
          </>
        )}
      </Card>

      <SectionTitle title="Details" />
      <Card style={{ gap: 12 }}>
        <KField label="Full name" required value={draft.name} onChangeText={(name) => set({ name })} error={errors.name} />
        {draft.role === 'vendor' && <KField label="Business name" required value={draft.businessName ?? ''} onChangeText={(businessName) => set({ businessName })} error={errors.businessName} />}
        <KField label="Mobile number" required value={draft.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" maxLength={14} error={errors.phone} hint="They sign in with this number" />
        <KField label="Email" value={draft.email ?? ''} onChangeText={(email) => set({ email: email || undefined })} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <Text size={13} weight="medium" color={t.c.text}>
          City
        </Text>
        <ChoiceChips options={cities} selected={[draft.city]} onToggle={(city) => set({ city })} />
        {(draft.role === 'vendor' || draft.role === 'freelancer') && <KField label="Bio / headline" value={draft.headline ?? draft.bio ?? ''} onChangeText={(v) => set(draft.role === 'freelancer' ? { bio: v } : { headline: v })} multiline />}
      </Card>

      <SectionTitle title="Status" />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={[styles.row, { borderBottomColor: t.c.border }]}>
          <View style={{ flex: 1 }}>
            <Text size={14} color={t.c.textStrong}>
              Verified
            </Text>
            <Text size={12} color={t.c.muted}>
              Businesses and freelancers show the verified badge and get bookings
            </Text>
          </View>
          <Toggle value={!!draft.verified} onValueChange={(verified) => set({ verified })} accessibilityLabel="Verified" />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text size={14} color={t.c.textStrong}>
              Suspended
            </Text>
            <Text size={12} color={t.c.muted}>
              A suspended account can’t sign in
            </Text>
          </View>
          <Toggle value={!!draft.suspended} onValueChange={(suspended) => set({ suspended })} accessibilityLabel="Suspended" />
        </View>
      </Card>

      {!isNew && (
        <>
          <KButton label={advanced ? 'Hide all fields' : 'Edit every field'} variant="ghost" size="sm" icon={advanced ? 'chevron-up' : 'code-slash-outline'} onPress={() => setAdvanced((v) => !v)} />
          {advanced && (
            <>
              <Hint>Every stored field of this account. Lists and nested details are edited as JSON.</Hint>
              <RecordFields record={draft as never} lockedKeys={['id', 'createdAt']} onChange={(next) => setDraft(next as unknown as Draft)} />
            </>
          )}
        </>
      )}

      <KButton label={isNew ? 'Create account' : 'Save changes'} icon="checkmark" size="lg" onPress={submit} />

      {!isNew && (
        <KButton
          label="Delete account"
          icon="trash-outline"
          variant="danger"
          onPress={() =>
            confirm(
              `Delete ${account!.name}?`,
              owned ? `They own ${owned} project${owned > 1 ? 's' : ''}; the projects stay, without a working sign-in.` : 'They will no longer be able to sign in. This can’t be undone.',
              'Delete',
              () => {
                const err = remove(account!.id);
                if (err) return toastError(err);
                toast('Account deleted');
                router.back();
              },
            )
          }
        />
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/user', AccountEditor);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
});
