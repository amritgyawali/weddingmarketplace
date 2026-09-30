import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, EmptyBlock, KButton, ListRow, SectionTitle, StatusPill } from '@/components/kit';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { useExperience } from '@/hooks/useExperience';
import { can } from '@/services/experience';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { OccasionDef } from '@/types/persona';

/** The occasions families can plan (super admins add, edit and delete them). */
export default function Occasions() {
  const t = useRoleTheme();
  const exp = useExperience();
  const occasions = useDb((s) => s.occasions);
  const projects = useDb((s) => s.projects);
  const manage = can(exp, 'occasion.manage');
  const sorted = [...occasions].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  const uses = (o: OccasionDef) => projects.filter((p) => p.occasion === o.id).length;
  const open = (id: string) => router.push({ pathname: '/platform/occasion/[id]', params: { id } });

  const row = (o: OccasionDef) => (
    <ListRow
      key={o.id}
      leading={
        <View style={{ width: 36, alignItems: 'center' }}>
          <Ionicons name={(o.icon || 'calendar-outline') as keyof typeof Ionicons.glyphMap} size={22} color={o.active ? t.c.textStrong : t.c.subtle} />
        </View>
      }
      title={o.label}
      subtitle={`${o.eventTypes.length} function${o.eventTypes.length > 1 ? 's' : ''} · ${o.services.length} services · ${o.modules.length} planner tools${uses(o) ? ` · ${uses(o)} plans` : ''}`}
      trailing={<StatusPill status={o.active ? (o.builtIn ? 'draft' : 'new') : 'archived'} label={o.active ? (o.builtIn ? 'Built-in' : 'Custom') : 'Off'} />}
      onPress={() => open(o.id)}
    />
  );

  return (
    <ToolPage title="Occasions" subtitle="What families can plan on Vivah" right={manage ? <KButton label="Add" icon="add" size="sm" onPress={() => open('new')} /> : undefined}>
      <Hint>Each occasion sets the functions offered, the services families see in the marketplace, and the planner tools they get.</Hint>
      {!manage && (
        <Card>
          <Text size={14} color={t.c.muted}>
            Only a super admin can add, edit or delete occasions. You can look but not change anything.
          </Text>
        </Card>
      )}
      {sorted.length === 0 ? (
        <EmptyBlock icon="calendar-outline" title="No occasions" message="Reset demo data to restore the built-in occasions." />
      ) : (
        <>
          <SectionTitle title={`Offered to families (${sorted.filter((o) => o.active).length})`} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {sorted.filter((o) => o.active).map(row)}
          </Card>
          {sorted.some((o) => !o.active) && (
            <>
              <SectionTitle title="Switched off" />
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {sorted.filter((o) => !o.active).map(row)}
              </Card>
            </>
          )}
        </>
      )}
    </ToolPage>
  );
}
