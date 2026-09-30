import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { KButton, KField } from '@/components/kit';
import { StarInput } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { findService } from '@/data/services';
import { useRoleTheme } from '@/theme/RoleTheme';

export const FREELANCER_CRITERIA = ['Skill', 'Punctuality', 'Behaviour', 'Reliability'];

/**
 * Category-specific review: overall stars plus the criteria that matter for
 * this service (photo quality, food, parking…). Criteria feed matching.
 */
export function ReviewComposer({
  serviceId,
  freelancer,
  targetName,
  onSubmit,
}: {
  serviceId?: string;
  freelancer?: boolean;
  targetName: string;
  onSubmit: (r: { overall: number; criteria: Record<string, number>; text: string; photoUris: string[] }) => void;
}) {
  const t = useRoleTheme();
  const criteriaNames = freelancer ? FREELANCER_CRITERIA : (findService(serviceId ?? '')?.reviewCriteria ?? ['Quality', 'Communication', 'Punctuality', 'Value for money']);
  const [criteria, setCriteria] = useState<Record<string, number>>(Object.fromEntries(criteriaNames.map((c) => [c, 0])));
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const rated = Object.values(criteria).filter((v) => v > 0);
  const overall = rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : 0;

  const addPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 4 });
    if (!res.canceled) setPhotos((p) => [...p, ...res.assets.map((a) => a.uri)].slice(0, 6));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text size={13} color={t.c.muted}>
          How was {targetName}?
        </Text>
        <Text size={40} weight="bold" color={overall ? t.c.primary : t.c.subtle}>
          {overall ? overall.toFixed(1) : '–'}
        </Text>
      </View>
      {criteriaNames.map((c) => (
        <View key={c} style={styles.criteria}>
          <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
            {c}
          </Text>
          <StarInput value={criteria[c]} onChange={(v) => setCriteria((s) => ({ ...s, [c]: v }))} size={26} />
        </View>
      ))}
      <KField label="Your review" value={text} onChangeText={setText} multiline placeholder="What stood out? Would you recommend them to other couples?" />
      <View style={{ gap: 8 }}>
        <View style={styles.photos}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photo} contentFit="cover" />
          ))}
        </View>
        <KButton label="Add photos" icon="images-outline" variant="ghost" size="sm" onPress={addPhoto} />
      </View>
      <KButton label="Submit review" disabled={rated.length < criteriaNames.length || text.trim().length < 10} onPress={() => onSubmit({ overall, criteria, text: text.trim(), photoUris: photos })} />
      {rated.length < criteriaNames.length && (
        <Text size={12} color={t.c.muted} align="center">
          Rate every category to submit.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  criteria: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 72, height: 72, borderRadius: 10 },
});
