import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, ChoiceChips, KButton, KField, showMissing } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { inputReset } from '@/constants/theme';
import { photos } from '@/constants/images';
import { addToGoogleCalendar } from '@/services/exporters';
import { quoteTotals } from '@/services/quotes';
import { useDraft } from '@/store/drafts';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { ROLE_MARK, ROLE_THEMES } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Message, Thread } from '@/types/platform';
import { addDays, formatMoney, formatShortDate, formatTime, today } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { tr } from '@/i18n';

const QUICK_REPLIES: Record<string, string[]> = {
  customer: ['Thank you!', 'Can we schedule a call?', 'Please share the updated quote', 'Is this date available?'],
  vendor: ['Thanks for reaching out! Sharing our packages now.', 'The date is available — shall I hold it?', 'Can we do a site visit this weekend?', 'Advance of 30% confirms the booking.'],
  platform: ['I’ve shared the updated quotation.', 'Your provider has confirmed.', 'Reminder: your next instalment is due soon.', 'I’ll call you in 10 minutes.'],
  freelancer: ['On my way.', 'Reached the venue.', 'Could you share the exact location?', 'Sharing raw files tonight.'],
};

const quoteHref = (role: string, id: string) => (role === 'customer' ? `/quote/${id}` : role === 'platform' ? `/platform/quote/${id}` : role === 'vendor' ? `/business/quote/${id}` : null);

