import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { exportCsv } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatShortDate, formatTime } from '@/utils/format';

/** Append-only audit trail of sensitive actions (bookings, payments, payouts, verification…). */
export default function AuditLog() {
  const t = useRoleTheme();
  const audit = useDb((s) => s.audit);
  const [entity, setEntity] = useState('All');
  const [query, setQuery] = useState('');
  const entities = ['All', ...new Set(audit.map((a) => a.entity))];
  const q = query.trim().toLowerCase();
  const list = audit.filter((a) => (entity === 'All' || a.entity === entity) && (!q || `${a.actorName} ${a.action} ${a.detail ?? ''}`.toLowerCase().includes(q)));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Audit log" subtitle={`${audit.length} entries`} />
      <View style={{ padding: 14, gap: 8 }}>
        <KField placeholder="Search actor, action or detail" value={query} onChangeText={setQuery} />
        <ChoiceChips options={entities} selected={[entity]} onToggle={setEntity} />
        <KButton label="Export CSV" icon="download-outline" size="sm" variant="ghost" onPress={() => exportCsv(list.map((a) => ({ at: a.at, actor: a.actorName, action: a.action, entity: a.entity, id: a.entityId, detail: a.detail ?? '' })), 'vivah-audit')} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ width: 86 }}>
              <Text size={11} weight="bold" color={t.c.textStrong}>
                {formatShortDate(item.at)}
              </Text>
              <Text size={11} color={t.c.muted}>
                {formatTime(item.at)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text size={13} weight="semibold" color={t.c.textStrong}>
                {item.action}
              </Text>
              <Text size={12} color={t.c.muted}>
                {item.actorName} · {item.entity} {item.entityId.slice(0, 14)}
                {item.detail ? ` · ${item.detail}` : ''}
              </Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, padding: 10 },
});
