import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KField, ProgressBar, SectionTitle } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { bsMonthLabel } from '@/data/events';
import { invitationHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { invitationText } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Guest, Project } from '@/types/platform';
import { formatClock, formatLongDate } from '@/utils/format';
import { openSms, openWhatsApp, rsvpPath, shareMessage, sitePath, webUrl } from '@/utils/links';

const DESIGNS = [
  { id: 'sindoor', label: 'Sindoor & gold', colors: ['#7A0E1C', '#B3202E'] as const, accent: '#E8B94A', paper: '#FFF6E5' },
  { id: 'himalaya', label: 'Himalaya', colors: ['#10263A', '#2F5D86'] as const, accent: '#F2E6C9', paper: '#F3F7FB' },
  { id: 'marigold', label: 'Marigold', colors: ['#E0781B', '#F4A640'] as const, accent: '#FFF3D6', paper: '#FFF8EC' },
  { id: 'blush', label: 'Blush floral', colors: ['#C2567A', '#EBA2B8'] as const, accent: '#FFFFFF', paper: '#FFF5F8' },
];
const TONES = [
  { id: 'traditional', label: 'Traditional' },
  { id: 'nepali', label: 'नेपाली' },
  { id: 'modern', label: 'Modern' },
] as const;

function Invitations({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const allGuests = useDb((s) => s.guests);
  const guests = allGuests.filter((g) => g.projectId === project.id);
  const site = useDb((s) => s.websites.find((w) => w.projectId === project.id));
  const sendInvites = useDb((s) => s.sendInvites);
  const events = project.events.filter((e) => e.status !== 'cancelled' && !e.private);
  const [design, setDesign] = useState(DESIGNS[0]);
  const [tone, setTone] = useState<(typeof TONES)[number]['id']>('traditional');
  const [message, setMessage] = useState(() => invitationText(project, 'traditional'));
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const names = project.partnerName ? `${project.customerName.split(' ')[0]} & ${project.partnerName.split(' ')[0]}` : project.title;
  const siteUrl = site?.published ? webUrl(sitePath(site.slug)) : null;
  const event = events.find((e) => e.id === eventId);
  const invited = guests.filter((g) => g.invites.some((i) => i.eventId === eventId));
  const inv = (g: Guest) => g.invites.find((i) => i.eventId === eventId)!;
  const sent = invited.filter((g) => inv(g).sentAt);
  const replied = invited.filter((g) => inv(g).respondedAt || inv(g).rsvp !== 'pending');
  const personal = (g: Guest) => `Namaste ${g.name.split(' ')[0]} 🙏\n\n${message}\n\n${event ? `${event.name}: ${event.date ? formatLongDate(event.date) : 'date TBC'}, ${event.venue}\n` : ''}Please RSVP: ${webUrl(rsvpPath(g.code))}`;

  const sendOne = (g: Guest, via: 'whatsapp' | 'sms') => {
    (via === 'whatsapp' ? openWhatsApp : openSms)(personal(g), g.phone);
    sendInvites(project.id, eventId, [g.id]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={design.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Text size={13} color={design.accent} tracking={1}>
          ॐ श्री गणेशाय नमः
        </Text>
        <Text size={30} weight="extrabold" color={design.accent} align="center" style={{ fontFamily: 'serif' }}>
          {names}
        </Text>
        <Text size={13} color="#fff" align="center" lineHeight={20}>
          {message}
        </Text>
        <View style={[styles.divider, { backgroundColor: design.accent }]} />
        {events.slice(0, 4).map((e) => (
          <Text key={e.id} size={12} color="#fff" align="center">
            {e.name} · {e.date ? `${formatLongDate(e.date)} (${bsMonthLabel(e.date)})` : 'date TBC'} · {formatClock(e.startTime)}
          </Text>
        ))}
        {siteUrl && (
          <View style={styles.qr}>
            <QRCode value={siteUrl} size={78} />
          </View>
        )}
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DESIGNS.map((d) => (
          <Pressable key={d.id} onPress={() => setDesign(d)} style={[styles.design, { borderColor: design.id === d.id ? t.c.primary : t.c.border }]}>
            <LinearGradient colors={d.colors} style={styles.designSwatch} />
            <Text size={12} weight="semibold" color={t.c.text}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={{ gap: 10 }}>
        <SectionTitle title="Message" />
        <ChoiceChips
          options={TONES.map((x) => x.label)}
          selected={[TONES.find((x) => x.id === tone)!.label]}
          onToggle={(label) => {
            const next = TONES.find((x) => x.label === label)!.id;
            setTone(next);
            setMessage(invitationText(project, next));
          }}
        />
        <KField value={message} onChangeText={setMessage} multiline editable={!readOnly} />
        <View style={toolStyles.row}>
          <KButton
            label="Print / PDF card"
            icon="print-outline"
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => sharePdf(invitationHtml({ names, message, accent: design.colors[0], background: design.paper, events, footer: siteUrl ? `RSVP & details: ${siteUrl}` : undefined }), `${project.code}-invitation`)}
          />
          <KButton label="Share to group" icon="share-social-outline" size="sm" style={{ flex: 1 }} onPress={() => shareMessage(`${names}\n\n${message}`, siteUrl ?? undefined)} />
        </View>
        {!siteUrl && (
          <Pressable onPress={() => router.push('/website')}>
            <Text size={12} color={t.c.primary}>
              Publish your wedding website to add a QR code and a shareable link →
            </Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle title="Send personal invitations" />
      {events.length === 0 ? (
        <EmptyBlock icon="calendar-outline" title="No functions yet" message="Add your functions from My Wedding first." />
      ) : (
        <>
          <ChoiceChips options={events.map((e) => e.name)} selected={event ? [event.name] : []} onToggle={(name) => setEventId(events.find((e) => e.name === name)!.id)} />
          <Card style={{ gap: 8 }}>
            <View style={toolStyles.between}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {sent.length}/{invited.length} sent · {replied.length} replied
              </Text>
              <Text size={12} color={t.c.muted}>
                {invited.length ? Math.round((replied.length / invited.length) * 100) : 0}% response
              </Text>
            </View>
            <ProgressBar value={invited.length ? sent.length / invited.length : 0} />
            {!readOnly && sent.length < invited.length && (
              <KButton
                label={`Mark ${invited.length - sent.length} as sent (printed cards)`}
                variant="ghost"
                size="sm"
                onPress={() => {
                  sendInvites(project.id, eventId, invited.filter((g) => !inv(g).sentAt).map((g) => g.id));
                  toast('Marked as sent');
                }}
              />
            )}
          </Card>
          {invited.length === 0 ? (
            <EmptyBlock icon="people-outline" title="Nobody invited to this function yet" action="Open guest list" onAction={() => router.push('/guests')} />
          ) : (
            invited
              .sort((a, b) => Number(!!inv(a).sentAt) - Number(!!inv(b).sentAt) || a.name.localeCompare(b.name))
              .map((g) => (
                <Card key={g.id} style={[toolStyles.row, { padding: 12 }]}>
                  <Avatar name={g.name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      {inv(g).rsvp !== 'pending' ? `Replied: ${inv(g).rsvp}` : inv(g).sentAt ? 'Sent · awaiting reply' : g.phone ? 'Not sent' : 'No phone — share code ' + g.code}
                    </Text>
                  </View>
                  {!readOnly && (
                    <>
                      <Pressable onPress={() => sendOne(g, 'sms')} hitSlop={6} accessibilityLabel={`SMS ${g.name}`} style={styles.icon}>
                        <Ionicons name="chatbox-outline" size={20} color={t.c.muted} />
                      </Pressable>
                      <Pressable onPress={() => sendOne(g, 'whatsapp')} hitSlop={6} accessibilityLabel={`WhatsApp ${g.name}`} style={styles.icon}>
                        <Ionicons name="logo-whatsapp" size={22} color={inv(g).sentAt ? t.c.muted : '#1FA64F'} />
                      </Pressable>
                    </>
                  )}
                </Card>
              ))
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Invitation studio: card designs, bilingual wording, printable PDF, QR to the website and per-guest RSVP links. */
export default function InvitationsScreen() {
  return (
    <ToolScreen title="Invitations" subtitle={(p) => p.title}>
      {(project, { readOnly }) => <Invitations project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 22, gap: 10, alignItems: 'center' },
  divider: { width: 60, height: 1.5, marginVertical: 4 },
  qr: { backgroundColor: '#fff', padding: 8, borderRadius: 10, marginTop: 6 },
  design: { width: 110, borderWidth: 2, borderRadius: 14, padding: 6, gap: 6, alignItems: 'center' },
  designSwatch: { width: '100%', height: 50, borderRadius: 10 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
