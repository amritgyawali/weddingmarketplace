import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, ProgressBar, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { RunSheet } from '@/components/work/RunSheet';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatShortDate } from '@/utils/format';

/** Wedding-day control room: every live or same-day event across the platform. */
export default function ControlRoom() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const gigs = useDb((s) => s.gigs);
  const setEventStatus = useDb((s) => s.setEventStatus);
  const resolveIncident = useDb((s) => s.resolveIncident);

  const all = projects.flatMap((p) => p.events.map((e) => ({ event: e, project: p })));
  const active = all.filter(({ event }) => event.status === 'live' || (daysUntil(event.date) === 0 && event.status !== 'done'));
  const next = all
    .filter(({ event }) => event.status === 'planned' && daysUntil(event.date) > 0 && daysUntil(event.date) <= 7)
    .sort((a, b) => a.event.date.localeCompare(b.event.date));
  const incidents = projects.flatMap((p) => p.incidents.filter((i) => i.status === 'open').map((i) => ({ incident: i, project: p })));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="WEDDING EXECUTION" title="Control room" subtitle={`${active.length} active today · ${incidents.length} open incidents`} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 30 }}>
        {incidents.length > 0 && (
          <View>
            <SectionTitle title="Open incidents" />
            <View style={{ gap: 10 }}>
              {incidents.map(({ incident, project }) => (
                <Card key={incident.id} style={[styles.incident, { borderLeftColor: incident.severity === 'high' ? t.c.danger : t.c.warning }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text size={12} weight="bold" color={t.c.muted}>
                      {project.code} · {project.title}
                    </Text>
                    <Text size={14} weight="semibold" color={t.c.textStrong}>
                      {incident.title}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      Reported by {incident.reportedBy}
                    </Text>
                  </View>
                  <KButton label="Resolve" size="sm" variant="success" onPress={() => resolveIncident(project.id, incident.id)} />
                </Card>
              ))}
            </View>
          </View>
        )}

        <View>
          <SectionTitle title="Live & today" />
          {active.length === 0 ? (
            <EmptyBlock icon="radio-outline" title="No events today" message="Events appear here on their wedding day. Use “Go live” in a project to start its run sheet." />
          ) : (
            <View style={{ gap: 12 }}>
              {active.map(({ event, project }) => {
                const done = event.runSheet.filter((r) => r.status === 'done').length;
                const delayed = event.runSheet.filter((r) => r.status === 'delayed').length;
                const crew = gigs.filter((g) => g.eventId === event.id).flatMap((g) => g.applications.filter((a) => a.status === 'hired' || a.status === 'completed'));
                const onSite = crew.filter((a) => a.checkInAt && !a.checkOutAt).length;
                return (
                  <Card key={event.id} style={{ gap: 12, borderColor: event.status === 'live' ? t.c.danger : t.c.border }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text size={12} weight="bold" color={t.c.primary}>
                          {project.code} · {project.city}
                        </Text>
                        <Text size={17} weight="bold" color={t.c.textStrong}>
                          {project.title} — {event.name}
                        </Text>
                        <Text size={12} color={t.c.muted}>
                          {event.venue} · {event.startTime} · {event.guests} guests
                        </Text>
                      </View>
                      <StatusPill status={event.status} label={event.status === 'live' ? '● LIVE' : undefined} />
                    </View>
                    <View style={styles.statRow}>
                      <View style={[styles.stat, { backgroundColor: t.c.surfaceAlt }]}>
                        <Text size={18} weight="bold" color={t.c.textStrong}>
                          {done}/{event.runSheet.length}
                        </Text>
                        <Text size={11} color={t.c.muted}>
                          cues done
                        </Text>
                      </View>
                      <View style={[styles.stat, { backgroundColor: t.c.surfaceAlt }]}>
                        <Text size={18} weight="bold" color={delayed ? t.c.danger : t.c.textStrong}>
                          {delayed}
                        </Text>
                        <Text size={11} color={t.c.muted}>
                          delayed
                        </Text>
                      </View>
                      <View style={[styles.stat, { backgroundColor: t.c.surfaceAlt }]}>
                        <Text size={18} weight="bold" color={t.c.textStrong}>
                          {onSite}/{crew.length}
                        </Text>
                        <Text size={11} color={t.c.muted}>
                          crew on site
                        </Text>
                      </View>
                    </View>
                    <ProgressBar value={event.runSheet.length ? done / event.runSheet.length : 0} color={delayed ? t.c.warning : t.c.success} />
                    <RunSheet project={project} event={event} editable compact />
                    <View style={styles.row}>
                      <KButton label="Open project" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: project.id } })} />
                      {event.status === 'live' ? (
                        <KButton label="Complete" icon="checkmark-done" variant="success" size="sm" style={{ flex: 1 }} onPress={() => setEventStatus(project.id, event.id, 'done')} />
                      ) : (
                        <KButton label="Go live" icon="radio-outline" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setEventStatus(project.id, event.id, 'live')} />
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View>
          <SectionTitle title="Next 7 days" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {next.length === 0 ? (
              <Text size={13} color={t.c.muted} style={{ padding: 16 }}>
                Nothing scheduled this week.
              </Text>
            ) : (
              next.map(({ event, project }, i) => (
                <View key={event.id} style={[styles.nextRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                  <Ionicons name="calendar-outline" size={18} color={t.c.primary} />
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="semibold" color={t.c.textStrong}>
                      {project.title} — {event.name}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      {formatShortDate(event.date)} · {event.startTime} · {project.city}
                    </Text>
                  </View>
                  <Text size={12} weight="bold" color={t.c.primary}>
                    in {daysUntil(event.date)}d
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  incident: { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 4 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
