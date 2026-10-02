import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { COLLECTIONS, recordsOf } from '@/components/admin/shared';
import { Card, KField, ListRow, SectionTitle, StatusPill } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { useDb } from '@/store/useDb';

/** Every collection the app stores, with its size; open one to browse and edit its records. */
function AllData() {
  const db = useDb();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = COLLECTIONS.filter((c) => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q) || String(c.key).toLowerCase().includes(q));
  const groups = [...new Set(list.map((c) => c.group))];

  return (
    <ToolPage title="All data" subtitle={`${COLLECTIONS.length} collections`}>
      <Hint>Open a collection to see every record. You can change any field, add records and delete them. Edits are checked and audited.</Hint>
      <KField placeholder="Find a collection (payments, guests, gigs…)" value={query} onChangeText={setQuery} autoCorrect={false} />
      {groups.map((g) => (
        <View key={g}>
          <SectionTitle title={g} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {list
              .filter((c) => c.group === g)
              .map((c) => {
                const value = db[c.key];
                const size = c.key === 'settings' ? 1 : recordsOf(value).length;
                return (
                  <ListRow
                    key={c.key}
                    icon="folder-open-outline"
                    title={c.label}
                    subtitle={c.hint || String(c.key)}
                    trailing={<StatusPill status="draft" label={String(size)} />}
                    onPress={() =>
                      c.key === 'settings'
                        ? router.push({ pathname: '/platform/admin/record/[name]/[id]', params: { name: 'settings', id: 'settings' } })
                        : router.push({ pathname: '/platform/admin/collection/[name]', params: { name: c.key } })
                    }
                  />
                );
              })}
          </Card>
        </View>
      ))}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/data', AllData);
