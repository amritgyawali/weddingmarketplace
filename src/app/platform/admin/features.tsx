import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, KButton, KField, Segmented, SectionTitle } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import type { ToolDef } from '@/components/toolkit/hub';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toastError } from '@/components/ui/Toast';
import { featureOn, FEATURES, serviceFeature, toolFeature } from '@/data/features';
import { SERVICE_GROUPS, SERVICES } from '@/data/services';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { UserRole } from '@/types/platform';
import { confirm } from '@/utils/confirm';

type Scope = UserRole | 'all';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'customer', label: 'Couples' },
  { id: 'vendor', label: 'Businesses' },
  { id: 'freelancer', label: 'Freelancers' },
  { id: 'platform', label: 'Staff' },
  { id: 'all', label: 'Everyone' },
];

const TOOLS: Record<UserRole, ToolDef[]> = { customer: COUPLE_TOOLS, vendor: VENDOR_TOOLS, freelancer: FREELANCER_TOOLS, platform: PLATFORM_TOOLS };

interface Item {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Show or hide any part of the app for everyone: tabs, home sections,
 * marketplace services, each of the 80 tools, sign-up paths. Hidden things
 * disappear at once; switching them back on restores them with their data.
 */
function Features() {
  const t = useRoleTheme();
  const flags = useDb((s) => s.featureFlags);
  const setFeature = useDb((s) => s.setFeature);
  const setFeatures = useDb((s) => s.setFeatures);
  const resetFeatures = useDb((s) => s.resetFeatures);
  const [scope, setScope] = useState<Scope>('customer');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const groups: { title: string; items: Item[] }[] = [];
  const fixed = FEATURES.filter((f) => f.role === scope);
  for (const g of [...new Set(fixed.map((f) => f.group))]) groups.push({ title: g, items: fixed.filter((f) => f.group === g).map((f) => ({ id: f.id, label: f.label, hint: f.hint })) });
  if (scope === 'customer') {
    for (const g of SERVICE_GROUPS) {
      groups.push({ title: `Marketplace: ${g.title}`, items: SERVICES.filter((s) => s.group === g.id).map((s) => ({ id: serviceFeature(s.id), label: s.name, hint: 'Hidden from browsing, search results and home shortcuts' })) });
    }
  }
  if (scope !== 'all') {
    const tools = TOOLS[scope];
    for (const g of [...new Set(tools.map((x) => x.group))]) groups.push({ title: `Tools: ${g}`, items: tools.filter((x) => x.group === g).map((x) => ({ id: toolFeature(x.id), label: x.title, hint: x.subtitle })) });
  }
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length);
  const offCount = Object.values(flags).filter((v) => v === false).length;

  const flip = (id: string, on: boolean) => {
    const err = setFeature(id, on);
    if (err) toastError(err);
  };

  return (
    <ToolPage title="Features" subtitle={offCount ? `${offCount} switched off` : 'Everything is on'} right={offCount ? <KButton label="All on" size="sm" variant="secondary" onPress={() => confirm('Turn every feature back on?', 'Every tab, tool, service and section becomes visible again.', 'Turn on', () => { const err = resetFeatures(); if (err) toastError(err); })} /> : undefined}>
      <Hint>Switch something off to hide it from everyone in that app. Records stay: switch it back on and they return.</Hint>
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
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
                return (
                  <View key={i.id} style={[styles.row, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text size={14} weight="medium" color={on ? t.c.textStrong : t.c.muted}>
                        {i.label}
                      </Text>
                      {!!i.hint && (
                        <Text size={12} color={t.c.muted} numberOfLines={2}>
                          {i.hint}
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
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/features', Features);

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
});
