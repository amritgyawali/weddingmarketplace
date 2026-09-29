import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Avatar, Card, KField, ListRow, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { UserRole } from '@/types/platform';

type Filter = 'all' | UserRole;

export default function UsersDirectory() {
  const t = useRoleTheme();
  const accounts = useSession((s) => s.accounts);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = accounts.filter(
    (a) => (filter === 'all' || a.role === filter) && (!q || `${a.name} ${a.businessName ?? ''} ${a.phone} ${a.city}`.toLowerCase().includes(q)),
  );
  const count = (f: Filter) => accounts.filter((a) => f === 'all' || a.role === f).length;

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
            { id: 'vendor', label: 'Vendors' },
            { id: 'freelancer', label: 'Freelancers' },
            { id: 'platform', label: 'Team' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={{ all: count('all'), customer: count('customer'), vendor: count('vendor'), freelancer: count('freelancer'), platform: count('platform') }}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        renderItem={({ item, index }) => (
          <Card padded={false} style={{ overflow: 'hidden', marginTop: index ? 8 : 0 }}>
            <ListRow
              leading={<Avatar name={item.businessName ?? item.name} />}
              title={item.businessName ?? item.name}
              subtitle={`${ROLE_THEMES[item.role].label} · ${item.city} · +91 ${item.phone}`}
              trailing={<StatusPill status={item.verified ? 'approved' : 'pending'} label={item.verified ? 'Verified' : 'Unverified'} />}
            />
          </Card>
        )}
      />
    </View>
  );
}
