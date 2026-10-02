/**
 * Keeps the field being typed in above the on-screen keyboard.
 *
 * Expo SDK 57 draws edge to edge on Android, so the window no longer resizes
 * when the keyboard opens and it covers the bottom of the screen. Every
 * screen is wrapped in `KeyboardLift` (through each navigator's
 * `screenLayout`), which pads the screen by exactly the part the keyboard
 * hides, animated with the keyboard. `KeyboardAwareScrollView` then scrolls
 * the focused input into the space that is left.
 */
import { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView as RNScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

interface KeyboardState {
  visible: boolean;
  /** Top edge of the keyboard in window coordinates. */
  top: number;
  duration: number;
}

const useKeyboardStore = create<KeyboardState>(() => ({ visible: false, top: 0, duration: 250 }));

let listening = false;
function listen() {
  if (listening || Platform.OS === 'web') return;
  listening = true;
  Keyboard.addListener(SHOW, (e: KeyboardEvent) =>
    useKeyboardStore.setState({ visible: true, top: e.endCoordinates.screenY, duration: e.duration || 220 }),
  );
  Keyboard.addListener(HIDE, (e: KeyboardEvent) => useKeyboardStore.setState({ visible: false, top: 0, duration: e?.duration || 200 }));
}

/** True while the on-screen keyboard is open (always false on web). */
export function useKeyboardVisible() {
  listen();
  return useKeyboardStore((s) => s.visible);
}

const LiftContext = createContext(false);

/**
 * Pads its bottom by the height of the keyboard that overlaps it. Nested
 * lifts do nothing, so wrapping a navigator and its screens is safe. Content
 * in a Modal is a separate window: pass `isolated` there.
 */
export function KeyboardLift({ children, style, isolated }: { children: ReactNode; style?: StyleProp<ViewStyle>; isolated?: boolean }) {
  const nested = useContext(LiftContext) && !isolated;
  const ref = useRef<View>(null);
  const pad = useSharedValue(0);
  const visible = useKeyboardStore((s) => s.visible);
  const top = useKeyboardStore((s) => s.top);
  const duration = useKeyboardStore((s) => s.duration);
  const animated = useAnimatedStyle(() => ({ paddingBottom: pad.get() }));

  useEffect(() => {
    listen();
  }, []);

  useEffect(() => {
    if (nested || Platform.OS === 'web') return;
    const timing = { duration, easing: Easing.out(Easing.cubic) };
    if (!visible) {
      pad.set(withTiming(0, timing));
      return;
    }
    ref.current?.measureInWindow((_x, y, _w, h) => {
      // Padding shrinks the content, not the view, so y + h is the screen's real bottom.
      pad.set(withTiming(Math.max(0, y + h - top), timing));
    });
  }, [nested, visible, top, duration, pad]);

  if (nested || Platform.OS === 'web') return <View style={[{ flex: 1 }, style]}>{children}</View>;
  return (
    <LiftContext.Provider value>
      <Animated.View ref={ref} collapsable={false} style={[{ flex: 1 }, style, animated]}>
        {children}
      </Animated.View>
    </LiftContext.Provider>
  );
}

/** Navigator groups whose own screens are lifted; the group itself is not. */
const GROUPS = new Set(['(tabs)', 'welcome', 'onboarding', 'business', 'freelancer', 'platform']);

/** `screenLayout` for Stack and Tabs navigators: lifts every leaf screen above the keyboard. */
export function keyboardScreenLayout({ route, children }: { route: { name: string }; children: ReactNode }) {
  if (GROUPS.has(route.name)) return <>{children}</>;
  return <KeyboardLift>{children}</KeyboardLift>;
}

/** Breathing room kept between the focused field and the keyboard. */
const GAP = 24;

/**
 * ScrollView with keyboard-friendly defaults: taps on buttons work while the
 * keyboard is open (the first tap no longer just closes it), dragging closes
 * it, and the focused input scrolls into view when the keyboard opens.
 */
export const KeyboardAwareScrollView = forwardRef<RNScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { keyboardShouldPersistTaps = 'handled', keyboardDismissMode, onScroll, onLayout, scrollEventThrottle, ...rest },
  ref,
) {
  const inner = useRef<RNScrollView>(null);
  const offset = useRef(0);
  const height = useRef(0);
  useImperativeHandle(ref, () => inner.current as RNScrollView);

  useEffect(() => {
    if (Platform.OS === 'web' || rest.horizontal) return;
    listen();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      const input = TextInput.State.currentlyFocusedInput?.();
      const scroll = inner.current;
      if (!input || !scroll) return;
      const host = (scroll as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.() ?? scroll.getInnerViewNode();
      if (!host) return;
      // measureLayout fails (and we do nothing) when the input is not inside this scroll view.
      input.measureLayout(
        host as never,
        (_x: number, y: number, _w: number, h: number) => {
          const visibleTop = offset.current;
          const visibleBottom = offset.current + height.current - GAP;
          if (y + h > visibleBottom) scroll.scrollTo({ y: Math.max(0, y + h - height.current + GAP), animated: true });
          else if (y < visibleTop) scroll.scrollTo({ y: Math.max(0, y - GAP), animated: true });
        },
        () => {},
      );
    };
    // Wait for the screen padding to settle before measuring.
    const sub = Keyboard.addListener(SHOW, () => {
      clearTimeout(timer);
      timer = setTimeout(reveal, Platform.OS === 'ios' ? 320 : 260);
    });
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [rest.horizontal]);

  return (
    <RNScrollView
      ref={inner}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
      scrollEventThrottle={scrollEventThrottle ?? 32}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
        onLayout?.(e);
      }}
      {...rest}
    />
  );
});
