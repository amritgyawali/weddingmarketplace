import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorMiniCard, VenueMiniCard } from '@/components/listing/MiniCards';
import { PressableScale, triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors, fonts, GUTTER, inputReset, radius } from '@/constants/theme';
import { askAssistant, POPULAR_SUGGESTIONS, type AssistantReply } from '@/services/assistant';
import { useAppStore } from '@/store/useAppStore';
import { uid } from '@/utils/format';

type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; reply: AssistantReply };

function TypingDots() {
  const dots = [useSharedValue(0.3), useSharedValue(0.3), useSharedValue(0.3)];
  useEffect(() => {
    dots.forEach((d, i) => {
      d.set(withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 })), -1)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const styles0 = useAnimatedStyle(() => ({ opacity: dots[0].get() }));
  const styles1 = useAnimatedStyle(() => ({ opacity: dots[1].get() }));
  const styles2 = useAnimatedStyle(() => ({ opacity: dots[2].get() }));
  return (
    <View style={styles.typing}>
      {[styles0, styles1, styles2].map((s, i) => (
        <Animated.View key={i} style={[styles.typingDot, s]} />
      ))}
    </View>
  );
}

function AssistantAvatar() {
  return (
    <View style={styles.miniAvatar}>
      <Text size={13} weight="bold" serif color={colors.primary} lineHeight={18}>
        V
      </Text>
    </View>
  );
}

function AssistantBubble({ reply, onSuggestion }: { reply: AssistantReply; onSuggestion: (s: string) => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.assistantRow}>
      <AssistantAvatar />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <Text size={15} color={colors.textStrong} lineHeight={22}>
            {reply.text}
          </Text>
        </View>
        {!!reply.venues?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {reply.venues.map((v) => (
              <View key={v.id} style={styles.cardShell}>
                <VenueMiniCard venue={v} width={180} />
              </View>
            ))}
          </ScrollView>
        )}
        {!!reply.vendors?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {reply.vendors.map((v) => (
              <View key={v.id} style={styles.cardShell}>
                <VendorMiniCard vendor={v} width={160} />
              </View>
            ))}
          </ScrollView>
        )}
        {reply.action && (
          <PressableScale onPress={() => router.push(reply.action!.href as Href)} style={styles.actionBtn} accessibilityLabel={reply.action.label}>
            <Text size={14} weight="semibold" color={colors.primary}>
              {reply.action.label}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </PressableScale>
        )}
        {!!reply.suggestions?.length && (
          <View style={styles.inlineSuggestions}>
            {reply.suggestions.map((s) => (
              <Pressable key={s} onPress={() => onSuggestion(s)} style={styles.inlineChip}>
                <Text size={13} color={colors.heading}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const city = useAppStore((s) => s.city);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const completedTasks = useAppStore((s) => s.completedTasks.length);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const mounted = useRef(true);

  useEffect(() => () => void (mounted.current = false), []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    triggerHaptic('light');
    setInput('');
    setMessages((m) => [...m, { id: uid('u'), role: 'user', text }]);
    setThinking(true);
    try {
      const reply = await askAssistant(text, { city, weddingDate, completedTasks });
      if (!mounted.current) return;
      setMessages((m) => [...m, { id: uid('a'), role: 'assistant', reply }]);
    } catch {
      if (!mounted.current) return;
      setMessages((m) => [
        ...m,
        { id: uid('a'), role: 'assistant', reply: { text: 'Sorry, I could not reach the server. Please try again.' } },
      ]);
    } finally {
      if (mounted.current) setThinking(false);
    }
  };

  const canSend = input.trim().length > 0 && !thinking;

  const intro = (
    <View>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.assistantRow}>
        <AssistantAvatar />
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <Text size={15} color={colors.textStrong} lineHeight={22}>
            Namaste. Ask about venues, vendors, prices or planning in your city and I’ll pull answers from our listings.
          </Text>
        </View>
      </Animated.View>
      {messages.length === 0 && (
        <Animated.View entering={FadeInUp.duration(300).delay(100)} style={{ marginTop: 24 }}>
          <Text size={13} color={colors.textMuted} style={{ marginBottom: 4, marginLeft: 4 }}>
            Try asking
          </Text>
          {POPULAR_SUGGESTIONS.map((s) => (
            <PressableScale key={s} onPress={() => send(s)} accessibilityLabel={s} style={styles.suggestion}>
              <Ionicons name="return-down-forward-outline" size={16} color={colors.textMuted} />
              <Text size={15} color={colors.textStrong} style={{ flexShrink: 1 }}>
                {s}
              </Text>
            </PressableScale>
          ))}
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textStrong} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text size={17} weight="semibold" color={colors.textStrong} numberOfLines={1}>
            {BRAND.assistantTitle}
          </Text>
          <Text size={12} color={colors.textMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {BRAND.assistantSubtitle}
          </Text>
        </View>
        <PressableScale onPress={() => router.navigate('/genie')} accessibilityLabel="Talk to a planner" style={styles.expert}>
          <Ionicons name="call-outline" size={15} color={colors.heading} />
          <Text size={14} weight="medium" color={colors.heading}>
            Talk to a planner
          </Text>
        </PressableScale>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={intro}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => messages.length && listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <Animated.View entering={FadeInDown.duration(250)} style={[styles.bubble, styles.bubbleUser]}>
                <Text size={15} color={colors.white} lineHeight={21}>
                  {item.text}
                </Text>
              </Animated.View>
            ) : (
              <AssistantBubble reply={item.reply} onSuggestion={send} />
            )
          }
          ListFooterComponent={
            thinking ? (
              <View style={styles.assistantRow}>
                <AssistantAvatar />
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputPill}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about venues, vendors or prices"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, inputReset]}
              multiline
              maxLength={500}
              onSubmitEditing={() => send(input)}
              submitBehavior="submit"
              returnKeyType="send"
            />
            <PressableScale
              onPress={() => send(input)}
              disabled={!canSend}
              accessibilityLabel="Send message"
              style={[styles.send, { backgroundColor: canSend ? colors.primary : colors.bgMuted }]}>
              <Ionicons name="arrow-up" size={20} color={canSend ? colors.white : colors.textSubtle} />
            </PressableScale>
          </View>
          <Text size={12} color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
            Answers are automatic and come from our listings. Check prices with the vendor before you book.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  expert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  list: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 16, gap: 14 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bubble: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '86%' },
  bubbleAssistant: { backgroundColor: colors.bgSoft, alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cards: { gap: 10, paddingRight: 12 },
  cardShell: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 8, borderWidth: 1, borderColor: colors.border },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  inlineSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineChip: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 5 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  composer: { paddingHorizontal: GUTTER - 4, paddingTop: 10, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textStrong,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
  },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
