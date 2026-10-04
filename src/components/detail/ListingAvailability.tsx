import { useState } from 'react';
import { View } from 'react-native';

import { Calendar } from '@/components/ui/Calendar';
import { Text } from '@/components/ui/Text';
import { useListingAvailability } from '@/hooks/useListingAvailability';
import { useAppStore } from '@/store/useAppStore';
import { useAccount } from '@/store/useSession';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';

/** A read-only public calendar using the same reservations and capacity as the business calendar. */
export function ListingAvailability({ listingId }: { listingId: string }) {
  const account = useAccount();
  const { project } = useCustomerWorkspace(account.id);
  const savedDate = useAppStore((s) => s.weddingDate);
  const [date, setDate] = useState<string | null>(project?.events.find((e) => e.type === project.eventType)?.date ?? savedDate);
  const availability = useListingAvailability(listingId);
  const day = date ? availability.onDate(date) : null;
  return (
    <View style={{ gap: 10 }}>
      <Text>{availability.published ? 'Availability from the business calendar' : 'Calendar not published yet. Send an enquiry to confirm your date.'}</Text>
      <Calendar value={date} onChange={setDate} dateStatus={availability.published ? (d) => availability.onDate(d).status : undefined} />
      {availability.published && day && <Text>{day.remaining ? `${day.remaining} event slots remaining` : 'Unavailable on this date'}</Text>}
    </View>
  );
}
