import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { contentImagesShared, keepContentImage } from '@/backend/contentMedia';
import { KButton, KField } from '@/components/kit';
import { Hint } from '@/components/toolkit/core';
import { Photo } from '@/components/ui/Photo';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { usesSupabase } from '@/constants/env';
import { photo, PHOTO_KEYS, type PhotoRef } from '@/constants/images';
import { imageAddress } from '@/services/content';
import { useRoleTheme } from '@/theme/RoleTheme';

/**
 * Choose a photo for the app: from this device, by pasting a link, or (when
 * `bundled`) one of the photos the app ships with. `onPick` gets a photo key
 * or an address and returns an error to show, or null when it was saved.
 */
export function ImageSheet({
  visible,
  onClose,
  title,
  value,
  bundled = true,
  onPick,
  onRestore,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The photo shown now. */
  value?: PhotoRef;
  bundled?: boolean;
  onPick: (ref: string) => string | null;
  /** Shown as "Restore original" when the photo was changed. */
  onRestore?: () => void;
}) {
  const t = useRoleTheme();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = (ref: string) => {
    const err = onPick(ref);
    if (err) return toastError(err);
    setLink('');
    onClose();
  };

  const fromDevice = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBusy(true);
    const kept = await keepContentImage({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, fileSize: a.fileSize });
    setBusy(false);
    if (!kept.ok) return toastError(kept.error);
    choose(kept.value);
  };

  const useLink = () => {
    const address = imageAddress(link);
    if (!address) return toastError('Paste a link to a photo that starts with https://');
    choose(address);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        {!!value && <Photo source={photo(value)} style={[styles.preview, { borderColor: t.c.border }]} contentFit="cover" />}
        <KButton label="Choose from this device" icon="image-outline" loading={busy} onPress={fromDevice} />
        {usesSupabase() && !contentImagesShared() && <Hint>Photo uploads aren’t set up on this build, so a photo picked here shows on this device only. Paste a link for a photo everyone should see.</Hint>}
        <View style={styles.linkRow}>
          <View style={{ flex: 1 }}>
            <KField label="Or paste a link to a photo" value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </View>
          <KButton label="Use link" variant="secondary" disabled={!link.trim()} onPress={useLink} />
        </View>
        {bundled && (
          <View style={{ gap: 8 }}>
            <Text size={13} weight="medium" color={t.c.text}>
              Or use one of the app’s photos
            </Text>
            <View style={styles.grid}>
              {PHOTO_KEYS.map((key) => (
                <Pressable key={key} onPress={() => choose(key)} accessibilityRole="button" accessibilityLabel={key} style={[styles.tile, { borderColor: value === key ? t.c.primary : t.c.border }]}>
                  <Photo source={photo(key)} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {!!onRestore && (
          <KButton
            label="Restore original"
            variant="ghost"
            icon="refresh-outline"
            onPress={() => {
              onRestore();
              onClose();
            }}
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  preview: { width: '100%', height: 160, borderRadius: 10, borderWidth: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: 58, height: 58, borderRadius: 6, borderWidth: 2, overflow: 'hidden' },
});
