import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle } from '@/components/kit';
import { Col, Cols, Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { PLANNER_MODULE_LABELS, PLANNER_MODULES, type PlannerModule } from '@/data/capabilities';
import { EVENT_TYPES, eventLabel } from '@/data/events';
import { PROTECTED_OCCASIONS, type HonoureeKind, type OccasionDef } from '@/data/occasions';
import { SERVICE_BY_ID, SERVICE_GROUPS, SERVICES } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { can } from '@/services/experience';
import type { OccasionInput } from '@/store/db/personas';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { EventType } from '@/types/platform';
import { confirm } from '@/utils/confirm';

const ICONS = [
  'heart-outline',
  'diamond-outline',
  'heart-circle-outline',
  'balloon-outline',
  'happy-outline',
  'bonfire-outline',
  'gift-outline',
  'briefcase-outline',
  'school-outline',
  'home-outline',
  'flower-outline',
  'musical-notes-outline',
  'restaurant-outline',
  'star-outline',
  'calendar-outline',
  'add-circle-outline',
] as const;

const HONOUREES: { id: HonoureeKind; label: string }[] = [
  { id: 'couple', label: 'A couple' },
  { id: 'baby', label: 'A baby' },
  { id: 'person', label: 'One person' },
  { id: 'org', label: 'An organisation' },
];

const BLANK: OccasionInput = {
  label: '',
  blurb: '',
  icon: 'calendar-outline',
  eventTypes: ['OTHER'],
  honourees: 'person',
  defaultServices: ['venue', 'catering', 'photography'],
  services: ['venue', 'catering', 'photography', 'decoration', 'cake', 'invitation'],
  modules: ['guests', 'invitations'],
  ritual: false,
  vocab: { eventDay: 'Event day', hosts: 'family', planTitle: 'My celebration', noun: 'celebration' },
  active: true,
};

const toInput = (o: OccasionDef): OccasionInput => ({
  label: o.label,
  blurb: o.blurb,
  icon: o.icon,
  eventTypes: [...o.eventTypes],
  honourees: o.honourees,
  defaultServices: [...o.defaultServices],
  services: [...o.services],
  modules: [...o.modules],
  ritual: o.ritual,
  vocab: { ...o.vocab },
  active: o.active,
  order: o.order,
});

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Add or edit one occasion (`id` = "new" to add). */
export default function OccasionEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const occasions = useDb((s) => s.occasions);
  const existing = occasions.find((o) => o.id === id);
  if (id !== 'new' && !existing) {
    return (
      <ToolPage title="Occasion">
        <EmptyBlock icon="calendar-outline" title="This occasion no longer exists" message="It may have been deleted. Go back to the list of occasions." action="All occasions" onAction={() => router.replace('/platform/occasions')} />
      </ToolPage>
    );
  }
  return <OccasionEditor key={existing?.id ?? 'new'} existing={existing} />;
}

