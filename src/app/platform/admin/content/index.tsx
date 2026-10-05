import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BrandTab } from '@/components/admin/content/BrandTab';
import { HomeTab } from '@/components/admin/content/HomeTab';
import { ListingsTab } from '@/components/admin/content/ListingsTab';
import { PhotosTab } from '@/components/admin/content/PhotosTab';
import { Card, KButton, ListRow, Segmented } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, StatRow, ToolPage } from '@/components/toolkit/core';
import { toastError } from '@/components/ui/Toast';
import { usesSupabase } from '@/constants/env';
import { useContent } from '@/hooks/useContent';
import { contentChangeCount, contentStats } from '@/services/content';
import { useDb } from '@/store/useDb';
import { confirm } from '@/utils/confirm';

type Tab = 'photos' | 'listings' | 'home' | 'brand';
const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: 'Photos' },
  { id: 'listings', label: 'Listings' },
  { id: 'home', label: 'Home' },
  { id: 'brand', label: 'App details' },
];

/**
 * Content studio: change any photo, any listing's details, the sections of
 * the couple's home and the brand details, without a release. Every change
 * shows in the app at once; "restore" always brings the original back.
 */
function ContentStudio() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const content = useContent();
  const overrides = useDb((s) => s.textOverrides);
  const reset = useDb((s) => s.resetContent);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'photos');
  const stats = contentStats(content);
  const total = contentChangeCount(content);

  return (
    <ToolPage title="Content studio" subtitle={total ? `${total} changes live` : 'Nothing changed yet'}>
      <Hint>
        {usesSupabase()
          ? 'Changes save as you make them and reach every phone within a minute, sooner when the app is reopened.'
          : 'Changes save as you make them and show in the app at once. This is the demo, so they stay on this device.'}
      </Hint>
      <StatRow
        items={[
          { label: 'Photos replaced', value: String(stats.images) },
          { label: 'Listings edited', value: String(stats.edited + stats.hidden) },
          { label: 'Home banners', value: String(stats.banners) },
        ]}
      />
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'photos' && <PhotosTab />}
      {tab === 'listings' && <ListingsTab />}
      {tab === 'home' && <HomeTab />}
      {tab === 'brand' && <BrandTab />}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <ListRow icon="language-outline" title="Text and translations" subtitle={`${Object.keys(overrides).length} changed · rewrite any wording in English or Nepali`} onPress={() => router.push('/platform/admin/texts')} />
        <ListRow icon="megaphone-outline" title="Announcements" subtitle="Pin a notice on any role’s home" onPress={() => router.push('/platform/admin/announcements')} />
      </Card>
      {total > 0 && (
        <KButton
          label="Restore everything to the original"
          variant="danger"
          icon="refresh-outline"
          onPress={() =>
            confirm('Restore all original content?', 'Every photo, listing, home and detail change made here is removed. Text changes and feature switches stay.', 'Restore', () => {
              const err = reset('all');
              if (err) toastError(err);
            })
          }
        />
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/content', ContentStudio);
