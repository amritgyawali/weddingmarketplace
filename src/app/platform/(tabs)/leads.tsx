import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KField, RoleHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { STATUS_LABEL } from '@/components/work/Pipeline';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { useLayout } from '@/hooks/useLayout';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectStatus } from '@/types/platform';
import { formatMoneyCompact, formatShortDate, timeAgo } from '@/utils/format';

const COLUMNS: { title: string; statuses: ProjectStatus[] }[] = [
  { title: 'New', statuses: ['NEW'] },
  { title: 'Reviewing', statuses: ['REVIEWING', 'NEEDS_CLARIFICATION'] },
  { title: 'Matching', statuses: ['MATCHING_PROVIDERS'] },
  { title: 'Quoting', statuses: ['QUOTE_PREPARED', 'QUOTE_SENT'] },
  { title: 'Negotiating', statuses: ['CUSTOMER_NEGOTIATING', 'QUOTE_REJECTED'] },
  { title: 'Won', statuses: ['CONFIRMED'] },
];

function LeadCard({ project }: { project: Project }) {
  const t = useRoleTheme();
  const risk = projectRisks(project).some((r) => r.severity === 'high');
  return (
    <Card onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: project.id } })} style={{ gap: 6, padding: 12 }}>
      <View style={styles.rowBetween}>
        <Text size={11} weight="bold" color={t.c.primary}>
          {project.code} · {EVENT_TYPE_BY_ID[project.eventType]?.label.toUpperCase()}
        </Text>
        {risk && <Ionicons name="warning" size={14} color={t.c.danger} />}
      </View>
      <Text size={15} weight="bold" color={t.c.textStrong} numberOfLines={1}>
        {project.title}
      </Text>
      <Text size={12} color={t.c.muted}>
        {project.city} · {formatShortDate(project.weddingDate)} · {project.guests} guests
      </Text>
      <Text size={12} color={t.c.text}>
        {project.requirements.filter((r) => r.status !== 'CANCELLED').length} services · {project.budget ? formatMoneyCompact(project.budget) : 'budget TBC'}
      </Text>
      <View style={styles.rowBetween}>
        <Text size={11} color={project.coordinatorName ? t.c.muted : t.c.danger}>
          {project.coordinatorName ?? 'Unassigned'}
        </Text>
        <Text size={11} color={t.c.subtle}>
          {STATUS_LABEL[project.status]} · {timeAgo(project.statusHistory[project.statusHistory.length - 1]?.at ?? project.createdAt)}
        </Text>
      </View>
    </Card>
  );
}

/** Lead pipeline: every requirement from "New" to "Won", as a kanban board. */
export default function LeadsPipeline() {
  const t = useRoleTheme();
  const account = useAccount();
  const { wide } = useLayout();
  const projects = useDb((s) => s.projects);
  const [scope, setScope] = useState<'All' | 'Mine' | 'Unassigned'>('All');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = projects
    .filter((p) => p.managedBy === 'platform')
    .filter((p) => (scope === 'Mine' ? p.coordinatorId === account.id : scope === 'Unassigned' ? !p.coordinatorId : true))
    .filter((p) => !q || `${p.title} ${p.code} ${p.city} ${p.customerName}`.toLowerCase().includes(q));
  const lost = list.filter((p) => p.status === 'CANCELLED').length;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="LEAD PIPELINE" title="Leads" subtitle={`${list.filter((p) => COLUMNS.slice(0, 5).some((c) => c.statuses.includes(p.status))).length} open · ${lost} lost`} />
      <View style={{ padding: 14, gap: 10 }}>
        <KField placeholder="Search couple, code or city" value={query} onChangeText={setQuery} />
        <ChoiceChips options={['All', 'Mine', 'Unassigned']} selected={[scope]} onToggle={(v) => setScope(v as typeof scope)} />
      </View>
      <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.board, wide && { flexDirection: 'row', flexWrap: 'nowrap' }]}>
        {COLUMNS.map((col) => {
          const items = list.filter((p) => col.statuses.includes(p.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return (
            <View key={col.title} style={[styles.column, { backgroundColor: t.c.surfaceAlt }, wide && { flex: 1, width: undefined }]}>
              <View style={styles.rowBetween}>
                <Text size={13} weight="bold" color={t.c.textStrong}>
                  {col.title}
                </Text>
                <Text size={12} weight="bold" color={t.c.muted}>
                  {items.length}
                </Text>
              </View>
              <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                {items.map((p) => (
                  <LeadCard key={p.id} project={p} />
                ))}
                {!items.length && (
                  <Text size={12} color={t.c.subtle} align="center" style={{ paddingVertical: 16 }}>
                    Empty
                  </Text>
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  board: { paddingHorizontal: 14, gap: 10, paddingBottom: 20 },
  column: { width: 270, borderRadius: 14, padding: 10, gap: 10, maxHeight: 640 },
});
