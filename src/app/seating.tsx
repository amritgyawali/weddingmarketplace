import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { seatingHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Guest, Project, SeatingElement, SeatingLayout } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { uid } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const W = 1000;
const H = 700;
const KINDS: { id: SeatingElement['kind']; label: string; w: number; h: number; capacity: number; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'round', label: 'Round table', w: 90, h: 90, capacity: 10, icon: 'ellipse-outline' },
  { id: 'rect', label: 'Long table', w: 150, h: 60, capacity: 12, icon: 'tablet-landscape-outline' },
  { id: 'square', label: 'Square table', w: 80, h: 80, capacity: 8, icon: 'square-outline' },
  { id: 'stage', label: 'Stage / mandap', w: 260, h: 90, capacity: 0, icon: 'flower-outline' },
  { id: 'dance', label: 'Dance floor', w: 200, h: 150, capacity: 0, icon: 'musical-notes-outline' },
  { id: 'dj', label: 'DJ / band', w: 90, h: 60, capacity: 0, icon: 'headset-outline' },
  { id: 'buffet', label: 'Buffet', w: 220, h: 60, capacity: 0, icon: 'restaurant-outline' },
  { id: 'bar', label: 'Drinks', w: 110, h: 55, capacity: 0, icon: 'wine-outline' },
  { id: 'entrance', label: 'Entrance', w: 110, h: 40, capacity: 0, icon: 'enter-outline' },
];
const kindOf = (k: SeatingElement['kind']) => KINDS.find((x) => x.id === k)!;

/** Starter floor plan sized to the function's guest count. */
function starterLayout(project: Project, eventId: string, guests: number): SeatingLayout {
  const tables = Math.max(4, Math.min(40, Math.ceil(guests / 10)));
  const cols = Math.min(8, Math.ceil(Math.sqrt(tables * 1.6)));
  const elements: SeatingElement[] = [
    { id: uid('el'), kind: 'stage', label: 'Stage / mandap', capacity: 0, x: 500, y: 70 },
    { id: uid('el'), kind: 'dance', label: 'Dance floor', capacity: 0, x: 500, y: 215 },
    { id: uid('el'), kind: 'buffet', label: 'Buffet', capacity: 0, x: 160, y: 650 },
    { id: uid('el'), kind: 'entrance', label: 'Entrance', capacity: 0, x: 840, y: 670 },
  ];
  for (let i = 0; i < tables; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    elements.push({ id: uid('el'), kind: 'round', label: i < 2 ? `VIP ${i + 1}` : `Table ${i - 1}`, capacity: 10, vip: i < 2, x: 90 + col * ((W - 180) / Math.max(1, cols - 1)), y: 330 + row * 105 });
  }
  return { eventId, projectId: project.id, elements };
}

