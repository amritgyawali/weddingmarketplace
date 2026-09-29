import { router } from 'expo-router';

import { VenueListScreen } from '@/components/listing/VenueListScreen';
import { ALL_CITIES } from '@/data/cities';
import { useAppStore } from '@/store/useAppStore';

export default function VenuesTab() {
  const city = useAppStore((s) => s.city);
  return (
    <VenueListScreen
      title={`${city === ALL_CITIES ? 'All Cities' : city} • Venues`}
      onBack={() => router.navigate('/')}
    />
  );
}
