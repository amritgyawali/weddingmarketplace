import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, shadow } from '@/constants/theme';
import { COUPLE_TOUR, type TourStep } from '@/data/tour';
import { useFeatures } from '@/hooks/useFeatures';
import { useHydrated } from '@/hooks/useHydrated';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useTour } from '@/store/useTour';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Elements a tour can point at, by id. The newest mount of an id wins. */
const targets = new Map<string, RefObject<View | null>>();

function measure(ref: RefObject<View | null> | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

/** Marks an element the tour can point at. Renders a plain wrapper view. */
export function TourTarget({ id, style, children }: { id: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    targets.set(id, ref);
    return () => {
      if (targets.get(id) === ref) targets.delete(id);
    };
  }, [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/** Starts the couple's tour the first time the screen that calls this is shown. */
export function useCoupleTourOnFirstVisit() {
  const hydrated = useHydrated(useTour);
  const seen = useTour((s) => s.seen.includes('couple'));
  const on = useFeatures();
  const enabled = hydrated && !seen && on('couple.tour');
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      // Let the screen lay out first so every target can be measured.
      const timer = setTimeout(() => useTour.getState().start('couple'), 700);
      return () => clearTimeout(timer);
    }, [enabled]),
  );
}

const PAD = 6;
const GAP = 12;
const SCRIM = 'rgba(28,14,12,0.62)';

interface Placed extends TourStep {
  rect: Rect | null;
}

/**
 * The couple's first-run tour: a dimmed screen with a window around one
 * feature and a small card that says what it does. Next, back and skip;
 * the last card offers to start a plan. Mounted once over the couple tabs.
 */
export function CoupleTour() {
  const running = useTour((s) => s.running === 'couple');
  const finish = useTour((s) => s.finish);
  const account = useAccount();
  const { project } = useCustomerWorkspace(account.id);
  const rootRef = useRef<View>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [steps, setSteps] = useState<Placed[] | null>(null);
  const [index, setIndex] = useState(0);

  // Measure every target when the tour opens and whenever the screen size changes.
  useEffect(() => {
    if (!running || !box.width) return;
    let cancelled = false;
    (async () => {
      const origin = (await measure(rootRef)) ?? { x: 0, y: 0 };
      const placed: Placed[] = [];
      for (const step of COUPLE_TOUR) {
        if (!step.target) {
          placed.push({ ...step, rect: null });
          continue;
        }
        const r = await measure(targets.get(step.target));
        if (r) placed.push({ ...step, rect: { ...r, x: r.x - origin.x, y: r.y - origin.y } });
      }
      if (!cancelled) setSteps(placed);
    })();
    return () => {
      cancelled = true;
    };
  }, [running, box.width, box.height]);

  if (!running) return null;

  const close = () => {
    finish();
    setIndex(0);
    setSteps(null);
  };
  const step = steps?.[Math.min(index, steps.length - 1)];
  const last = !!steps && index >= steps.length - 1;

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessibilityViewIsModal>
      {step && steps && (
        <>
          <Scrim rect={step.rect} box={box} />
          <Animated.View key={step.id} entering={FadeIn.duration(180)} style={[styles.card, cardPosition(step.rect, box)]}>
            {step.rect && <View style={[styles.arrow, arrowPosition(step.rect, box)]} />}
            <Text size={12} color={colors.textMuted}>
              {index + 1} of {steps.length}
            </Text>
            <Text size={18} weight="semibold" color={colors.heading} lineHeight={24}>
              {step.title}
            </Text>
            <Text size={15} color={colors.textBody} lineHeight={21}>
              {project && step.bodyWithPlan ? step.bodyWithPlan : step.body}
            </Text>
            <View style={styles.footer}>
              {!last && (
                <Pressable onPress={close} hitSlop={8} accessibilityRole="button" style={{ marginRight: 'auto' }}>
                  <Text size={14} color={colors.textMuted}>
                    Skip tour
                  </Text>
                </Pressable>
              )}
              {index > 0 && !last && <Button label="Back" variant="ghost" size="sm" onPress={() => setIndex(index - 1)} />}
              {!last && <Button label="Next" size="sm" onPress={() => setIndex(index + 1)} />}
              {last && !project && (
                <>
                  <Button label="Look around first" variant="ghost" size="sm" onPress={close} style={{ marginRight: 'auto' }} />
                  <Button
                    label="Start a plan"
                    size="sm"
                    onPress={() => {
                      close();
                      router.push('/plan');
                    }}
                  />
                </>
              )}
              {last && !!project && <Button label="Got it" size="sm" onPress={close} style={{ marginLeft: 'auto' }} />}
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

/** Dims everything except a window around the target, drawn as four panels so the target shows through. */
function Scrim({ rect, box }: { rect: Rect | null; box: { width: number; height: number } }) {
  if (!rect) return <View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} />;
  const top = Math.max(0, rect.y - PAD);
  const bottom = Math.min(box.height, rect.y + rect.height + PAD);
  const left = Math.max(0, rect.x - PAD);
  const right = Math.min(box.width, rect.x + rect.width + PAD);
  return (
    <>
      <View style={[styles.panel, { top: 0, left: 0, right: 0, height: top }]} />
      <View style={[styles.panel, { top: bottom, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.panel, { top, left: 0, width: left, height: bottom - top }]} />
      <View style={[styles.panel, { top, left: right, right: 0, height: bottom - top }]} />
      <View style={[styles.ring, { top, left, width: right - left, height: bottom - top, pointerEvents: 'none' }]} />
    </>
  );
}

const CARD_MAX = 340;

const cardWidth = (box: { width: number }) => Math.min(CARD_MAX, box.width - 32);

/** Below the target when it sits in the top half of the screen, above it otherwise; centred when there's none. */
function cardPosition(rect: Rect | null, box: { width: number; height: number }): ViewStyle {
  const width = cardWidth(box);
  if (!rect) return { width, left: (box.width - width) / 2, top: Math.max(24, box.height * 0.3) };
  const cx = rect.x + rect.width / 2;
  const left = Math.min(Math.max(16, cx - width / 2), box.width - width - 16);
  const below = rect.y + rect.height / 2 < box.height / 2;
  return below
    ? { width, left, top: rect.y + rect.height + PAD + GAP }
    : { width, left, bottom: box.height - rect.y + PAD + GAP };
}

/** A small diamond on the card's edge, lined up with the target's centre. */
function arrowPosition(rect: Rect, box: { width: number; height: number }): ViewStyle {
  const width = cardWidth(box);
  const cx = rect.x + rect.width / 2;
  const cardLeft = Math.min(Math.max(16, cx - width / 2), box.width - width - 16);
  const left = Math.min(Math.max(14, cx - cardLeft - 7), width - 28);
  const below = rect.y + rect.height / 2 < box.height / 2;
  return below ? { left, top: -7 } : { left, bottom: -7 };
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', backgroundColor: SCRIM },
  ring: { position: 'absolute', borderRadius: 10, borderWidth: 2, borderColor: colors.gold },
  card: {
    position: 'absolute',
    gap: 6,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.white,
    ...shadow(8, 0.18, 16, 6, '#000000'),
  },
  arrow: { position: 'absolute', width: 14, height: 14, backgroundColor: colors.white, transform: [{ rotate: '45deg' }] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
