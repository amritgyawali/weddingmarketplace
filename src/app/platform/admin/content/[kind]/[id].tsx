import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ImageSheet } from '@/components/admin/content/ImageSheet';
import { FieldEditor } from '@/components/admin/shared';
import { Card, EmptyBlock, KButton, KField, SectionTitle } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Photo } from '@/components/ui/Photo';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { photo } from '@/constants/images';
import { type CatalogueRecord, CONTENT_KIND_BY_ID, fieldLabel } from '@/data/contentCatalogue';
import { useContent } from '@/hooks/useContent';
import { entryKey, MAX_LIST, patchList } from '@/services/content';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ContentKind } from '@/types/content';
import { confirm } from '@/utils/confirm';

type Value = string | number | boolean | null | object;
/** Which photo the sheet is choosing: a single-photo field, or one slot of a gallery (`index` past the end adds). */
type Slot = { field: string; index?: number };

const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** A list of short texts, one per line (amenities, services, policies). */
function LinesField({ label, value, onChange }: { label: string; value: string[]; onChange: (next: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <KField
      label={label}
      hint="One per line"
      value={text}
      multiline
      onChangeText={(v) => {
        setText(v);
        onChange(v.split('\n').map((x) => x.trim()).filter(Boolean));
      }}
    />
  );
}

/**
 * One catalogue record (a venue, a vendor, a category…): change its photos
 * and every detail, hide it from lists and search, or restore the original.
 */
function ContentRecord() {
  const t = useRoleTheme();
  const { kind: rawKind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = rawKind as ContentKind;
  const def = CONTENT_KIND_BY_ID[kind];
  const content = useContent();
  const save = useDb((s) => s.saveContentEntry);
  const setHidden = useDb((s) => s.setContentHidden);
  const restore = useDb((s) => s.restoreContentEntry);
  const original = def?.items.find((r) => r.id === id);
  const current = def ? patchList(kind, def.items, content).find((r) => r.id === id) : undefined;
  const [draft, setDraft] = useState<CatalogueRecord | undefined>(() => (current ? (JSON.parse(JSON.stringify(current)) as CatalogueRecord) : undefined));
  const [dirty, setDirty] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  /** Remounts the fields after a restore, so they show the original values again. */
  const [version, setVersion] = useState(0);

  if (!def || !original || !draft) {
    return (
      <ToolPage title="Content">
        <EmptyBlock icon="document-outline" title="Record not found" message="It is no longer part of the app." action="Back" onAction={() => router.back()} />
      </ToolPage>
    );
  }

  const entry = content.entries[entryKey(kind, original.id)];
  const set = (field: string, value: unknown) => {
    setDraft({ ...draft, [field]: value });
    setDirty(true);
  };
  const keys = Object.keys(original).filter((k) => k !== 'id' && !def.imageFields.includes(k));
  const simple = keys.filter((k) => original[k] === null || typeof original[k] !== 'object');
  const lists = keys.filter((k) => isTextList(original[k]));
  const nested = keys.filter((k) => original[k] !== null && typeof original[k] === 'object' && !isTextList(original[k]));

  const onSave = () => {
    const fields = Object.fromEntries(Object.entries(draft).filter(([k]) => k !== 'id'));
    const err = save(kind, original.id, fields);
    if (err) return toastError(err);
    setDirty(false);
  };

  const pickPhoto = (ref: string) => {
    if (!slot) return null;
    const now = draft[slot.field];
    if (Array.isArray(now)) {
      const next = [...(now as string[])];
      next[slot.index ?? next.length] = ref;
      set(slot.field, next);
    } else set(slot.field, ref);
    return null;
  };

  const slotValue = slot ? (Array.isArray(draft[slot.field]) ? (draft[slot.field] as string[])[slot.index ?? -1] : (draft[slot.field] as string)) : undefined;

  return (
    <ToolPage title={String(draft[def.title] ?? original.id)} subtitle={`${def.label}${entry?.hidden ? ' · hidden' : entry ? ' · changed' : ''}`} right={<KButton label="Save" size="sm" icon="checkmark" disabled={!dirty} onPress={onSave} />}>
      <Hint>Change anything and save. The app shows it at once, everywhere this {def.one} appears.</Hint>

      <View>
        <SectionTitle title="Photos" />
        <Card style={{ gap: 14 }}>
          {def.imageFields.map((field) => {
            const value = draft[field];
            const many = Array.isArray(value);
            const refs = many ? (value as string[]) : [value as string];
            return (
              <View key={field} style={{ gap: 8 }}>
                <Text size={13} weight="medium" color={t.c.text} raw>
                  {fieldLabel(field)}
                  {many ? ` (${refs.length})` : ''}
                </Text>
                <View style={styles.photos}>
                  {refs.map((ref, index) => (
                    <View key={`${ref}${index}`}>
                      <Pressable onPress={() => setSlot({ field, index: many ? index : undefined })} accessibilityRole="button" accessibilityLabel="Change photo" style={({ pressed }) => pressed && { opacity: 0.8 }}>
                        <Photo source={photo(ref)} style={[styles.photo, { borderColor: t.c.border }]} contentFit="cover" />
                      </Pressable>
                      {many && refs.length > 1 && (
                        <Pressable
                          onPress={() => set(field, refs.filter((_, i) => i !== index))}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Remove photo"
                          style={[styles.remove, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
                          <Ionicons name="close" size={14} color={t.c.textStrong} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                  {many && refs.length < MAX_LIST && (
                    <Pressable onPress={() => setSlot({ field, index: refs.length })} accessibilityRole="button" accessibilityLabel="Add a photo" style={({ pressed }) => [styles.photo, styles.add, { borderColor: t.c.border, backgroundColor: t.c.surfaceAlt }, pressed && { opacity: 0.8 }]}>
                      <Ionicons name="add" size={24} color={t.c.primary} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          <Text size={12} color={t.c.muted}>
            Tap a photo to change it.
          </Text>
        </Card>
      </View>

      <View key={version} style={{ gap: 14 }}>
        {simple.length > 0 && (
          <View>
            <SectionTitle title="Details" />
            <Card style={{ gap: 12 }}>
              {simple.map((k) => (
                <FieldEditor key={k} name={fieldLabel(k)} value={draft[k] as Value} onChange={(v) => set(k, v)} />
              ))}
            </Card>
          </View>
        )}
        {lists.length > 0 && (
          <View>
            <SectionTitle title="Lists" />
            <Card style={{ gap: 12 }}>
              {lists.map((k) => (
                <LinesField key={k} label={fieldLabel(k)} value={draft[k] as string[]} onChange={(v) => set(k, v)} />
              ))}
            </Card>
          </View>
        )}
        {nested.length > 0 && (
          <View>
            <SectionTitle title="Advanced" />
            <Card style={{ gap: 14 }}>
              <Text size={12} color={t.c.muted}>
                Packages, spaces and reviews are edited as structured text. Keep the punctuation as it is and change only the words and numbers.
              </Text>
              {nested.map((k) => (
                <FieldEditor key={k} name={fieldLabel(k)} value={draft[k] as Value} onChange={(v) => set(k, v)} />
              ))}
            </Card>
          </View>
        )}
      </View>

      {def.hideable && (
        <Card style={styles.hideRow}>
          <View style={{ flex: 1, gap: 1 }}>
            <Text size={14} weight="medium" color={t.c.textStrong}>
              Show in the app
            </Text>
            <Text size={12} color={t.c.muted}>
              Off takes it out of lists and search. Bookings and shortlists that point at it still open.
            </Text>
          </View>
          <Toggle
            value={!entry?.hidden}
            accessibilityLabel="Show in the app"
            onValueChange={(v) => {
              const err = setHidden(kind, original.id, !v);
              if (err) toastError(err);
            }}
          />
        </Card>
      )}

      <KButton label="Save changes" icon="checkmark" disabled={!dirty} onPress={onSave} />
      {!!entry && (
        <KButton
          label="Restore the original"
          variant="ghost"
          icon="refresh-outline"
          onPress={() =>
            confirm('Restore the original?', `Every change made to this ${def.one} is removed, and it shows in the app again.`, 'Restore', () => {
              const err = restore(kind, original.id);
              if (err) return toastError(err);
              setDraft(JSON.parse(JSON.stringify(original)) as CatalogueRecord);
              setDirty(false);
              setVersion((n) => n + 1);
            })
          }
        />
      )}

      <ImageSheet visible={slot !== null} onClose={() => setSlot(null)} title="Choose a photo" value={slotValue} onPick={pickPhoto} />
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/content', ContentRecord);

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 92, height: 70, borderRadius: 8, borderWidth: 1 },
  add: { alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hideRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
