import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyBlock } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import type { Project } from '@/types/platform';

/**
 * Shell for the couple's planning tools. Every tool works on the wedding
 * project (own or joined as a collaborator); without one we point to the planner.
 */
export function ToolScreen({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: (project: Project) => string;
  right?: (project: Project) => ReactNode;
  children: (project: Project, ctx: { readOnly: boolean; isCollaborator: boolean }) => ReactNode;
}) {
  const account = useAccount();
  const { project, isCollaborator } = useCustomerWorkspace(account.id);
  const me = project?.collaborators.find((c) => c.accountId === account.id);
  const readOnly = isCollaborator && me?.permission === 'viewer';

  if (!project) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={title} />
        <EmptyBlock
          icon="document-text-outline"
          title="Start your wedding plan first"
          message="Tell us your dates, guest count and the services you need. Every planning tool then works from that one plan."
          action="Start planning"
          onAction={() => router.push('/plan')}
        />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ScreenHeader title={title} subtitle={subtitle?.(project)} right={right?.(project)} />
      {children(project, { readOnly, isCollaborator })}
    </View>
  );
}

export const toolStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 0, paddingVertical: 10, paddingHorizontal: 12 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
});
