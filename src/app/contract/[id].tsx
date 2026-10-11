import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyBlock } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ContractView } from '@/components/work/ContractView';
import { colors, themed } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Read and e-sign one service agreement. Only the couple (or an editor collaborator) signs as customer. */
export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const { project, isCollaborator } = useCustomerWorkspace(account.id);
  const contract = useDb((s) => s.contracts.find((c) => c.id === id));
  const me = project?.collaborators.find((c) => c.accountId === account.id);
  const canSign = !!project && contract?.projectId === project.id && (!isCollaborator || me?.permission === 'editor' || me?.permission === 'owner');

  return (
    <View style={styles.root}>
      <ScreenHeader title="Contract" subtitle={contract?.number} />
      {!contract || contract.projectId !== project?.id ? (
        <EmptyBlock icon="document-lock-outline" title="Contract not found" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <ContractView contract={contract} party={canSign ? 'customer' : undefined} signerName={isCollaborator ? account.name : (project?.customerName ?? account.name)} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
}));
