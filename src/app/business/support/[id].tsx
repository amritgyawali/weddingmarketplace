import { useLocalSearchParams } from 'expo-router';

import { SupportThread } from '@/components/support/SupportThread';

export default function SupportRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SupportThread id={String(id ?? '')} />;
}
