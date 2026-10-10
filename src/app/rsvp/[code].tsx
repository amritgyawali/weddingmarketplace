import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ChoiceChips, KButton, KField } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors } from '@/constants/theme';
import { exportCalendar } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import type { RsvpStatus } from '@/types/platform';
import { formatClock, formatDateAlt, formatLongDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const DIETARY = ['Vegetarian', 'Non-veg', 'Vegan', 'Jain', 'No alcohol', 'Allergies'];
const CHOICES: { id: RsvpStatus; label: string }[] = [
  { id: 'yes', label: 'Joyfully accept' },
  { id: 'maybe', label: 'Not sure yet' },
  { id: 'no', label: 'Regretfully decline' },
];

/** Public RSVP page reached from the invitation link or QR code — no sign-in needed. */
export default function RsvpScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [entered, setEntered] = useState(code);
  const guest = useDb((s) => s.guests.find((g) => g.code === code));
  const project = useDb((s) => (guest ? s.projects.find((p) => p.id === guest.projectId) : undefined));
  const site = useDb((s) => (guest ? s.websites.find((w) => w.projectId === guest.projectId) : undefined));
  const respond = useDb((s) => s.respondRsvp);
  const [answers, setAnswers] = useState<Record<string, { rsvp: RsvpStatus; attending: number; meal?: string }>>({});
  const [dietary, setDietary] = useState<string[] | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const accent = site?.accent ?? colors.primary;

  if (!guest || !project) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingHorizontal: 24, gap: 16 }]}>
        <Ionicons name="mail-open-outline" size={44} color={colors.primary} />
        <Text size={26} weight="bold" color={colors.textStrong}>
          RSVP to a wedding
        </Text>
        <Text size={15} color={colors.textMuted}>
          {params.code ? 'We couldn’t find that invitation code. Check your invitation and try again.' : 'Enter the 6-character code printed on your invitation.'}
        </Text>
        <KField placeholder="e.g. K7Q2XA" value={entered} onChangeText={(v) => setEntered(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} autoCapitalize="characters" />
        <KButton label="Find my invitation" missing={entered.length < 4 && (entered ? 'Invitation codes have at least 4 letters or numbers' : 'Enter the code from your invitation')} onPress={() => setCode(entered)} />
        <KButton label="Back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    );
  }

  const size = 1 + guest.plusOnes + guest.children;
  const events = guest.invites.map((inv) => ({ inv, event: project.events.find((e) => e.id === inv.eventId) })).filter((x) => x.event && x.event.status !== 'cancelled' && !x.event.private);
  const answerFor = (eventId: string) => {
    const inv = guest.invites.find((i) => i.eventId === eventId)!;
    return answers[eventId] ?? { rsvp: inv.rsvp, attending: inv.attending || (inv.rsvp === 'yes' ? size : 0), meal: inv.meal };
  };
  const setAnswer = (eventId: string, patch: Partial<{ rsvp: RsvpStatus; attending: number; meal?: string }>) =>
    setAnswers((a) => ({ ...a, [eventId]: { ...answerFor(eventId), ...patch } }));
  const complete = events.every(({ event }) => answerFor(event!.id).rsvp !== 'pending');
  const deadlinePassed = !!site?.rsvpDeadline && site.rsvpDeadline < new Date().toISOString().slice(0, 10);

  const submit = () => {
    respond(
      guest.code,
      events.map(({ event }) => ({ eventId: event!.id, ...answerFor(event!.id) })),
      Object.keys(extra).length ? extra : undefined,
      dietary ?? guest.dietary,
    );
    triggerHaptic('success');
    setDone(true);
  };

  if (done) {
    const going = events.filter(({ event }) => answerFor(event!.id).rsvp === 'yes');
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingHorizontal: 24, gap: 14, alignItems: 'center' }]}>
        <Ionicons name="heart-circle" size={72} color={accent} />
        <Text size={26} weight="bold" color={colors.textStrong} align="center">
          Thank you, {guest.name.split(' ')[0]}!
        </Text>
        <Text size={15} color={colors.textMuted} align="center">
          {going.length ? `We can’t wait to celebrate with you at ${going.map((g) => g.event!.name).join(', ')}.` : 'Thank you for letting us know — you’ll be missed!'}
        </Text>
        {going.length > 0 && (
          <KButton
            label="Add to my calendar"
            icon="calendar-outline"
            variant="secondary"
            onPress={() =>
              exportCalendar(
                going.filter((g) => g.event!.date).map(({ event }) => ({ title: `${project.title} — ${event!.name}`, date: event!.date!, time: event!.startTime, durationHours: 5, location: `${event!.venue}, ${event!.city}` })),
                `${project.code}-invite`,
              )
            }
          />
        )}
        {site?.published && <KButton label="Visit the wedding website" variant="ghost" onPress={() => router.push({ pathname: '/w/[slug]', params: { slug: site.slug } })} />}
        <KButton label="Change my response" variant="ghost" size="sm" onPress={() => setDone(false)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View>
          <Photo source={photo(site?.cover ?? 'ideaCoupleGardenWalk')} style={{ width: '100%', height: 220 }} contentFit="cover" />
          <View style={[styles.veil, { paddingTop: insets.top + 12 }]}>
            <Text size={13} weight="bold" color={colors.white}>
              You’re invited
            </Text>
            <Text serif size={30} weight="bold" color={colors.white} lineHeight={40}>
              {site?.headline ?? project.title}
            </Text>
            <Text size={14} color="rgba(255,255,255,0.9)">
              {formatLongDate(project.weddingDate)} · {formatDateAlt(project.weddingDate)} · {project.city}
            </Text>
          </View>
        </View>
        <View style={{ padding: 18, gap: 14 }}>
          <Text size={18} weight="bold" color={colors.textStrong}>
            Namaste, {guest.name}
          </Text>
          <Text size={14} color={colors.textMuted}>
            {size > 1 ? `We’ve reserved ${size} seats for your family. ` : ''}Please reply for each celebration{site?.rsvpDeadline ? ` by ${formatLongDate(site.rsvpDeadline)}` : ''}.
          </Text>
          {deadlinePassed && (
            <Text size={13} color={colors.warning}>
              The RSVP deadline has passed — you can still reply, and the couple will be notified.
            </Text>
          )}

          {events.map(({ event }) => {
            const a = answerFor(event!.id);
            return (
              <Card key={event!.id} style={{ gap: 10 }}>
                <Text size={17} weight="bold" color={colors.textStrong}>
                  {event!.name}
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {event!.date ? `${formatLongDate(event!.date)} · ${formatClock(event!.startTime)}` : 'Date to be announced'} · {event!.venue}, {event!.city}
                </Text>
                <View style={{ gap: 8 }}>
                  {CHOICES.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setAnswer(event!.id, { rsvp: c.id, attending: c.id === 'no' ? 0 : a.attending || size })}
                      style={[styles.choice, { borderColor: a.rsvp === c.id ? accent : colors.border, backgroundColor: a.rsvp === c.id ? `${accent}14` : colors.white }]}>
                      <Ionicons name={a.rsvp === c.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={a.rsvp === c.id ? accent : colors.textSubtle} />
                      <Text size={15} weight="semibold" color={colors.textStrong}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {a.rsvp === 'yes' && size > 1 && (
                  <View style={styles.row}>
                    <Text size={14} color={colors.text} style={{ flex: 1 }}>
                      How many of you are coming?
                    </Text>
                    <Pressable onPress={() => setAnswer(event!.id, { attending: Math.max(1, a.attending - 1) })} hitSlop={8} accessibilityLabel="Fewer people">
                      <Ionicons name="remove-circle-outline" size={26} color={accent} />
                    </Pressable>
                    <Text size={17} weight="bold" color={colors.textStrong}>
                      {a.attending}
                    </Text>
                    <Pressable onPress={() => setAnswer(event!.id, { attending: Math.min(size, a.attending + 1) })} hitSlop={8} accessibilityLabel="More people">
                      <Ionicons name="add-circle-outline" size={26} color={accent} />
                    </Pressable>
                  </View>
                )}
                {a.rsvp === 'yes' && <ChoiceChips options={['Veg', 'Non-veg']} selected={a.meal ? [a.meal] : []} onToggle={(m) => setAnswer(event!.id, { meal: m })} />}
              </Card>
            );
          })}

          <Card style={{ gap: 10 }}>
            <Text size={15} weight="bold" color={colors.textStrong}>
              Any dietary needs?
            </Text>
            <ChoiceChips options={DIETARY} selected={dietary ?? guest.dietary} onToggle={(d) => setDietary((cur) => ((cur ?? guest.dietary).includes(d) ? (cur ?? guest.dietary).filter((x) => x !== d) : [...(cur ?? guest.dietary), d]))} />
          </Card>

          {site?.rsvpQuestions.map((q) => (
            <Card key={q.id} style={{ gap: 10 }}>
              <Text size={15} weight="bold" color={colors.textStrong}>
                {q.kind === 'song' ? 'Song request: ' : ''}
                {q.q}
              </Text>
              {q.kind === 'choice' && q.options ? (
                <ChoiceChips options={q.options} selected={extra[q.id] ? [extra[q.id]] : []} onToggle={(v) => setExtra((e) => ({ ...e, [q.id]: v }))} />
              ) : (
                <KField value={extra[q.id] ?? ''} onChangeText={(v) => setExtra((e) => ({ ...e, [q.id]: v }))} placeholder={q.kind === 'song' ? 'Song & artist' : 'Your answer'} />
              )}
            </Card>
          ))}

          <KButton
            label="Send my RSVP"
            size="lg"
            missing={!complete && `Choose a reply for ${events.filter(({ event }) => answerFor(event!.id).rsvp === 'pending').map(({ event }) => event!.name).join(', ')}`}
            onPress={submit}
            style={{ backgroundColor: accent, borderColor: accent }}
          />
          {!complete && (
            <Text size={12} color={colors.textMuted} align="center">
              Choose a reply for every celebration to continue.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 18, justifyContent: 'flex-end', paddingBottom: 18, gap: 2 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
