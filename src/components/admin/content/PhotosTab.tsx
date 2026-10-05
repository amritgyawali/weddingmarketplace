import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyBlock, KButton, KField, StatusPill } from '@/components/kit';
import { Hint } from '@/components/toolkit/core';
import { Photo } from '@/components/ui/Photo';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { photo, PHOTO_KEYS, type PhotoKey } from '@/constants/images';
import { CONTENT_CATALOGUE, fieldLabel } from '@/data/contentCatalogue';
import { useContent } from '@/hooks/useContent';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

import { ImageSheet } from './ImageSheet';

/** How many catalogue records show each bundled photo, counted once. */
const USES: Partial<Record<PhotoKey, number>> = {};
for (const def of CONTENT_CATALOGUE) {
  for (const record of def.items) {
    const refs = new Set(def.imageFields.flatMap((f) => record[f] as string | string[] | undefined).filter(Boolean));
    for (const ref of refs) if (PHOTO_KEYS.includes(ref as PhotoKey)) USES[ref as PhotoKey] = (USES[ref as PhotoKey] ?? 0) + 1;
  }
}

/**
 * Every photo the app ships with. Replacing one changes it on every screen
 * that shows it: listings, categories, the welcome slides, ideas and so on.
 */
export function PhotosTab() {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const images = useContent().images;
  const setImage = useDb((s) => s.setContentImage);
  const reset = useDb((s) => s.resetContent);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PhotoKey | null>(null);

  const q = query.trim().toLowerCase();
  const keys = PHOTO_KEYS.filter((k) => !q || fieldLabel(k).toLowerCase().includes(q));
  const changed = Object.keys(images).length;

  return (
    <>
      <Hint>Tap a photo to replace it. The new photo shows everywhere the old one did, at once. To change the photos of one venue or vendor only, use Listings.</Hint>
      <KField placeholder="Find a photo" value={query} onChangeText={setQuery} autoCorrect={false} />
      {keys.length === 0 ? (
        <EmptyBlock icon="image-outline" title="Nothing here" message="Try another word." />
      ) : (
        <View style={styles.grid}>
          {keys.map((key) => (
            <Pressable
              key={key}
              onPress={() => setEditing(key)}
              accessibilityRole="button"
              accessibilityLabel={`Replace ${fieldLabel(key)}`}
              style={({ pressed }) => [styles.tile, { width: wide ? '23.8%' : '48.5%', borderColor: t.c.border, backgroundColor: t.c.surface }, pressed && { opacity: 0.8 }]}>
              <Photo source={photo(key)} style={styles.image} contentFit="cover" />
              <View style={styles.caption}>
                <Text size={13} weight="medium" color={t.c.textStrong} numberOfLines={1} raw>
                  {fieldLabel(key)}
                </Text>
                <View style={styles.meta}>
                  <Text size={12} color={t.c.muted} numberOfLines={1} style={{ flex: 1 }}>
                    {USES[key] ? `${USES[key]} listings` : 'Screens'}
                  </Text>
                  {!!images[key] && <StatusPill status="new" label="Changed" />}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {changed > 0 && (
        <KButton
          label="Restore all original photos"
          variant="danger"
          icon="refresh-outline"
          onPress={() =>
            confirm('Restore all original photos?', 'Every photo replaced here goes back to the one the app shipped with.', 'Restore', () => {
              const err = reset('images');
              if (err) toastError(err);
            })
          }
        />
      )}
      <ImageSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? fieldLabel(editing) : 'Photo'}
        value={editing ?? undefined}
        bundled={false}
        onPick={(ref) => (editing ? setImage(editing, ref) : null)}
        onRestore={
          editing && images[editing]
            ? () => {
                const err = setImage(editing, null);
                if (err) toastError(err);
              }
            : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.4 },
  caption: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
});
