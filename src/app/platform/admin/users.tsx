import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Card, EmptyBlock, KButton, KField, ListRow, Segmented, StatusPill } from '@/components/kit';
import { ROLE_NAMES } from '@/components/admin/shared';
import { staffScreen } from '@/components/persona/StaffGate';
import { ToolPage } from '@/components/toolkit/core';
import { useSession } from '@/store/useSession';
import type { UserRole } from '@/types/platform';
import { formatPhone } from '@/utils/format';

type Filter = 'all' | UserRole;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'customer', label: 'Couples' },
  { id: 'vendor', label: 'Businesses' },
  { id: 'freelancer', label: 'Freelancers' },
  { id: 'platform', label: 'Staff' },
];

/** Every account on the platform, all roles, searchable; tap one to edit it. */
function AllAccounts() {
  const accounts = useSession((s) => s.accounts);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = accounts
    .filter((a) => filter === 'all' || a.role === filter)
    .filter((a) => !q || [a.name, a.businessName, a.phone, a.email, a.city, a.id].some((x) => x?.toLowerCase().includes(q)))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'all' ? accounts.length : accounts.filter((a) => a.role === f.id).length])) as Record<Filter, number>;

  return (
    <ToolPage title="All accounts" subtitle={`${accounts.length} people`} right={<KButton label="New" icon="add" size="sm" onPress={() => router.push({ pathname: '/platform/admin/user/[id]', params: { id: 'new' } })} />}>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
      <KField placeholder="Search by name, business, phone, email or city" value={query} onChangeText={setQuery} autoCorrect={false} />
      {list.length === 0 ? (
        <EmptyBlock icon="search-outline" title="No one matches" message="Try another name or number, or a different role." />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {list.map((a) => (
            <ListRow
              key={a.id}
              leading={<Avatar name={a.businessName ?? a.name} size={38} />}
              title={a.businessName ? `${a.businessName} (${a.name})` : a.name}
              subtitle={`${ROLE_NAMES[a.role]}${a.staffRole ? ` · ${a.staffRole.replace('_', ' ')}` : ''} · ${formatPhone(a.phone)} · ${a.city}`}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {a.suspended ? <StatusPill status="cancelled" label="Suspended" /> : !a.verified ? <StatusPill status="pending" label="Unverified" /> : <StatusPill status="verified" label="Active" />}
                </View>
              }
              onPress={() => router.push({ pathname: '/platform/admin/user/[id]', params: { id: a.id } })}
            />
          ))}
        </Card>
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/users', AllAccounts);
