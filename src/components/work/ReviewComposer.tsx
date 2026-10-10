import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Photo } from '@/components/ui/Photo';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { DatePopup } from '@/components/ui/DatePopup';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { StarInput } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { findService } from '@/data/services';
import { useDraft } from '@/store/drafts';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatLongDate, formatShortDate, fromISODate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export const FREELANCER_CRITERIA = ['Skill', 'Punctuality', 'Behaviour', 'Reliability'];

/** Allowed length of a review's text. */
export const REVIEW_MIN_CHARS = 10;
export const REVIEW_MAX_CHARS = 1000;
const MAX_PHOTOS = 6;

interface ReviewDraft {
  criteria: Record<string, number>;
  text: string;
  photos: string[];
  eventDate: string | null;
}

/**
 * Category-specific review: overall stars plus the criteria that matter for
 * this service (photo quality, food, parking…). Criteria feed matching.
 * Optional extras: up to six photos (each removable) and the date of the
 * event being reviewed, picked from the couple's own event dates. With a
 * `draftKey` the half-written review is kept on the device until it is sent.
 */
export function ReviewComposer({
  serviceId,
  freelancer,
  targetName,
  eventDates = [],
  draftKey,
  onSubmit,
}: {
  serviceId?: string;
  freelancer?: boolean;
  targetName: string;
  /** The couple's events with a date, offered as quick choices ("Wedding · 14 Feb"). */
  eventDates?: { label: string; date: string }[];
  draftKey?: string;
  onSubmit: (r: { overall: number; criteria: Record<string, number>; text: string; photoUris: string[]; eventDate?: string }) => void;
}) {
  const t = useRoleTheme();
  const criteriaNames = freelancer ? FREELANCER_CRITERIA : (findService(serviceId ?? '')?.reviewCriteria ?? ['Quality', 'Communication', 'Punctuality', 'Value for money']);
  const [draft, setDraft, clearDraft] = useDraft<ReviewDraft>(draftKey ?? null, {
    criteria: Object.fromEntries(criteriaNames.map((c) => [c, 0])),
    text: '',
    photos: [],
    eventDate: null,
  });
  const { criteria, text, photos, eventDate } = draft;
  const [tried, setTried] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const rated = criteriaNames.filter((c) => (criteria[c] ?? 0) > 0);
  const unrated = criteriaNames.filter((c) => !(criteria[c] > 0));
  const overall = rated.length ? Math.round((rated.reduce((a, c) => a + criteria[c], 0) / rated.length) * 10) / 10 : 0;
  const textLength = text.trim().length;

  const textError = !tried ? null : textLength === 0 ? 'Write a few words about your experience' : textLength < REVIEW_MIN_CHARS ? `Write at least ${REVIEW_MIN_CHARS} characters (${REVIEW_MIN_CHARS - textLength} more)` : null;
  const ratingError = tried && unrated.length ? `Rate ${unrated.join(', ')}` : null;

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      toast(`You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`, 'warning-outline');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length });
    if (!res.canceled) setDraft((d) => ({ ...d, photos: [...d.photos, ...res.assets.map((a) => a.uri).filter((u) => !d.photos.includes(u))].slice(0, MAX_PHOTOS) }));
  };

  const removePhoto = (uri: string) => setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p !== uri) }));

  const submit = () => {
    setTried(true);
    if (unrated.length || textLength < REVIEW_MIN_CHARS) {
      triggerHaptic('medium');
      toast(unrated.length ? `Rate ${unrated.join(', ')} to submit` : textLength === 0 ? 'Write your review to submit' : `Your review needs at least ${REVIEW_MIN_CHARS} characters`, 'warning-outline');
      return;
    }
    onSubmit({ overall, criteria, text: text.trim(), photoUris: photos, eventDate: eventDate ?? undefined });
    clearDraft();
  };

  const choices = eventDates.map((e) => ({ ...e, chip: `${e.label} · ${formatShortDate(e.date)}` }));
  const chosen = choices.find((c) => c.date === eventDate);
  // "Another date" can go back two years from the earliest event.
  const earliest = eventDates.reduce((m, e) => (e.date < m ? e.date : m), new Date().toISOString().slice(0, 10));
  const minDate = fromISODate(earliest);
  minDate.setFullYear(minDate.getFullYear() - 2);

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
          <Text size={15} weight="semibold" color={tried && !(criteria[c] > 0) ? t.c.danger : t.c.textStrong} style={{ flex: 1 }}>
            {c}
            {tried && !(criteria[c] > 0) ? <Text size={15} color={t.c.danger}> *</Text> : null}
          </Text>
          <StarInput value={criteria[c] ?? 0} onChange={(v) => setDraft((d) => ({ ...d, criteria: { ...d.criteria, [c]: v } }))} size={26} />
        </View>
      ))}
      {ratingError && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={t.c.danger} />
          <Text size={12} color={t.c.danger} style={{ flexShrink: 1 }}>
            {ratingError}
          </Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text size={13} weight="medium" color={t.c.text}>
          Date of the event <Text size={13} color={t.c.muted}>(optional)</Text>
        </Text>
        {choices.length > 0 && <ChoiceChips options={choices.map((c) => c.chip)} selected={chosen ? [chosen.chip] : []} onToggle={(chip) => setDraft((d) => ({ ...d, eventDate: choices.find((c) => c.chip === chip && c.date !== d.eventDate)?.date ?? null }))} />}
        <View style={styles.dateRow}>
          <KButton label={eventDate && !chosen ? formatLongDate(eventDate) : choices.length ? 'Another date' : 'Pick the date'} icon="calendar-outline" variant="secondary" size="sm" onPress={() => setDateOpen(true)} />
          {eventDate && (
            <Pressable onPress={() => setDraft((d) => ({ ...d, eventDate: null }))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear the event date">
              <Text size={13} weight="medium" color={t.c.primary}>
                Clear date
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <KField
        label="Your review"
        required
        value={text}
        onChangeText={(v) => setDraft((d) => ({ ...d, text: v }))}
        multiline
        minLength={REVIEW_MIN_CHARS}
        maxLength={REVIEW_MAX_CHARS}
        error={textError}
        placeholder="What stood out? Would you recommend them to other couples?"
      />

      <View style={{ gap: 8 }}>
        <Text size={13} weight="medium" color={t.c.text}>
          Photos <Text size={13} color={t.c.muted}>(optional, up to {MAX_PHOTOS})</Text>
        </Text>
        {photos.length > 0 && (
          <View style={styles.photos}>
            {photos.map((uri, i) => (
              <View key={uri}>
                <Pressable onPress={() => setViewing(i)} accessibilityRole="button" accessibilityLabel={`View photo ${i + 1}`}>
                  <Photo source={{ uri }} style={styles.photo} contentFit="cover" />
                </Pressable>
                <Pressable onPress={() => removePhoto(uri)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} style={({ pressed }) => [styles.remove, { backgroundColor: t.c.textStrong }, pressed && { opacity: 0.7 }]}>
                  <Ionicons name="close" size={14} color={t.c.onPrimary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <KButton label={photos.length ? 'Add more photos' : 'Add photos'} icon="images-outline" variant="ghost" size="sm" onPress={addPhoto} />
      </View>
      <KButton label="Submit review" onPress={submit} />
      <Text size={12} color={t.c.muted} align="center">
        Rate every category and write at least {REVIEW_MIN_CHARS} characters. Your draft is saved on this phone until you submit.
      </Text>

      <DatePopup visible={dateOpen} title="When was the event?" value={eventDate} minDate={minDate} onChange={(d) => setDraft((x) => ({ ...x, eventDate: d }))} onClose={() => setDateOpen(false)} />
      <PhotoViewer sources={photos.map((uri) => ({ uri }))} index={viewing} onClose={() => setViewing(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  criteria: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 },
  photo: { width: 72, height: 72, borderRadius: 10 },
  remove: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
