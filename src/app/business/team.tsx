import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { StaffMember } from '@/types/platform';
import { formatPhone, formatShortDate, uid } from '@/utils/format';

const PERMISSIONS: StaffMember['permissions'] = ['leads', 'quotes', 'bookings', 'finance', 'calendar'];

/** Staff, roles, permissions and who is on which booking. */
export default function Team() {
  const t = useRoleTheme();
  const account = useAccount();
  const { staff, bookings } = useVendorWorkspace(account);
  const save = useDb((s) => s.saveStaff);
  const remove = useDb((s) => s.removeStaff);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const shifts = (id: string) => bookings.flatMap(({ project, booking }) => booking.assignments.filter((a) => a.workerId === id && a.status !== 'CANCELLED').map((a) => ({ project, a })));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Team" subtitle={`${staff.length} members`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <KButton label="Add team member" icon="person-add-outline" onPress={() => setEditing({ id: uid('st'), orgAccountId: account.id, name: '', phone: '', role: 'Staff', permissions: ['bookings', 'calendar'], active: true })} />
        {!staff.length && <EmptyBlock icon="people-outline" title="No team yet" message="Add managers, photographers, decorators and accounts staff — assign them to bookings as in-house crew." />}
        {staff.map((m) => {
          const upcoming = shifts(m.id);
          return (
            <Card key={m.id} onPress={() => setEditing(m)} style={{ gap: 8, opacity: m.active ? 1 : 0.6 }}>
              <View style={styles.row}>
                <Avatar name={m.name} />
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="bold" color={t.c.textStrong}>
                    {m.name}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {m.role} · {formatPhone(m.phone)}
                  </Text>
                </View>
                <StatusPill status={m.active ? 'confirmed' : 'draft'} label={m.active ? 'Active' : 'Inactive'} />
              </View>
              <Text size={11} color={t.c.subtle}>
                Access: {m.permissions.join(', ') || 'none'}
              </Text>
              {upcoming.map(({ project, a }) => (
                <Text key={a.id} size={12} color={t.c.text}>
                  • {formatShortDate(a.date)} — {a.role} at {project.title}
                </Text>
              ))}
            </Card>
          );
        })}
        <Card style={{ gap: 6 }}>
          <SectionTitle title="Freelancers" />
          <Text size={13} color={t.c.muted}>
            Need extra hands? Post a gig — verified freelancers apply, and hired crew join the booking automatically.
          </Text>
        </Card>
      </ScrollView>
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.name ? 'Edit member' : 'Add member'}>
        {editing && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <KField label="Name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} />
            <KField label="Mobile" value={editing.phone} onChangeText={(phone) => setEditing({ ...editing, phone: phone.replace(/\D/g, '').slice(0, 10) })} keyboardType="phone-pad" />
            <ChoiceChips options={['Manager', 'Coordinator', 'Photographer', 'Videographer', 'Editor', 'Decorator', 'Chef', 'Accounts', 'Staff']} selected={[editing.role]} onToggle={(role) => setEditing({ ...editing, role })} />
            <Text size={13} weight="semibold" color={t.c.muted}>
              Permissions
            </Text>
            <ChoiceChips options={PERMISSIONS} selected={editing.permissions} onToggle={(p) => setEditing({ ...editing, permissions: editing.permissions.includes(p as never) ? editing.permissions.filter((x) => x !== p) : [...editing.permissions, p as StaffMember['permissions'][number]] })} />
            <View style={styles.row}>
              <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                Active
              </Text>
              <Toggle value={editing.active} onValueChange={(active) => setEditing({ ...editing, active })} accessibilityLabel="Active" />
            </View>
            <KButton label="Save" disabled={!editing.name.trim()} onPress={() => { save({ ...editing, name: editing.name.trim() }); setEditing(null); toast('Team updated'); }} />
            {staff.some((m) => m.id === editing.id) && <KButton label="Remove" variant="ghost" size="sm" onPress={() => { remove(editing.id); setEditing(null); }} />}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
