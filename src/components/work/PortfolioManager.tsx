import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { cloudMediaReady, uploadMedia } from '@/backend/media';
import { ChoiceChips, EmptyBlock, KButton, KField, StackHeader } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { EVENT_TYPES } from '@/data/events';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { PortfolioItem } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const TAGS = ['Ritual', 'Candid', 'Portrait', 'Pre-wedding', 'Reception', 'Decor', 'Drone', 'Team', 'Before/after', 'Venue'];

/** Portfolio manager for providers and crew: upload, caption, tag, feature and reorder. Media goes to Cloudinary in production. */
export function PortfolioManager() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const account = useAccount();
  const all = useDb((s) => s.portfolio);
  const add = useDb((s) => s.addPortfolioItem);
  const update = useDb((s) => s.updatePortfolioItem);
  const remove = useDb((s) => s.removePortfolioItem);
  const move = useDb((s) => s.movePortfolioItem);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [uploading, setUploading] = useState(0);
  const providerId = account.listingId ?? account.id;
  const items = all.filter((p) => p.providerId === providerId).sort((a, b) => a.order - b.order);
  const size = columns > 1 ? '23%' : '48%';

  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    if (!cloudMediaReady()) {
      // The demo keeps picked files on the device.
      res.assets.forEach((a) => add({ providerId, uri: a.uri, kind: a.type === 'video' ? 'video' : 'image', caption: '', tags: [], featured: false }));
      toast(`${res.assets.length} item(s) added`, 'cloud-upload');
      return;
    }
    // Supabase builds: each file goes to Cloudinary through a signed upload, one at a time.
    let done = 0;
    let lastError: string | null = null;
    setUploading(res.assets.length);
    for (const a of res.assets) {
      const up = await uploadMedia({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, fileSize: a.fileSize }, 'portfolio');
      setUploading((n) => n - 1);
      if (!up.ok) {
        lastError = up.error;
        continue;
      }
      add({ providerId, uri: up.value.url, publicId: up.value.publicId, kind: up.value.kind, caption: '', tags: [], featured: false });
      done++;
    }
    toast(lastError && !done ? lastError : `${done} of ${res.assets.length} uploaded${lastError ? ` · ${lastError}` : ''}`, lastError ? 'alert-circle' : 'cloud-upload');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Portfolio" subtitle={`${items.length} items · first item is your cover`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <KButton label={uploading ? `Uploading ${uploading}…` : 'Upload photos / videos'} icon="cloud-upload-outline" loading={uploading > 0} onPress={upload} />
        {!items.length && <EmptyBlock icon="images-outline" title="Show your best work" message="Couples book 3× more when a portfolio has 12+ photos across rituals, portraits and decor." />}
        <View style={styles.grid}>
          {items.map((p, i) => (
            <Pressable key={p.id} onPress={() => setEditing(p)} style={{ width: size }}>
              <Image source={p.uri ? { uri: p.uri } : photos[p.image!]} style={styles.image} contentFit="cover" />
              {p.featured && (
                <View style={[styles.badge, { backgroundColor: t.c.primary }]}>
                  <Ionicons name="star" size={11} color="#fff" />
                </View>
              )}
              {i === 0 && (
                <View style={[styles.cover, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text size={10} weight="bold" color="#fff">
                    Cover
                  </Text>
                </View>
              )}
              <Text size={12} color={t.c.text} numberOfLines={1}>
                {p.caption || 'Add caption'}
              </Text>
              <View style={styles.arrows}>
                <Pressable onPress={() => move(p.id, -1)} hitSlop={6} accessibilityLabel="Move earlier">
                  <Ionicons name="arrow-back-circle-outline" size={20} color={t.c.muted} />
                </Pressable>
                <Pressable onPress={() => move(p.id, 1)} hitSlop={6} accessibilityLabel="Move later">
                  <Ionicons name="arrow-forward-circle-outline" size={20} color={t.c.muted} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="Portfolio item">
        {editing && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
            <KField label="Caption" value={editing.caption} onChangeText={(caption) => setEditing({ ...editing, caption })} />
            <KField label="Venue / location" value={editing.venue ?? ''} onChangeText={(venue) => setEditing({ ...editing, venue })} />
            <ChoiceChips options={TAGS} selected={editing.tags} onToggle={(tag) => setEditing({ ...editing, tags: editing.tags.includes(tag) ? editing.tags.filter((x) => x !== tag) : [...editing.tags, tag] })} />
            <ChoiceChips options={EVENT_TYPES.slice(0, 8).map((e) => e.label)} selected={EVENT_TYPES.filter((e) => e.id === editing.eventType).map((e) => e.label)} onToggle={(label) => setEditing({ ...editing, eventType: EVENT_TYPES.find((e) => e.label === label)!.id })} />
            <ChoiceChips options={['Featured']} selected={editing.featured ? ['Featured'] : []} onToggle={() => setEditing({ ...editing, featured: !editing.featured })} />
            <KButton label="Save" onPress={() => { update(editing.id, editing); setEditing(null); }} />
            <KButton label="Remove" variant="ghost" size="sm" onPress={() => confirm('Remove from portfolio?', '', 'Remove', () => { remove(editing.id); setEditing(null); })} />
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 4 },
  badge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', top: 6, left: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  arrows: { flexDirection: 'row', justifyContent: 'space-between' },
});
