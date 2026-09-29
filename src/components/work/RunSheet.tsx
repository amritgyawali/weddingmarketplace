import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useDb } from '@/store/useDb';
import { statusLabel, statusTone } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, RunItem, RunStatus, WeddingEvent } from '@/types/platform';
import { formatClock, formatLongDate } from '@/utils/format';

const RUN_STATUSES: RunStatus[] = ['pending', 'in_progress', 'done', 'delayed'];

/**
 * Wedding-day run sheet with live status. Editors (platform, vendor, hired
 * crew) can move items through pending → in progress → done / delayed.
 */
export function RunSheet({ project, event, editable, compact }: { project: Project; event: WeddingEvent; editable: boolean; compact?: boolean }) {
  const t = useRoleTheme();
  const setRunStatus = useDb((s) => s.setRunStatus);
  const [active, setActive] = useState<RunItem | null>(null);
  const done = event.runSheet.filter((r) => r.status === 'done').length;

  if (!event.runSheet.length) {
    return (
      <Text size={13} color={t.c.muted} style={{ paddingVertical: 8 }}>
        No run sheet yet.
      </Text>
    );
  }

  return (
    <View>
      {!compact && (
        <Text size={12} weight="semibold" color={t.c.muted} style={{ marginBottom: 6 }}>
          {done}/{event.runSheet.length} cues complete
        </Text>
      )}
      {event.runSheet.map((item, i) => {
        const tone = statusTone(item.status, t);
        const last = i === event.runSheet.length - 1;
        return (
          <Pressable
            key={item.id}
            disabled={!editable}
            onPress={() => setActive(item)}
            accessibilityRole={editable ? 'button' : undefined}
            accessibilityLabel={`${item.time} ${item.title}, ${statusLabel(item.status)}`}
            style={styles.item}>
            <Text size={12} weight="bold" color={t.c.muted} style={{ width: 44, paddingTop: 2 }}>
              {item.time}
            </Text>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: item.status === 'pending' ? t.c.surface : tone.fg, borderColor: tone.fg }]}>
                {item.status === 'done' && <Ionicons name="checkmark" size={10} color={t.dark ? '#000' : '#fff'} />}
              </View>
              {!last && <View style={[styles.line, { backgroundColor: t.c.border }]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong} style={item.status === 'done' ? { opacity: 0.7 } : undefined}>
                {item.title}
              </Text>
              <View style={styles.meta}>
                <Text size={12} color={t.c.muted}>
                  {item.owner}
                </Text>
                {item.status !== 'pending' && <StatusPill status={item.status} />}
              </View>
            </View>
            {editable && <Ionicons name="ellipsis-horizontal" size={16} color={t.c.subtle} style={{ paddingTop: 2 }} />}
          </Pressable>
        );
      })}

      <Sheet visible={!!active} onClose={() => setActive(null)} title={active ? `${active.time} · ${active.title}` : ''}>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {RUN_STATUSES.map((s) => {
            const tone = statusTone(s, t);
            const selected = active?.status === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  if (!active) return;
                  triggerHaptic(s === 'done' ? 'success' : 'selection');
                  setRunStatus(project.id, event.id, active.id, s);
                  setActive(null);
                }}
                style={[styles.option, { borderColor: selected ? tone.fg : t.c.border, backgroundColor: selected ? tone.bg : 'transparent' }]}>
                <View style={[styles.dot, { backgroundColor: tone.fg }]} />
                <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                  {statusLabel(s)}
                </Text>
                {selected && <Ionicons name="checkmark" size={18} color={tone.fg} />}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

/** Event card: header with status + controls, collapsible run sheet. */
export function EventCard({ project, event, canControl, canEditRun }: { project: Project; event: WeddingEvent; canControl: boolean; canEditRun: boolean }) {
  const t = useRoleTheme();
  const setEventStatus = useDb((s) => s.setEventStatus);
  const addRunItem = useDb((s) => s.addRunItem);
  const [open, setOpen] = useState(event.status === 'live');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ time: '', title: '', owner: '' });

  const addItem = () => {
    if (!draft.title.trim() || !/^\d{1,2}:\d{2}$/.test(draft.time)) return;
    addRunItem(project.id, event.id, { time: draft.time.padStart(5, '0'), title: draft.title.trim(), owner: draft.owner.trim() || 'Coordinator' });
    setDraft({ time: '', title: '', owner: '' });
    setAdding(false);
  };

  return (
    <Card style={{ gap: 10, borderColor: event.status === 'live' ? t.c.danger : t.c.border }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.eventHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.meta}>
            <Text size={17} weight="bold" color={t.c.textStrong}>
              {event.name}
            </Text>
            <StatusPill status={event.status} label={event.status === 'live' ? '● LIVE' : undefined} />
          </View>
          <Text size={13} color={t.c.muted}>
            {event.date ? formatLongDate(event.date) : 'Date to be confirmed'} · {formatClock(event.startTime)} · {event.venue} · {event.guests} guests
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.c.muted} />
      </Pressable>

      {open && (
        <>
          <RunSheet project={project} event={event} editable={canEditRun} />
          {canEditRun &&
            (adding ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ width: 90 }}>
                    <KField placeholder="18:30" value={draft.time} onChangeText={(time) => setDraft((d) => ({ ...d, time }))} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <KField placeholder="Cue (e.g. Couple entry)" value={draft.title} onChangeText={(title) => setDraft((d) => ({ ...d, title }))} />
                  </View>
                </View>
                <KField placeholder="Owner (e.g. DJ, Decor team)" value={draft.owner} onChangeText={(owner) => setDraft((d) => ({ ...d, owner }))} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <KButton label="Cancel" variant="ghost" size="sm" onPress={() => setAdding(false)} style={{ flex: 1 }} />
                  <KButton label="Add cue" size="sm" onPress={addItem} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <KButton label="Add run-sheet cue" icon="add" variant="ghost" size="sm" onPress={() => setAdding(true)} />
            ))}
        </>
      )}

      {canControl && event.status !== 'done' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {event.status === 'planned' ? (
            <KButton label="Go live" icon="radio-outline" variant="danger" size="sm" onPress={() => { setEventStatus(project.id, event.id, 'live'); setOpen(true); }} style={{ flex: 1 }} />
          ) : (
            <KButton label="Mark event complete" icon="checkmark-done" variant="success" size="sm" onPress={() => setEventStatus(project.id, event.id, 'done')} style={{ flex: 1 }} />
          )}
        </View>
      )}
    </Card>
  );
}

export function SeverityPicker({ value, onChange }: { value: string; onChange: (v: 'low' | 'medium' | 'high') => void }) {
  return <ChoiceChips options={['low', 'medium', 'high']} selected={[value]} onToggle={(v) => onChange(v as 'low' | 'medium' | 'high')} />;
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 8 },
  rail: { alignItems: 'center', width: 16 },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
