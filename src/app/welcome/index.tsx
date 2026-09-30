import { Image, type ImageContentPosition } from 'expo-image';
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
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos, type PhotoKey } from '@/constants/images';
import { colors, gradients } from '@/constants/theme';

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
    backgroundColor: withTiming(active ? colors.white : 'rgba(255,255,255,0.45)', { duration: 200 }),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function WelcomeCarousel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const [index, setIndex] = useState(1);
  const [interacting, setInteracting] = useState(false);

  // Auto-advance the carousel; pauses while the user is swiping.
  useEffect(() => {
    if (interacting) return;
    const id = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [index, interacting, width]);

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
          <Image
            source={photos[item.image]}
            style={{ width, height }}
            contentFit="cover"
            contentPosition={item.focus}
            transition={250}
          />
        )}
      />

      <LinearGradient
        pointerEvents="none"
        colors={gradients.heroFade}
        locations={[0, 0.18, 0.42, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={[styles.top, { paddingTop: insets.top + 14 }]}>
        <Text serif size={24} weight="bold" color={colors.white} lineHeight={32}>
          {BRAND.name}
        </Text>
        <Text size={12} color="rgba(255,255,255,0.7)">
          Photo: {slide.credit}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Animated.View key={index} entering={FadeIn.duration(450)}>
          <Text serif size={24} lineHeight={34} weight="bold" color={colors.white} style={styles.headline}>
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

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.image} active={i === index} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
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
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26 },
  dot: { height: 3, borderRadius: 2 },
});
