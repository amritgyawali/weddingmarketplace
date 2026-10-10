import type { ImageContentPosition } from 'expo-image';
import { Photo } from '@/components/ui/Photo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Ornament } from '@/components/ui/Ornament';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photo, type PhotoKey } from '@/constants/images';
import { colors, gradients } from '@/constants/theme';
import { useT } from '@/i18n';

const SLIDES: { image: PhotoKey; credit: string; headline: string; focus: ImageContentPosition }[] = [
  {
    image: 'ideaCoupleGardenWalk',
    credit: 'Golden Hour Studio',
    headline: 'Venues and vendors across Nepal, with prices shown up front.',
    focus: { left: '50%', top: '40%' },
  },
  {
    image: 'ideaCeremonyHands',
    credit: 'Stardust Frames',
    headline: `Read ${BRAND.reviewCount} reviews from couples who booked before you.`,
    focus: { left: '55%', top: '50%' },
  },
  {
    image: 'ideaBrideParasol',
    credit: 'Candid Chronicles',
    headline: 'One quotation, one payment plan, one coordinator for the whole wedding.',
    focus: { left: '50%', top: '45%' },
  },
];

const AUTOPLAY_MS = 4500;

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 22 : 10, { duration: 200 }),
    backgroundColor: withTiming(active ? colors.gold : 'rgba(255,255,255,0.45)', { duration: 200 }),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function WelcomeCarousel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const tr = useT();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(1);
  const [interacting, setInteracting] = useState(false);
  // Reduce Motion starts it paused; the pause button stops it for anyone.
  const [paused, setPaused] = useState(reduced);

  // Auto-advance the carousel; pauses while the user is swiping or after they tap pause.
  useEffect(() => {
    if (interacting || paused) return;
    const id = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [index, interacting, paused, width]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    setInteracting(false);
  };

  const slide = SLIDES[index];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={1}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(s) => s.image}
        onScrollBeginDrag={() => setInteracting(true)}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <Photo
            source={photo(item.image)}
            style={{ width, height }}
            contentFit="cover"
            contentPosition={item.focus}
            transition={250}
          />
        )}
      />

      <LinearGradient
        colors={gradients.heroFade}
        locations={[0, 0.18, 0.42, 0.62, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />

      <View style={[styles.top, { paddingTop: insets.top + 14, pointerEvents: 'none' }]}>
        <View>
          <Text serif size={24} weight="bold" color={colors.white} lineHeight={32}>
            {BRAND.name}
          </Text>
          <Text serif size={13} color={colors.gold} lineHeight={18} raw>
            विवाह
          </Text>
        </View>
      </View>

      <View style={[styles.lang, { top: insets.top + 16 }]}>
        <LanguageSwitch compact />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Ornament width={72} style={styles.ornament} />
        <Animated.View key={index} entering={reduced ? undefined : FadeIn.duration(450)}>
          <Text serif size={24} lineHeight={34} weight="bold" color={colors.white} style={styles.headline} accessibilityLiveRegion={paused ? 'polite' : 'none'}>
            {slide.headline}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.actions}>
          <PressableScale
            haptic
            onPress={() => router.push('/welcome/role')}
            style={styles.primary}
            accessibilityLabel="Get started">
            <Text size={16} weight="semibold" color={colors.white}>
              Get started
            </Text>
          </PressableScale>

          <View style={styles.links}>
            <Pressable onPress={() => router.push('/welcome/role')} hitSlop={12} accessibilityRole="button">
              <Text size={15} weight="medium" color={colors.white}>
                Log in
              </Text>
            </Pressable>
            <View style={styles.sep} />
            <Pressable onPress={() => router.push('/join-wedding')} hitSlop={12} accessibilityRole="button">
              <Text size={15} weight="medium" color={colors.white}>
                I have an invite code
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <Dot key={s.image} active={i === index} />
            ))}
          </View>
          <Text size={12} color={colors.onWineMuted} numberOfLines={1} style={{ flex: 1 }}>
            Photo: {slide.credit}
          </Text>
          <Pressable
            onPress={() => setPaused((p) => !p)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tr(paused ? 'Play slideshow' : 'Pause slideshow')}
            style={({ pressed }) => [styles.pause, pressed && { opacity: 0.7 }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={14} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  lang: { position: 'absolute', right: 16, zIndex: 5 },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  headline: { marginBottom: 22, maxWidth: 380 },
  ornament: { marginBottom: 14 },
  actions: { alignItems: 'stretch', gap: 18 },
  primary: {
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  sep: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.45)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pause: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  dot: { height: 3, borderRadius: 2 },
});
