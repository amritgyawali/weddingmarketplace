import { useLocalSearchParams } from 'expo-router';

import { staffScreen } from '@/components/persona/StaffGate';
import { SupportThread } from '@/components/support/SupportThread';

function DeskRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SupportThread id={String(id ?? '')} desk />;
}

export default staffScreen('/platform/support', DeskRequest);
