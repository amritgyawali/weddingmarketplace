import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { GenieAvatar } from '@/components/ui/GenieFab';
import { HeadsetIcon, SparklesIcon } from '@/components/ui/Icons';
import { PressableScale, triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, fonts, gradients, GUTTER, inputReset, radius, shadows } from '@/constants/theme';
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
  return <Image source={photos.assistantFace} style={styles.miniAvatar} contentFit="cover" />;
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
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </PressableScale>
        )}
        {!!reply.suggestions?.length && (
          <View style={styles.inlineSuggestions}>
            {reply.suggestions.map((s) => (
              <Pressable key={s} onPress={() => onSuggestion(s)} style={styles.inlineChip}>
                <Text size={13} weight="medium" color={colors.primary}>
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
        <View style={[styles.bubble, styles.bubbleAssistant, styles.greeting]}>
          <Text size={17} weight="semibold" color={colors.textStrong}>
            Hi ! I am {BRAND.assistantName}.
          </Text>
          <Text size={16} color={colors.textStrong}>
            How can I help you today?
          </Text>
        </View>
      </Animated.View>
      {messages.length === 0 && (
        <Animated.View entering={FadeInUp.duration(400).delay(150)} style={{ marginTop: 34 }}>
          <Text size={18} weight="semibold" color={colors.textStrong} style={{ marginBottom: 12 }}>
            Popular suggestions
          </Text>
          {POPULAR_SUGGESTIONS.map((s) => (
            <PressableScale key={s} onPress={() => send(s)} accessibilityLabel={s} style={styles.suggestion}>
              <SparklesIcon size={22} />
              <Text size={16} weight="medium" color={colors.textStrong} style={{ flexShrink: 1 }}>
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
      <LinearGradient colors={gradients.assistantBg} locations={[0, 0.12, 0.55, 1]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={28} color={colors.textStrong} />
        </Pressable>
        <GenieAvatar size={50} ring={2} />
        <View style={{ flex: 1 }}>
          <Text size={20} weight="medium" color={colors.textStrong} numberOfLines={1}>
            {BRAND.assistantTitle}
          </Text>
          <Text size={13} color={colors.textMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {BRAND.assistantSubtitle}
          </Text>
        </View>
        <PressableScale onPress={() => router.navigate('/genie')} accessibilityLabel="Talk to an expert" style={styles.expert}>
          <Text size={15} color={colors.textMuted}>
            Expert
          </Text>
          <HeadsetIcon size={18} />
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
          <View style={[styles.inputPill, shadows.card]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Question"
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
              style={[styles.send, { backgroundColor: canSend ? colors.primary : '#B8B9C6' }]}>
              <Ionicons name="paper-plane" size={20} color={colors.white} />
            </PressableScale>
          </View>
          <Text size={13} color={colors.textMuted} align="center" style={{ marginTop: 10 }}>
            {BRAND.assistantName} may make mistakes. Please verify key info.
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
    borderBottomColor: colors.hairline,
  },
  expert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  list: { paddingHorizontal: 12, paddingTop: 24, paddingBottom: 16, gap: 14 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#F9C4DC' },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '86%' },
  bubbleAssistant: { backgroundColor: colors.white, alignSelf: 'flex-start', ...shadows.pill },
  greeting: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24 },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#F7B3D2',
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginBottom: 12,
    maxWidth: '92%',
    ...shadows.pill,
  },
  cards: { gap: 10, paddingRight: 12 },
  cardShell: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 8, ...shadows.pill },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  inlineSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineChip: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#F7B3D2',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 5 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  composer: { paddingHorizontal: GUTTER - 4, paddingTop: 10, backgroundColor: 'rgba(250,247,253,0.9)' },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.textStrong,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
