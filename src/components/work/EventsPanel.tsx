import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { EVENT_TYPES, bsMonthLabel } from '@/data/events';
import { runSheetHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { EventType, Project, ProjectEvent } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate } from '@/utils/format';

import { EventCard } from './RunSheet';

function EventSheet({ project, event, onClose }: { project: Project; event: ProjectEvent | 'new' | null; onClose: () => void }) {
  const t = useRoleTheme();
  const addEvent = useDb((s) => s.addEvent);
  const updateEvent = useDb((s) => s.updateEvent);
  const existing = event && event !== 'new' ? event : null;
  const [type, setType] = useState<EventType>(existing?.type ?? 'MEHENDI');
  const [date, setDate] = useState<string | null>(existing?.date ?? null);
  const [time, setTime] = useState(existing?.startTime ?? EVENT_TYPES.find((e) => e.id === type)?.start ?? '11:00');
  const [venue, setVenue] = useState(existing?.venue ?? 'To be decided');
  const [guests, setGuests] = useState(String(existing?.guests ?? Math.round(project.guests * 0.5)));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [priv, setPriv] = useState(existing?.private ?? false);

  const save = () => {
    const patch = { type, date, startTime: time, venue: venue.trim() || 'To be decided', guests: Number(guests) || 0, notes: notes.trim() || undefined, private: priv };
    if (existing) updateEvent(project.id, existing.id, patch);
    else addEvent(project.id, patch);
    toast(existing ? 'Function updated' : 'Function added');
    onClose();
  };

  return (
    <Sheet visible={!!event} onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add a function'}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {!existing && (
          <ChoiceChips
            options={EVENT_TYPES.map((e) => e.label)}
            selected={[EVENT_TYPES.find((e) => e.id === type)!.label]}
            onToggle={(label) => {
              const def = EVENT_TYPES.find((e) => e.label === label)!;
              setType(def.id);
              setTime(def.start);
              setGuests(String(Math.round(project.guests * def.guestShare) || project.guests));
            }}
          />
        )}
        <Calendar value={date} onChange={setDate} />
        <View style={styles.row}>
          <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
            {date ? `${formatLongDate(date)} · ${bsMonthLabel(date)}` : 'Date not confirmed yet'}
          </Text>
          {date && (
            <Pressable onPress={() => setDate(null)} hitSlop={8}>
              <Text size={13} weight="semibold" color={t.c.primary}>
                Clear date
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Start time" value={time} onChangeText={setTime} placeholder="11:00" />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Guests" value={guests} onChangeText={(v) => setGuests(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
        </View>
        <KField label="Venue" value={venue} onChangeText={setVenue} />
        <KField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Dress code, rituals, special requests…" />
        <Pressable onPress={() => setPriv((v) => !v)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: priv }}>
          <Ionicons name={priv ? 'lock-closed' : 'lock-open-outline'} size={18} color={t.c.primary} />
          <Text size={14} color={t.c.text}>
            {priv ? 'Private — hidden from guests & website' : 'Shown on your website and invitations'}
          </Text>
        </Pressable>
        <KButton label={existing ? 'Save' : 'Add function'} onPress={save} />
      </ScrollView>
    </Sheet>
  );
}

/** Functions of a project (engagement, mehendi, wedding, reception…) with run sheets. */
export function EventsPanel({ project, mode }: { project: Project; mode: 'customer' | 'platform' | 'vendor' }) {
  const t = useRoleTheme();
  const updateEvent = useDb((s) => s.updateEvent);
  const [editing, setEditing] = useState<ProjectEvent | 'new' | null>(null);
  const canEdit = mode !== 'vendor';
  return (
    <View style={{ gap: 12 }}>
      {canEdit && <KButton label="Add a function" icon="add" size="sm" variant="secondary" onPress={() => setEditing('new')} />}
      {project.events
        .filter((e) => mode === 'platform' || e.status !== 'cancelled')
        .map((e) => (
          <View key={e.id} style={{ gap: 6 }}>
            <EventCard project={project} event={e} canControl={mode === 'platform' || (mode === 'vendor' && project.managedBy === 'self')} canEditRun={mode !== 'customer'} />
            <View style={styles.row}>
              {canEdit && e.status === 'planned' && (
                <Pressable onPress={() => setEditing(e)} hitSlop={6} style={styles.link}>
                  <Ionicons name="create-outline" size={14} color={t.c.primary} />
                  <Text size={12} weight="semibold" color={t.c.primary}>
                    Edit
                  </Text>
                </Pressable>
              )}
              {e.runSheet.length > 0 && (
                <Pressable onPress={() => sharePdf(runSheetHtml(project, e), `Run sheet ${e.name}`)} hitSlop={6} style={styles.link}>
                  <Ionicons name="print-outline" size={14} color={t.c.primary} />
                  <Text size={12} weight="semibold" color={t.c.primary}>
                    Print run sheet
                  </Text>
                </Pressable>
              )}
              {mode === 'platform' && e.status === 'planned' && (
                <Pressable onPress={() => confirm(`Cancel ${e.name}?`, 'Bookings for this function stay until you cancel them.', 'Cancel function', () => updateEvent(project.id, e.id, { status: 'cancelled' }))} hitSlop={6} style={styles.link}>
                  <Ionicons name="close-circle-outline" size={14} color={t.c.danger} />
                  <Text size={12} weight="semibold" color={t.c.danger}>
                    Cancel
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      <EventSheet key={editing === 'new' ? 'new' : (editing?.id ?? 'none')} project={project} event={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