function Element({ el, scale, seated, selected, onMove, onPress }: { el: SeatingElement; scale: number; seated: number; selected: boolean; onMove: (x: number, y: number) => void; onPress: () => void }) {
  const t = useRoleTheme();
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const k = kindOf(el.kind);
  const w = k.w * scale;
  const h = k.h * scale;
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .onUpdate((e) => setDrag({ dx: e.translationX, dy: e.translationY }))
    .onEnd((e) => {
      setDrag({ dx: 0, dy: 0 });
      onMove(Math.max(k.w / 2, Math.min(W - k.w / 2, el.x + e.translationX / scale)), Math.max(k.h / 2, Math.min(H - k.h / 2, el.y + e.translationY / scale)));
    });
  const tap = Gesture.Tap().runOnJS(true).onEnd(() => onPress());
  const full = el.capacity > 0 && seated >= el.capacity;
  const over = el.capacity > 0 && seated > el.capacity;
  const tint = el.capacity === 0 ? t.c.surfaceAlt : over ? '#FDE2E1' : full ? '#E3F5E8' : el.vip ? '#FFF4D6' : t.c.surface;
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={[
          styles.el,
          {
            left: el.x * scale - w / 2 + drag.dx,
            top: el.y * scale - h / 2 + drag.dy,
            width: w,
            height: h,
            borderRadius: el.kind === 'round' ? w / 2 : 8 * scale + 4,
            backgroundColor: tint,
            borderColor: selected ? t.c.primary : over ? t.c.danger : el.vip ? '#E0A100' : t.c.border,
            borderWidth: selected ? 2.5 : 1.2,
            zIndex: drag.dx || drag.dy ? 10 : 1,
          },
        ]}>
        {el.capacity === 0 && <Ionicons name={k.icon} size={Math.max(12, 18 * scale)} color={t.c.muted} />}
        <Text size={Math.max(8, 12 * scale)} weight="bold" color={t.c.textStrong} numberOfLines={1} align="center">
          {el.label}
        </Text>
        {el.capacity > 0 && (
          <Text size={Math.max(8, 11 * scale)} color={over ? t.c.danger : t.c.muted}>
            {seated}/{el.capacity}
          </Text>
        )}
      </View>
    </GestureDetector>
  );
}

