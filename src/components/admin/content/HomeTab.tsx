import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, FilterChip, KButton, KField } from '@/components/kit';
import { Hint } from '@/components/toolkit/core';
import { Photo } from '@/components/ui/Photo';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { photo } from '@/constants/images';
import { featureOn } from '@/data/features';
import { BANNER_LINKS, HOME_SECTION_BY_ID, HOME_SECTION_IDS } from '@/data/homeSections';
import { useContent } from '@/hooks/useContent';
import { bannerSectionId, MAX_BANNERS, orderSections } from '@/services/content';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ContentBanner } from '@/types/content';
import { confirm } from '@/utils/confirm';

import { ImageSheet } from './ImageSheet';

type Draft = { id?: string; title: string; body: string; image: string; actionLabel: string; href: string };
const BLANK: Draft = { title: '', body: '', image: '', actionLabel: '', href: '' };

/**
 * The couple's home, top to bottom: move sections up and down, switch them
 * on and off, rename their headings, and add banners of your own.
 */
export function HomeTab() {
  const t = useRoleTheme();
  const content = useContent();
  const flags = useDb((s) => s.featureFlags);
  const setFeature = useDb((s) => s.setFeature);
  const setOrder = useDb((s) => s.setHomeOrder);
  const setTitle = useDb((s) => s.setHomeTitle);
  const saveBanner = useDb((s) => s.saveBanner);
  const removeBanner = useDb((s) => s.removeBanner);
  const reset = useDb((s) => s.resetContent);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [heading, setHeading] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);

  const order = orderSections(HOME_SECTION_IDS, content.home.order, content.banners);
  const bannerOf = (sectionId: string) => content.banners.find((b) => bannerSectionId(b.id) === sectionId);
  const say = (err: string | null) => {
    if (err) toastError(err);
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[index], next[to]] = [next[to], next[index]];
    say(setOrder(next));
  };

  const editBanner = (b?: ContentBanner) => setDraft(b ? { id: b.id, title: b.title, body: b.body ?? '', image: b.image ?? '', actionLabel: b.actionLabel ?? '', href: b.href ?? '' } : BLANK);

  const save = () => {
    if (!draft) return;
    const r = saveBanner(draft);
    if (r.error) return toastError(r.error);
    setDraft(null);
  };

  const arrow = (index: number, by: -1 | 1) => {
    const off = by < 0 ? index === 0 : index === order.length - 1;
    return (
      <Pressable onPress={() => move(index, by)} disabled={off} hitSlop={6} accessibilityRole="button" accessibilityLabel={by < 0 ? 'Move up' : 'Move down'} style={({ pressed }) => [styles.arrow, { borderColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
        <Ionicons name={by < 0 ? 'chevron-up' : 'chevron-down'} size={18} color={off ? t.c.border : t.c.textStrong} />
      </Pressable>
    );
  };

  return (
    <>
      <Hint>This is the couple’s home, top to bottom. The search box and announcements stay at the top. Some sections show for weddings only, or only when the city has something to show.</Hint>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {order.map((id, i) => {
          const banner = bannerOf(id);
          const def = HOME_SECTION_BY_ID[id];
          const on = banner ? banner.active : def?.feature ? featureOn(flags, def.feature) : true;
          const custom = content.home.titles[id];
          const title = banner ? banner.title : (def?.label ?? id);
          const sub = banner ? 'Your banner' : [custom ? `Heading: ${custom}` : def?.hint, def?.weddingOnly ? 'weddings only' : ''].filter(Boolean).join(' · ');
          return (
            <View key={id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
              <View style={styles.arrows}>
                {arrow(i, -1)}
                {arrow(i, 1)}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text size={14} weight="medium" color={on ? t.c.textStrong : t.c.muted} numberOfLines={1} raw={!!banner}>
                  {title}
                </Text>
                <Text size={12} color={t.c.muted} numberOfLines={2} raw={!!custom}>
                  {sub}
                </Text>
                {(banner || def?.title) && (
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    onPress={() => {
                      if (banner) return editBanner(banner);
                      setRenaming(id);
                      setHeading(custom ?? '');
                    }}>
                    <Text size={13} weight="medium" color={t.c.primary}>
                      {banner ? 'Edit banner' : 'Rename heading'}
                    </Text>
                  </Pressable>
                )}
              </View>
              {(banner || def?.feature) && (
                <Toggle
                  value={on}
                  accessibilityLabel={title}
                  onValueChange={(v) => {
                    if (banner) {
                      const r = saveBanner({ ...banner, active: v });
                      if (r.error) toastError(r.error);
                    } else if (def?.feature) say(setFeature(def.feature, v));
                  }}
                />
              )}
            </View>
          );
        })}
      </Card>
      <KButton label="Add a banner" icon="add" variant="secondary" disabled={content.banners.length >= MAX_BANNERS} onPress={() => editBanner()} />
      {(content.home.order.length > 0 || Object.keys(content.home.titles).length > 0) && (
        <KButton label="Restore the original order and headings" variant="ghost" icon="refresh-outline" onPress={() => confirm('Restore the original home?', 'Sections go back to their built-in order and headings. Your banners stay.', 'Restore', () => say(reset('home')))} />
      )}

      <Sheet visible={renaming !== null} onClose={() => setRenaming(null)} title="Rename heading">
        <View style={styles.sheet}>
          <KField label="Heading" value={heading} onChangeText={setHeading} placeholder={renaming ? HOME_SECTION_BY_ID[renaming]?.title : undefined} hint="Leave empty for the original. Write {city} where the chosen city should appear." maxLength={60} />
          <KButton
            label="Save"
            icon="checkmark"
            onPress={() => {
              if (!renaming) return;
              const err = setTitle(renaming, heading);
              if (err) return toastError(err);
              setRenaming(null);
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={draft !== null && !picking} onClose={() => setDraft(null)} title={draft?.id ? 'Edit banner' : 'New banner'}>
        {draft && (
          <View style={styles.sheet}>
            <KField label="Title" required value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} maxLength={90} />
            <KField label="Text" value={draft.body} onChangeText={(body) => setDraft({ ...draft, body })} multiline maxLength={300} />
            <View style={styles.imageRow}>
              {!!draft.image && <Photo source={photo(draft.image)} style={styles.thumb} contentFit="cover" />}
              <KButton label={draft.image ? 'Change photo' : 'Add a photo'} icon="image-outline" variant="secondary" size="sm" onPress={() => setPicking(true)} />
              {!!draft.image && <KButton label="Remove" variant="ghost" size="sm" onPress={() => setDraft({ ...draft, image: '' })} />}
            </View>
            <KField label="Button" value={draft.actionLabel} onChangeText={(actionLabel) => setDraft({ ...draft, actionLabel })} placeholder="e.g. See venues" maxLength={30} />
            <KField label="Where the banner goes" value={draft.href} onChangeText={(href) => setDraft({ ...draft, href })} placeholder="/venues or https://" autoCapitalize="none" autoCorrect={false} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              {BANNER_LINKS.map((l) => (
                <FilterChip key={l.href} label={l.label} selected={draft.href === l.href} onPress={() => setDraft({ ...draft, href: l.href })} />
              ))}
            </ScrollView>
            <KButton label="Save banner" icon="checkmark" onPress={save} />
            {!!draft.id && (
              <KButton
                label="Delete banner"
                variant="danger"
                icon="trash-outline"
                onPress={() => {
                  const id = draft.id;
                  if (!id) return;
                  confirm('Delete this banner?', 'It leaves the couple’s home at once.', 'Delete', () => {
                    say(removeBanner(id));
                    setDraft(null);
                  });
                }}
              />
            )}
          </View>
        )}
      </Sheet>
      {/* iOS can't show a sheet over a sheet: the banner form steps aside while a photo is chosen. */}
      <ImageSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title="Banner photo"
        value={draft?.image || undefined}
        onPick={(image) => {
          if (draft) setDraft({ ...draft, image });
          return null;
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  arrows: { gap: 4 },
  arrow: { width: 30, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 64, height: 44, borderRadius: 6 },
});
