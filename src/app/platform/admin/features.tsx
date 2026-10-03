import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ALL_FEATURE_IDS, featureGroups, hiddenFeatureCount, type FeatureScope } from '@/components/admin/featureCatalogue';
import { Card, KButton, KField, Segmented, SectionTitle } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toastError } from '@/components/ui/Toast';
import { featureDefault, featureOn, TOP_FEATURES } from '@/data/features';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

const SCOPES: { id: FeatureScope; label: string }[] = [
  { id: 'customer', label: 'Couples' },
  { id: 'vendor', label: 'Businesses' },
  { id: 'freelancer', label: 'Freelancers' },
  { id: 'platform', label: 'Staff' },
  { id: 'all', label: 'Everyone' },
];

/**
 * Show or hide any part of the app for everyone: tabs, home sections,
 * marketplace services, each of the 80 tools, sign-up paths. Each app starts
 * with its top 20 features on and the extras off; hidden things disappear at
 * once, and switching them back on restores them with their data.
 */
function Features() {
  const t = useRoleTheme();
  const flags = useDb((s) => s.featureFlags);
  const setFeature = useDb((s) => s.setFeature);
  const setFeatures = useDb((s) => s.setFeatures);
  const resetFeatures = useDb((s) => s.resetFeatures);
  const [scope, setScope] = useState<FeatureScope>('customer');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const visible = featureGroups(scope)
    .map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length);
  const hidden = hiddenFeatureCount(flags);
  const changed = Object.keys(flags).length;
  const top = scope === 'all' ? [] : TOP_FEATURES[scope];

  const flip = (id: string, on: boolean) => {
    const err = setFeature(id, on);
    if (err) toastError(err);
  };
  const recommended = () =>
    confirm('Go back to the recommended set?', 'Each app shows its top 20 features again and the extras are hidden. Nothing is deleted.', 'Use recommended', () => {
      const err = resetFeatures();
      if (err) toastError(err);
    });
  const everything = () =>
    confirm('Switch every feature on?', 'Every tab, tool, service and section becomes visible in all four apps. People may find the apps busier.', 'Switch all on', () => {
      const err = setFeatures(Object.fromEntries(ALL_FEATURE_IDS.map((id) => [id, true])));
      if (err) toastError(err);
    });

  return (
    <ToolPage
      title="Features"
      subtitle={changed ? `${hidden} hidden · ${changed} changed by you` : `${hidden} extras hidden · recommended set`}
      right={changed ? <KButton label="Recommended" size="sm" variant="secondary" onPress={recommended} /> : undefined}>
      <Hint>Each app starts with its 20 most-used features so new people aren’t lost. Extras stay hidden until you switch them on here. Records stay when you hide something: switch it back on and they return.</Hint>
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
      {top.length > 0 && !q && (
        <View>
          <SectionTitle title={`Top ${top.length}: on out of the box`} />
          <Card style={{ gap: 4 }}>
            {top.map((f, n) => (
              <Text key={f.id} size={13} color={featureOn(flags, f.id) ? t.c.text : t.c.muted}>
                {n + 1}. {f.label}
                {featureOn(flags, f.id) ? '' : ' (switched off)'}
              </Text>
            ))}
          </Card>
        </View>
      )}
      <KField placeholder="Find a feature, tool or service" value={query} onChangeText={setQuery} autoCorrect={false} />
      {visible.map((g) => {
        const allOn = g.items.every((i) => featureOn(flags, i.id));
        return (
          <View key={g.title}>
            <View style={styles.groupHead}>
              <View style={{ flex: 1 }}>
                <SectionTitle title={g.title} />
              </View>
              <KButton
                label={allOn ? 'Hide all' : 'Show all'}
                size="sm"
                variant="ghost"
                onPress={() => {
                  const err = setFeatures(Object.fromEntries(g.items.map((i) => [i.id, !allOn])));
                  if (err) toastError(err);
                }}
              />
            </View>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {g.items.map((i, n) => {
                const on = featureOn(flags, i.id);
                const extra = !featureDefault(i.id);
                return (
                  <View key={i.id} style={[styles.row, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text size={14} weight="medium" color={on ? t.c.textStrong : t.c.muted}>
                        {i.label}
                      </Text>
                      {(!!i.hint || extra) && (
                        <Text size={12} color={t.c.muted} numberOfLines={2}>
                          {[extra ? 'Extra, off by default' : '', i.hint ?? ''].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Toggle value={on} onValueChange={(v) => flip(i.id, v)} accessibilityLabel={i.label} />
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}
      {visible.length === 0 && (
        <Text size={14} color={t.c.muted} align="center">
          Nothing matches “{query}”.
        </Text>
      )}
      <KButton label="Switch every feature on" variant="ghost" icon="eye-outline" onPress={everything} />
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/features', Features);

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
});