function Bubble({ m, mine, showName, seen }: { m: Message; mine: boolean; showName: boolean; seen: boolean }) {
  const t = useRoleTheme();
  const account = useAccount();
  const quote = useDb((s) => (m.meta?.quoteId ? s.quotes.find((q) => q.id === m.meta!.quoteId) : undefined));
  const roleColor = ROLE_MARK[m.senderRole];
  const bg = mine ? t.c.primary : t.c.surface;
  const fg = mine ? t.c.onPrimary : t.c.textStrong;

  if (m.kind === 'system') {
    return (
      <Text size={12} color={t.c.muted} align="center" style={{ marginVertical: 6 }}>
        {m.text}
      </Text>
    );
  }

  const body = () => {
    if (m.kind === 'quote' && quote) {
      const href = quoteHref(account.role, quote.id);
      return (
        <Pressable onPress={() => href && router.push(href as never)} style={[styles.card, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : t.c.surfaceAlt }]}>
          <Ionicons name="document-text" size={22} color={fg} />
          <View style={{ flex: 1 }}>
            <Text size={13} weight="bold" color={fg}>
              {quote.number} · v{quote.version}
            </Text>
            <Text size={12} color={fg} style={{ opacity: 0.85 }}>
              {formatMoney(quoteTotals(quote).total)} · tap to open
            </Text>
          </View>
        </Pressable>
      );
    }
    if (m.kind === 'location' && m.meta?.location) {
      const loc = m.meta.location;
      return (
        <Pressable
          onPress={() => Linking.openURL(loc.lat ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.label)}`)}
          style={[styles.card, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : t.c.surfaceAlt }]}>
          <Ionicons name="location" size={22} color={fg} />
          <View style={{ flex: 1 }}>
            <Text size={13} weight="bold" color={fg}>
              {loc.label}
            </Text>
            <Text size={12} color={fg} style={{ opacity: 0.85 }}>
              Open in Maps
            </Text>
          </View>
        </Pressable>
      );
    }
    if (m.kind === 'meeting' && m.meta?.meeting) {
      const mt = m.meta.meeting;
      const when = new Date(mt.at);
      return (
        <Pressable
          onPress={() => addToGoogleCalendar({ title: mt.title, date: mt.at.slice(0, 10), time: `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` })}
          style={[styles.card, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : t.c.surfaceAlt }]}>
          <Ionicons name="calendar" size={22} color={fg} />
          <View style={{ flex: 1 }}>
            <Text size={13} weight="bold" color={fg}>
              {mt.title}
            </Text>
            <Text size={12} color={fg} style={{ opacity: 0.85 }}>
              {formatShortDate(mt.at)} · {formatTime(mt.at)} · add to calendar
            </Text>
          </View>
        </Pressable>
      );
    }
    if (m.kind === 'image' && (m.meta?.uri || m.meta?.image)) {
      return <Photo source={m.meta.uri ? { uri: m.meta.uri } : photos[m.meta.image!]} style={styles.image} contentFit="cover" />;
    }
    return (
      <Text size={15} color={fg} lineHeight={21}>
        {m.text}
      </Text>
    );
  };

  return (
    <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
      {showName && !mine && (
        <Text size={11} weight="bold" color={roleColor} style={{ marginLeft: 4, marginBottom: 2 }}>
          {m.senderName} · {ROLE_THEMES[m.senderRole].label}
        </Text>
      )}
      <View style={[styles.bubble, { backgroundColor: bg, borderColor: t.c.border, borderWidth: mine ? 0 : 1 }, mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }]}>
        {body()}
        <Text size={10} color={fg} style={{ opacity: 0.7, alignSelf: 'flex-end', marginTop: 2 }}>
          {formatTime(m.at)}
          {mine && seen ? ' · Seen' : ''}
        </Text>
      </View>
    </View>
  );
}

/** Shared conversation view for every role: text, photos, quotes, locations and meetings. */
export function ThreadView({ thread }: { thread: Thread }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const allMessages = useDb((s) => s.messages);
  const quotes = useDb((s) => s.quotes);
  const sendMessage = useDb((s) => s.sendMessage);
  const markRead = useDb((s) => s.markThreadRead);
  // An unsent message stays in the box (and on the device) until it is sent.
  const [text, setText] = useDraft(`chat:${account.id}:${thread.id}`, '');
  const [menu, setMenu] = useState(false);
  const [meeting, setMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('Call with your coordinator');
  const [meetingDate, setMeetingDate] = useState(addDays(today(), 2));
  const [meetingTime, setMeetingTime] = useState('16:00');
  const listRef = useRef<FlatList<Message>>(null);
  const messages = allMessages.filter((m) => m.threadId === thread.id);
  const me = { id: account.id, name: account.role === 'vendor' ? (account.businessName ?? account.name) : account.name, role: account.role };
  const others = thread.members.filter((m) => m.id !== account.id);
  const blocked = thread.blockedBy.length > 0;
  const lastMine = [...messages].reverse().find((m) => m.senderId === account.id);
  const projectQuotes = quotes.filter((q) => q.projectId && q.projectId === thread.projectId && q.status !== 'draft');

  useEffect(() => {
    markRead(thread.id, account.id);
  }, [messages.length, thread.id, account.id, markRead]);

  const send = (kind: Message['kind'] = 'text', meta?: Message['meta'], body = text) => {
    if (kind === 'text' && !body.trim()) return;
    triggerHaptic('light');
    sendMessage(thread.id, me, body, kind, meta);
    if (kind === 'text') setText('');
    setMenu(false);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets[0]) send('image', { uri: res.assets[0].uri }, 'Photo');
  };

  const shareLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      send('location', { location: { label: 'My current location', lat: pos.coords.latitude, lng: pos.coords.longitude } }, 'Location');
    } catch {
      toast('Location permission is needed to share where you are');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.members, { borderBottomColor: t.c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
          {thread.members.map((m) => (
            <View key={m.id} style={[styles.member, { backgroundColor: t.c.surfaceAlt }]}>
              <Avatar name={m.name} size={20} />
              <Text size={12} weight="semibold" color={t.c.text}>
                {m.id === account.id ? 'You' : m.name.split(' ')[0]}
              </Text>
              <Text size={10} color={ROLE_MARK[m.role]}>
                {ROLE_THEMES[m.role].label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, gap: 6, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 }}>
            <Ionicons name="chatbubbles-outline" size={40} color={t.c.subtle} />
            <Text size={14} color={t.c.muted} align="center">
              Start the conversation with {others.map((o) => o.name.split(' ')[0]).join(', ') || 'your team'}.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Bubble
            m={item}
            mine={item.senderId === account.id}
            showName={thread.members.length > 2 && messages[index - 1]?.senderId !== item.senderId}
            seen={item.id === lastMine?.id && item.readBy.some((id) => id !== account.id)}
          />
        )}
        ListFooterComponent={
          thread.typing && thread.typing.id !== account.id ? (
            <Text size={12} color={t.c.muted} style={{ marginTop: 6 }}>
              {thread.typing.name} is typing…
            </Text>
          ) : null
        }
      />
      {blocked ? (
        <Text size={13} color={t.c.muted} align="center" style={{ padding: 16 }}>
          This conversation is blocked.
        </Text>
      ) : (
        <View style={{ backgroundColor: t.c.surface, borderTopColor: t.c.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Math.max(insets.bottom, 8) }}>
          {!text && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
              {(QUICK_REPLIES[account.role] ?? []).map((q) => (
                <Pressable key={q} onPress={() => send('text', undefined, q)} style={[styles.quick, { borderColor: t.c.border }]}>
                  <Text size={12} color={t.c.text}>
                    {q}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.composer}>
            <Pressable onPress={() => setMenu(true)} hitSlop={8} accessibilityLabel="Attach" style={[styles.circle, { backgroundColor: t.c.surfaceAlt }]}>
              <Ionicons name="add" size={22} color={t.c.textStrong} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={tr('Message')}
              placeholderTextColor={t.c.subtle}
              multiline
              style={[styles.input, { color: t.c.textStrong, fontFamily: t.fonts.regular, backgroundColor: t.c.surfaceAlt }, inputReset]}
            />
            <Pressable onPress={() => (text.trim() ? send() : showMissing('Type a message first'))} accessibilityLabel="Send" style={[styles.circle, { backgroundColor: text.trim() ? t.c.primary : t.c.surfaceAlt }]}>
              <Ionicons name="send" size={18} color={text.trim() ? t.c.onPrimary : t.c.subtle} />
            </Pressable>
          </View>
        </View>
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Share">
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {[
            { icon: 'image-outline', label: 'Photo from gallery', onPress: pickPhoto },
            { icon: 'location-outline', label: 'My location', onPress: shareLocation },
            { icon: 'calendar-outline', label: 'Schedule a meeting', onPress: () => { setMenu(false); setMeeting(true); } },
            ...projectQuotes.map((q) => ({ icon: 'document-text-outline', label: `Quotation ${q.number} (v${q.version})`, onPress: () => send('quote', { quoteId: q.id }, q.number) })),
          ].map((item) => (
            <Pressable key={item.label} onPress={item.onPress} style={({ pressed }) => [styles.menuRow, { borderColor: t.c.border, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name={item.icon as never} size={20} color={t.c.primary} />
              <Text size={15} color={t.c.textStrong}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <Sheet visible={meeting} onClose={() => setMeeting(false)} title="Schedule a meeting">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
          <KField value={meetingTitle} onChangeText={setMeetingTitle} />
          <ChoiceChips options={['Video call', 'Site visit', 'Menu tasting', 'Makeup trial']} selected={[]} onToggle={(v) => setMeetingTitle(v)} />
          <Calendar value={meetingDate} onChange={setMeetingDate} />
          <KField label="Time" value={meetingTime} onChangeText={setMeetingTime} placeholder="16:00" />
          <KButton
            label="Send invite"
            icon="calendar"
            onPress={() => {
              const [h, m] = meetingTime.split(':').map(Number);
              const at = new Date(`${meetingDate}T00:00:00`);
              at.setHours(h || 0, m || 0);
              send('meeting', { meeting: { at: at.toISOString(), title: meetingTitle } }, meetingTitle);
              setMeeting(false);
            }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  members: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  member: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  bubbleWrap: { marginVertical: 2 },
  bubble: { maxWidth: '82%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, padding: 10, minWidth: 220 },
  image: { width: 220, height: 160, borderRadius: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quick: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
});
