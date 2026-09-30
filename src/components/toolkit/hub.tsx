import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KField, ListRow, SectionTitle, type IconName } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import type { ToolId } from '@/data/access';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { UserRole } from '@/types/platform';

import { ToolPage } from './core';

export interface ToolDef {
  /** Registry id, also the route param and the `ToolEntry.tool` value. Needs a rule in `TOOL_RULES`. */
  id: ToolId;
  title: string;
  subtitle: string;
  icon: IconName;
  group: string;
  Component: ComponentType;
}

/** Route to a tool inside the signed-in role's app. */
export function toolHref(role: UserRole, id: string): Href {
  switch (role) {
    case 'vendor':
      return { pathname: '/business/tool/[id]', params: { id } };
    case 'freelancer':
      return { pathname: '/freelancer/tool/[id]', params: { id } };
    case 'platform':
      return { pathname: '/platform/tool/[id]', params: { id } };
    default:
      return { pathname: '/tool/[id]', params: { id } };
  }
}

/** Searchable, grouped index of a role's toolkit. */
export function ToolHub({ role, tools, title, subtitle }: { role: UserRole; tools: ToolDef[]; title: string; subtitle: string }) {
  const t = useRoleTheme();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = tools.filter((x) => !needle || `${x.title} ${x.subtitle} ${x.group}`.toLowerCase().includes(needle));
  const groups = [...new Set(shown.map((x) => x.group))];
  return (
    <ToolPage title={title} subtitle={subtitle}>
      <KField value={q} onChangeText={setQ} placeholder={`Search ${tools.length} tools`} autoCapitalize="none" accessibilityLabel="Search tools" />
      {groups.length === 0 && <EmptyBlock icon="search-outline" title="No tools match" message="Try another word, like budget, guests or payments." />}
      {groups.map((g) => (
        <View key={g}>
          <SectionTitle title={g} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {shown
              .filter((x) => x.group === g)
              .map((x) => (
                <ListRow key={x.id} icon={x.icon} title={x.title} subtitle={x.subtitle} onPress={() => router.push(toolHref(role, x.id))} />
              ))}
          </Card>
        </View>
      ))}
      <Text size={12} color={t.c.subtle} align="center" style={styles.foot}>
        Changes save automatically.
      </Text>
    </ToolPage>
  );
}

/** Renders one tool from the `[id]` route param, or an empty state for an unknown id. */
export function ToolRoute({ tools }: { tools: ToolDef[] }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const def = tools.find((x) => x.id === id);
  if (!def) {
    return (
      <ToolPage title="Tool not found">
        <EmptyBlock icon="construct-outline" title="This tool isn’t available" message="It may have moved. Open the tools list to find it." action="All tools" onAction={() => (router.canGoBack() ? router.back() : undefined)} />
      </ToolPage>
    );
  }
  const Tool = def.Component;
  return <Tool />;
}

const styles = StyleSheet.create({
  foot: { marginTop: 8 },
});
