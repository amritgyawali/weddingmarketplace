import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { BackButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, fonts, GUTTER, inputReset, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import { formatTime } from '@/utils/format';

const QUICK_REPLIES = ['Is my date available?', 'Please share your packages', 'Can we schedule a visit?'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const conversation = useAppStore((s) => s.conversations.find((c) => c.id === id));
  const sendMessage = useAppStore((s) => s.sendMessage);
  const markRead = useAppStore((s) => s.markRead);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const messageCount = conversation?.messages.length ?? 0;
  const unread = conversation?.unread ?? 0;

  useEffect(() => {
    if (unread) markRead(id);
  }, [id, unread, markRead]);

  if (!conversation) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState icon="chatbubble-outline" title="Conversation not found" actionLabel="Go to inbox" onAction={() => router.replace('/inbox')} />
      </View>
    );
  }

  const send = (value: string) => {
    if (!value.trim()) return;
    sendMessage(conversation.id, value);
    setText('');
  };

  const openProfile = () =>
    conversation.kind === 'venue'
      ? router.push({ pathname: '/venue/[id]', params: { id: conversation.refId } })
      : router.push({ pathname: '/vendor/[id]', params: { id: conversation.refId } });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <Pressable onPress={openProfile} style={styles.headerInfo} accessibilityRole="button">
          <Image source={photos[conversation.image]} style={styles.headerAvatar} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text size={16} weight="semibold" color={colors.heading} numberOfLines={1}>
              {conversation.title}
            </Text>
            <Text size={12} color={colors.success}>
              Usually replies within an hour
            </Text>
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={conversation.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, !messageCount && { flexGrow: 1, justifyContent: 'center' }]}
          onContentSizeChange={() => messageCount && listRef.current?.scrollToEnd({ animated: true })}
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" title={`Start chatting with ${conversation.title}`} message="Ask about availability, packages or a site visit." />
          }
          renderItem={({ item }) => (
            <Animated.View entering={FadeInDown.duration(220)} style={[styles.bubble, item.from === 'me' ? styles.mine : styles.theirs]}>
              <Text size={15} lineHeight={21} color={item.from === 'me' ? colors.white : colors.textStrong}>
                {item.text}
              </Text>
              <Text size={10} color={item.from === 'me' ? 'rgba(255,255,255,0.8)' : colors.textMuted} align="right" style={{ marginTop: 4 }}>
                {formatTime(item.at)}
              </Text>
            </Animated.View>
          )}
        />

        {!messageCount && (
          <View style={styles.quick}>
            {QUICK_REPLIES.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={styles.quickChip}>
                <Text size={13} weight="medium" color={colors.primary}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, inputReset]}
            multiline
            maxLength={1000}
          />
          <PressableScale
            onPress={() => send(text)}
            disabled={!text.trim()}
            accessibilityLabel="Send"
            style={[styles.send, { backgroundColor: text.trim() ? colors.primary : '#C9CAD3' }]}>
            <Ionicons name="send" size={18} color={colors.white} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F5F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER - 4,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  list: { padding: GUTTER - 4, gap: 8 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderBottomLeftRadius: 6 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: GUTTER - 4, paddingBottom: 10 },
  quickChip: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.white },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: GUTTER - 6,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textStrong,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
