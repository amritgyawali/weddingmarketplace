import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import { formatShortDate, formatTime } from '@/utils/format';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function InboxScreen() {
  const conversations = useAppStore((s) => s.conversations);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Inbox" />
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={conversations.length ? undefined : { flexGrow: 1, justifyContent: 'center' }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            message="Tap “Message” on any venue or vendor to start a conversation. Replies will show up here."
            actionLabel="Browse venues"
            onAction={() => router.navigate('/venues')}
          />
        }
        renderItem={({ item }) => {
          const last = item.messages[item.messages.length - 1];
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/inbox/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
              <Image source={photos[item.image]} style={styles.avatar} contentFit="cover" />
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text size={16} weight={item.unread ? 'bold' : 'semibold'} color={colors.heading} numberOfLines={1} style={{ flex: 1 }}>
                    {item.title}
                  </Text>
                  {last && (
                    <Text size={12} color={item.unread ? colors.primary : colors.textMuted}>
                      {isToday(last.at) ? formatTime(last.at) : formatShortDate(last.at)}
                    </Text>
                  )}
                </View>
                <View style={styles.top}>
                  <Text size={14} color={item.unread ? colors.textStrong : colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                    {last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : `Say hello to ${item.title}`}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text size={11} weight="bold" color={colors.white} lineHeight={14}>
                        {item.unread}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: GUTTER, paddingVertical: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.bgMuted },
  body: { flex: 1, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingBottom: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