function OccasionEditor({ existing }: { existing?: OccasionDef }) {
  const t = useRoleTheme();
  const exp = useExperience();
  const addOccasion = useDb((s) => s.addOccasion);
  const updateOccasion = useDb((s) => s.updateOccasion);
  const removeOccasion = useDb((s) => s.removeOccasion);
  const [draft, setDraft] = useState<OccasionInput>(() => (existing ? toInput(existing) : BLANK));
  const [error, setError] = useState<string | null>(null);
  const manage = can(exp, 'occasion.manage');
  const locked = !!existing && PROTECTED_OCCASIONS.includes(existing.id);
  const put = (patch: Partial<OccasionInput>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const save = () => {
    if (existing) {
      const problem = updateOccasion(existing.id, draft);
      if (problem) return setError(problem);
      toast('Occasion saved');
    } else {
      const res = addOccasion(draft);
      if (!res.occasion) return setError(res.error ?? 'Check the details');
      toast(`${res.occasion.label} added`);
    }
    router.back();
  };

  const remove = () =>
    existing &&
    confirm(`Delete ${existing.label}?`, 'Families can no longer pick it. Reset demo data brings the built-in occasions back.', 'Delete', () => {
      const problem = removeOccasion(existing.id);
      if (problem) return setError(problem);
      toast('Occasion deleted');
      router.back();
    });

  const serviceName = (sid: string) => SERVICE_BY_ID[sid]?.name ?? sid;
  const eventOptions = EVENT_TYPES.map((e) => e.id);

  return (
    <ToolPage title={existing ? existing.label : 'New occasion'} subtitle={existing ? (existing.builtIn ? 'Built-in occasion' : 'Custom occasion') : 'Something families can plan'}>
      {!manage && (
        <Card>
          <Text size={14} color={t.c.muted}>
            Only a super admin can change occasions.
          </Text>
        </Card>
      )}
      <View style={{ gap: 14, opacity: manage ? 1 : 0.6, pointerEvents: manage ? 'auto' : 'none' }}>
        <Card style={{ gap: 12 }}>
          <Cols>
            <Col>
              <KField label="Name" value={draft.label} onChangeText={(label) => put({ label })} placeholder="e.g. Griha pravesh" />
            </Col>
            <Col>
              <KField label="Short description" value={draft.blurb} onChangeText={(blurb) => put({ blurb })} placeholder="Shown under the tile in onboarding" />
            </Col>
          </Cols>
          <Text size={13} weight="medium" color={t.c.text}>
            Icon
          </Text>
          <View style={styles.icons}>
            {ICONS.map((icon) => {
              const on = draft.icon === icon;
              return (
                <Pressable key={icon} onPress={() => put({ icon })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={icon.replace('-outline', '').replace(/-/g, ' ')} style={[styles.icon, { borderColor: on ? t.c.textStrong : t.c.border, backgroundColor: on ? t.c.surfaceAlt : t.c.surface }]}>
                  <Ionicons name={icon} size={22} color={on ? t.c.textStrong : t.c.muted} />
                </Pressable>
              );
            })}
          </View>
          <Text size={13} weight="medium" color={t.c.text}>
            Who it is for
          </Text>
          <ChoiceChips options={HONOUREES.map((h) => h.label)} selected={HONOUREES.filter((h) => h.id === draft.honourees).map((h) => h.label)} onToggle={(label) => put({ honourees: HONOUREES.find((h) => h.label === label)!.id })} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text size={15} color={t.c.textStrong}>
                Ritual occasion
              </Text>
              <Hint>Offers the sait finder, samagri and pandit first.</Hint>
            </View>
            <Toggle value={draft.ritual} onValueChange={(ritual) => put({ ritual })} accessibilityLabel="Ritual occasion" />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text size={15} color={t.c.textStrong}>
                Offered to families
              </Text>
              <Hint>{locked ? 'Older plans fall back to this occasion, so it stays on.' : 'Switch off to stop new plans picking it. Existing plans keep working.'}</Hint>
            </View>
            <Toggle value={draft.active} onValueChange={(active) => !locked && put({ active })} accessibilityLabel="Offered to families" />
          </View>
        </Card>

        <View>
          <SectionTitle title={`Functions (${draft.eventTypes.length})`} />
          <Card style={{ gap: 8 }}>
            <Hint>The first one you pick is the main function.</Hint>
            <ChoiceChips options={eventOptions.map(eventLabel)} selected={draft.eventTypes.map(eventLabel)} onToggle={(label) => put({ eventTypes: toggleIn(draft.eventTypes, eventOptions.find((e) => eventLabel(e) === label) as EventType) })} />
          </Card>
        </View>

        <View>
          <SectionTitle title={`Planner tools (${draft.modules.length})`} />
          <Card style={{ gap: 8 }}>
            <Hint>Shot list, music, menu, contacts and budget tools are always included.</Hint>
            <ChoiceChips options={PLANNER_MODULES.map((m) => PLANNER_MODULE_LABELS[m])} selected={draft.modules.map((m) => PLANNER_MODULE_LABELS[m])} onToggle={(label) => put({ modules: toggleIn(draft.modules, PLANNER_MODULES.find((m) => PLANNER_MODULE_LABELS[m] === label) as PlannerModule) })} />
          </Card>
        </View>

        <View>
          <SectionTitle title={`Marketplace services (${draft.services.length} of ${SERVICES.length})`} />
          <Card style={{ gap: 12 }}>
            <Hint>Families planning this occasion only see these categories.</Hint>
            {SERVICE_GROUPS.map((g) => {
              const ids = SERVICES.filter((s) => s.group === g.id).map((s) => s.id);
              const all = ids.every((sid) => draft.services.includes(sid));
              return (
                <View key={g.id} style={{ gap: 6 }}>
                  <View style={styles.groupHead}>
                    <Text size={13} weight="semibold" color={t.c.textStrong}>
                      {g.title}
                    </Text>
                    <Pressable
                      hitSlop={6}
                      onPress={() => {
                        const services = all ? draft.services.filter((sid) => !ids.includes(sid)) : [...new Set([...draft.services, ...ids])];
                        put({ services, defaultServices: draft.defaultServices.filter((sid) => services.includes(sid)) });
                      }}>
                      <Text size={13} color={t.c.primary}>
                        {all ? 'None' : 'All'}
                      </Text>
                    </Pressable>
                  </View>
                  <ChoiceChips
                    options={ids.map(serviceName)}
                    selected={draft.services.filter((sid) => ids.includes(sid)).map(serviceName)}
                    onToggle={(label) => {
                      const sid = ids.find((x) => serviceName(x) === label)!;
                      const services = toggleIn(draft.services, sid);
                      put({ services, defaultServices: draft.defaultServices.filter((x) => services.includes(x)) });
                    }}
                  />
                </View>
              );
            })}
          </Card>
        </View>

        <View>
          <SectionTitle title={`Pre-selected in the plan (${draft.defaultServices.length})`} />
          <Card style={{ gap: 8 }}>
            <ChoiceChips options={draft.services.map(serviceName)} selected={draft.defaultServices.map(serviceName)} onToggle={(label) => put({ defaultServices: toggleIn(draft.defaultServices, draft.services.find((x) => serviceName(x) === label)!) })} />
          </Card>
        </View>

        <View>
          <SectionTitle title="Words the app uses" />
          <Card style={{ gap: 12 }}>
            <Cols>
              <Col>
                <KField label="The big day" value={draft.vocab.eventDay} onChangeText={(eventDay) => put({ vocab: { ...draft.vocab, eventDay } })} placeholder="Pasni day" />
              </Col>
              <Col>
                <KField label="Plan title" value={draft.vocab.planTitle} onChangeText={(planTitle) => put({ vocab: { ...draft.vocab, planTitle } })} placeholder="Pasni plan" />
              </Col>
            </Cols>
            <Cols>
              <Col>
                <KField label="Hosts are called" value={draft.vocab.hosts} onChangeText={(hosts) => put({ vocab: { ...draft.vocab, hosts } })} placeholder="family" autoCapitalize="none" />
              </Col>
              <Col>
                <KField label="The event is a" value={draft.vocab.noun} onChangeText={(noun) => put({ vocab: { ...draft.vocab, noun } })} placeholder="celebration" autoCapitalize="none" />
              </Col>
            </Cols>
          </Card>
        </View>
      </View>

      {error && (
        <Text size={14} color={t.c.danger}>
          {error}
        </Text>
      )}
      {manage && (
        <View style={styles.actions}>
          {existing && !locked && <KButton label="Delete" variant="danger" style={{ flex: 1 }} onPress={remove} />}
          <KButton label={existing ? 'Save changes' : 'Add occasion'} style={{ flex: 2 }} onPress={save} />
        </View>
      )}
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 10 },
});
