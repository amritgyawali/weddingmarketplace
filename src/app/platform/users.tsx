import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Card, KButton, KField, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { UserRole } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatPhone, formatShortDate } from '@/utils/format';

type Filter = 'all' | UserRole | 'suspended';

/** Every account on the platform with verify / suspend / restore controls. */
export default function UsersDirectory() {
  const t = useRoleTheme();
  const accounts = useSession((s) => s.accounts);
  const updateAccount = useSession((s) => s.updateAccount);
  const suspend = useDb((s) => s.setAccountSuspended);
  const projects = useDb((s) => s.projects);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const test = (f: Filter, a: (typeof accounts)[number]) => (f === 'all' ? true : f === 'suspended' ? !!a.suspended : a.role === f);
  const list = accounts.filter((a) => test(filter, a) && (!q || `${a.name} ${a.businessName ?? ''} ${a.phone} ${a.city}`.toLowerCase().includes(q)));
  const count = (f: Filter) => accounts.filter((a) => test(f, a)).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Users" subtitle={`${accounts.length} accounts`} />
      <View style={{ paddingTop: 12, gap: 10 }}>
        <View style={{ paddingHorizontal: 14 }}>
          <KField placeholder="Search name, phone or city" value={query} onChangeText={setQuery} />
        </View>
        <Segmented
          options={[
            { id: 'all', label: 'All' },
            { id: 'customer', label: 'Couples' },
            { id: 'vendor', label: 'Providers' },
            { id: 'freelancer', label: 'Freelancers' },
            { id: 'platform', label: 'Team' },
            { id: 'suspended', label: 'Suspended' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={{ all: count('all'), customer: count('customer'), vendor: count('vendor'), freelancer: count('freelancer'), platform: count('platform'), suspended: count('suspended') }}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 30 }}
        renderItem={({ item }) => {
          const weddings = projects.filter((p) => p.customerId === item.id).length;
          return (
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <Avatar name={item.businessName ?? item.name} />
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="bold" color={t.c.textStrong}>
                    {item.businessName ?? item.name}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {ROLE_THEMES[item.role].label}
                    {item.staffRole ? ` (${item.staffRole})` : ''} · {item.city} · {formatPhone(item.phone)}
                  </Text>
                  <Text size={11} color={t.c.subtle}>
                    Joined {formatShortDate(item.createdAt)}
                    {item.role === 'customer' ? ` · ${weddings} project${weddings === 1 ? '' : 's'}` : ''}
                    {item.skills?.length ? ` · ${item.skills.join(', ')}` : ''}
                  </Text>
                </View>
                <StatusPill status={item.suspended ? 'suspended' : item.verified ? 'verified' : 'unverified'} />
              </View>
              {item.role !== 'platform' && (
                <View style={styles.row}>
                  {!item.verified && !item.suspended && (
                    <KButton label="Mark verified" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => updateAccount(item.id, { verified: true })} />
                  )}
                  {item.suspended ? (
                    <KButton
                      label="Restore"
                      size="sm"
                      variant="success"
                      style={{ flex: 1 }}
                      onPress={() => {
                        suspend(item.id, false);
                        toast(`${item.name} restored`);
                      }}
                    />
                  ) : (
                    <KButton
                      label="Suspend"
                      size="sm"
                      variant="danger"
                      style={{ flex: 1 }}
                      onPress={() =>
                        confirm(`Suspend ${item.name}?`, 'They will be signed out and cannot log in until restored.', 'Suspend', () => {
                          suspend(item.id, true, 'Suspended by admin');
                          toast(`${item.name} suspended`, 'ban');
                        })
                      }
                    />
                  )}
                </View>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