function Planner({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const events = project.events.filter((e) => e.status !== 'cancelled');
  const layouts = useDb((s) => s.seating);
  const allGuests = useDb((s) => s.guests);
  const saveSeating = useDb((s) => s.saveSeating);
  const addElement = useDb((s) => s.addSeatingElement);
  const moveElement = useDb((s) => s.moveSeatingElement);
  const removeElement = useDb((s) => s.removeSeatingElement);
  const assignSeat = useDb((s) => s.assignSeat);
  const autoSeat = useDb((s) => s.autoSeat);
  const [eventId, setEventId] = useState(() => (events.find((e) => layouts.some((l) => l.eventId === e.id)) ?? events.find((e) => e.type === project.eventType) ?? events[0])?.id ?? '');
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<SeatingElement['kind']>('round');
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [q, setQ] = useState('');

  const event = events.find((e) => e.id === eventId);
  const layout = layouts.find((l) => l.eventId === eventId);
  const guests = allGuests.filter((g) => g.projectId === project.id && g.invites.some((i) => i.eventId === eventId && i.rsvp !== 'no'));
  const invite = (g: Guest) => g.invites.find((i) => i.eventId === eventId)!;
  const heads = (g: Guest) => Math.max(1, invite(g).attending || 1 + g.plusOnes + g.children);
  const seatedAt = (tableId: string) => guests.filter((g) => invite(g).tableId === tableId);
  const load = (tableId: string) => seatedAt(tableId).reduce((s, g) => s + heads(g), 0);
  const unseated = guests.filter((g) => !invite(g).tableId);
  const seats = layout?.elements.reduce((s, e) => s + e.capacity, 0) ?? 0;
  const people = guests.reduce((s, g) => s + heads(g), 0);
  const selected = layout?.elements.find((e) => e.id === selectedId) ?? null;
  const scale = width / W;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!event) return <EmptyBlock icon="calendar-outline" title="Add a function first" />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <ChoiceChips options={events.map((e) => e.name)} selected={[event.name]} onToggle={(n) => { setEventId(events.find((e) => e.name === n)!.id); setSelectedId(null); }} />
        <View style={toolStyles.stats}>
          {[
            { label: 'Coming', value: people },
            { label: 'Seats', value: seats },
            { label: 'Unseated', value: unseated.reduce((s, g) => s + heads(g), 0) },
          ].map((s) => (
            <Card key={s.label} style={toolStyles.stat}>
              <Text size={20} weight="semibold" color={s.label === 'Unseated' && s.value ? t.c.warning : t.c.textStrong}>
                {s.value}
              </Text>
              <Text size={12} color={t.c.muted}>
                {s.label}
              </Text>
            </Card>
          ))}
        </View>
        {seats > 0 && seats < people && (
          <Text size={12} color={t.c.warning}>
            {people - seats} more seats needed — add tables or raise capacities.
          </Text>
        )}

        {!layout ? (
          <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="grid-outline" size={34} color={t.c.primary} />
            <Text size={16} weight="bold" color={t.c.textStrong}>
              No floor plan for {event.name} yet
            </Text>
            <Text size={13} color={t.c.muted} align="center">
              Start from a plan sized for {event.guests} guests — then drag tables to match the hall.
            </Text>
            {!readOnly && <KButton label="Create floor plan" icon="sparkles-outline" onPress={() => saveSeating(starterLayout(project, event.id, event.guests))} />}
          </Card>
        ) : (
          <>
            <View onLayout={onLayout} style={[styles.canvas, { height: width * (H / W), borderColor: t.c.border }]}>
              {width > 0 &&
                layout.elements.map((el) => (
                  <Element
                    key={el.id}
                    el={el}
                    scale={scale}
                    seated={load(el.id)}
                    selected={el.id === selectedId}
                    onMove={(x, y) => !readOnly && moveElement(event.id, el.id, x, y)}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSelectedId(el.id === selectedId ? null : el.id);
                    }}
                  />
                ))}
            </View>
            <Text size={11} color={t.c.subtle} align="center">
              Drag to arrange · tap a table to seat guests
            </Text>
            {!readOnly && (
              <View style={toolStyles.row}>
                <KButton label="Add" icon="add" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setAddOpen(true)} />
                <KButton
                  label="Auto-seat"
                  icon="flash-outline"
                  size="sm"
                  style={{ flex: 1.3 }}
                  onPress={() => {
                    const n = autoSeat(project.id, event.id);
                    toast(n ? `${n} guests seated — VIPs first, families together` : 'Everyone who fits is already seated', 'people');
                  }}
                />
                <KButton label="PDF" icon="print-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => sharePdf(seatingHtml(project, event, layout, guests), `${project.code}-seating-${event.name}`)} />
              </View>
            )}

            {selected && (
              <Card style={{ gap: 10, borderColor: t.c.primary }}>
                <View style={toolStyles.between}>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {selected.label}
                  </Text>
                  <Pressable onPress={() => setSelectedId(null)} hitSlop={8} accessibilityLabel="Close">
                    <Ionicons name="close" size={20} color={t.c.muted} />
                  </Pressable>
                </View>
                {!readOnly && (
                  <View style={toolStyles.row}>
                    <View style={{ flex: 1.6 }}>
                      <KField value={selected.label} onChangeText={(v) => saveSeating({ ...layout, elements: layout.elements.map((e) => (e.id === selected.id ? { ...e, label: v } : e)) })} />
                    </View>
                    {selected.capacity > 0 && (
                      <View style={{ flex: 1 }}>
                        <KField value={String(selected.capacity)} keyboardType="number-pad" onChangeText={(v) => saveSeating({ ...layout, elements: layout.elements.map((e) => (e.id === selected.id ? { ...e, capacity: Math.min(40, Number(v.replace(/\D/g, '')) || 1) } : e)) })} />
                      </View>
                    )}
                  </View>
                )}
                {selected.capacity > 0 && (
                  <>
                    {!readOnly && (
                      <View style={toolStyles.between}>
                        <Text size={14} color={t.c.text}>
                          VIP table
                        </Text>
                        <Toggle value={!!selected.vip} onValueChange={(v) => saveSeating({ ...layout, elements: layout.elements.map((e) => (e.id === selected.id ? { ...e, vip: v } : e)) })} accessibilityLabel="VIP table" />
                      </View>
                    )}
                    {seatedAt(selected.id).map((g) => (
                      <View key={g.id} style={toolStyles.row}>
                        <Avatar name={g.name} size={28} />
                        <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                          {g.name}
                          {heads(g) > 1 ? ` +${heads(g) - 1}` : ''}
                          {g.dietary.length ? ` · ${g.dietary[0]}` : ''}
                        </Text>
                        {!readOnly && (
                          <Pressable onPress={() => assignSeat(g.id, event.id, null)} hitSlop={8} accessibilityLabel={`Unseat ${g.name}`}>
                            <Ionicons name="remove-circle-outline" size={20} color={t.c.danger} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    {!seatedAt(selected.id).length && (
                      <Text size={13} color={t.c.muted}>
                        Nobody seated here yet — pick from the list below.
                      </Text>
                    )}
                  </>
                )}
                {!readOnly && (
                  <KButton
                    label="Remove from plan"
                    variant="ghost"
                    size="sm"
                    icon="trash-outline"
                    onPress={() =>
                      confirm('Remove this?', 'Guests seated here become unseated.', 'Remove', () => {
                        removeElement(event.id, selected.id);
                        setSelectedId(null);
                      })
                    }
                  />
                )}
              </Card>
            )}

            <SectionTitle title={`Unseated (${unseated.length})`} />
            {unseated.length > 6 && <KField placeholder="Search guests" value={q} onChangeText={setQ} />}
            {unseated.length === 0 ? (
              <Text size={13} color={t.c.muted}>
                {guests.length ? 'Everyone is seated.' : 'Invite guests to this function from the guest list first.'}
              </Text>
            ) : (
              unseated
                .filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()))
                .slice(0, 60)
                .map((g) => {
                  const canSeat = !!selected && selected.capacity > 0 && !readOnly;
                  return (
                    <Card key={g.id} onPress={canSeat ? () => { assignSeat(g.id, event.id, selected!.id); triggerHaptic('light'); } : undefined} style={[toolStyles.row, { padding: 10 }]}>
                      <Avatar name={g.name} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text size={14} weight="semibold" color={t.c.textStrong}>
                          {g.name}
                          {g.vip ? ' · VIP' : ''}
                        </Text>
                        <Text size={12} color={t.c.muted}>
                          {g.side} · {g.household ?? g.category} · {heads(g)} {heads(g) > 1 ? 'people' : 'person'}
                        </Text>
                      </View>
                      {canSeat && <Ionicons name="arrow-forward-circle" size={22} color={t.c.primary} />}
                    </Card>
                  );
                })
            )}
          </>
        )}
      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add to floor plan">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <ChoiceChips
            options={KINDS.map((k) => k.label)}
            selected={[kindOf(kind).label]}
            onToggle={(l) => {
              const k = KINDS.find((x) => x.label === l)!;
              setKind(k.id);
              setCapacity(String(k.capacity));
            }}
          />
          <KField label="Label" value={label} onChangeText={setLabel} placeholder={kind === 'round' ? `Table ${(layout?.elements.filter((e) => e.capacity > 0).length ?? 0) + 1}` : kindOf(kind).label} />
          {kindOf(kind).capacity > 0 && <KField label="Seats" value={capacity} onChangeText={(v) => setCapacity(v.replace(/\D/g, ''))} keyboardType="number-pad" />}
          <KButton
            label="Add"
            onPress={() => {
              const k = kindOf(kind);
              addElement(project.id, event.id, { kind, label: label.trim() || (k.capacity ? `Table ${(layout?.elements.filter((e) => e.capacity > 0).length ?? 0) + 1}` : k.label), capacity: k.capacity ? Math.min(40, Number(capacity) || k.capacity) : 0, x: W / 2, y: H / 2 });
              setLabel('');
              setAddOpen(false);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

/** Drag-and-drop seating planner per function with auto-seating, capacity warnings and printable charts. */
export default function SeatingScreen() {
  return (
    <ToolScreen title="Seating plan" subtitle={(p) => p.title}>
      {(project, { readOnly }) => <Planner project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', borderWidth: 1, borderRadius: 10, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  el: { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
});
