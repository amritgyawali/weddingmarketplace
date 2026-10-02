import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, EmptyBlock, StatusPill } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Text } from '@/components/ui/Text';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project } from '@/types/platform';
import { formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

function Contracts({ project }: { project: Project }) {
  const t = useRoleTheme();
  const all = useDb((s) => s.contracts);
  const contracts = all.filter((c) => c.projectId === project.id && c.status !== 'draft').sort((a, b) => Number(a.status === 'signed') - Number(b.status === 'signed') || b.createdAt.localeCompare(a.createdAt));
  const toSign = contracts.filter((c) => c.status !== 'signed' && c.status !== 'void' && !c.signatures.some((s) => s.party === 'customer'));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {toSign.length > 0 && (
        <Card style={[toolStyles.row, { borderColor: t.c.warning }]}>
          <Ionicons name="create-outline" size={22} color={t.c.warning} />
          <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
            {toSign.length} contract{toSign.length > 1 ? 's' : ''} waiting for your signature
          </Text>
        </Card>
      )}
      {contracts.length === 0 ? (
        <EmptyBlock icon="document-lock-outline" title="No contracts yet" message="Every confirmed booking gets a three-party agreement between you, the provider and Vivah." />
      ) : (
        contracts.map((c) => (
          <Card key={c.id} onPress={() => router.push({ pathname: '/contract/[id]', params: { id: c.id } })} style={{ gap: 6 }}>
            <View style={toolStyles.between}>
              <Text size={12} weight="bold" color={t.c.muted}>
                {c.number} · v{c.version}
              </Text>
              <StatusPill status={c.status} />
            </View>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              {c.title}
            </Text>
            <Text size={12} color={t.c.muted}>
              {c.parties.provider} · issued {formatShortDate(c.createdAt)} · {c.signatures.length}/3 signed
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/** Every service agreement for the wedding, with signing status. */
export default function ContractsScreen() {
  return (
    <ToolScreen title="Contracts" subtitle={(p) => p.title}>
      {(project) => <Contracts project={project} />}
    </ToolScreen>
  );
}
