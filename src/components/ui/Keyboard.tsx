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
/** Room kept above the focused field when the form is pulled up to show its end. */
const TOP_ROOM = 12;

/**
 * Where to scroll so the focused field is visible and as much of the rest of
 * the form as fits, ideally down to its end (where the submit button is).
 * All values are in content coordinates; `view` is the height left above the
 * keyboard. Pure, so it can be reasoned about and tested on its own.
 */
export function revealTarget({ fieldTop, fieldBottom, contentHeight, view, current }: { fieldTop: number; fieldBottom: number; contentHeight: number; view: number; current: number }): number {
  // Lowest scroll that still shows the whole field, and highest that keeps its top on screen.
  const minY = Math.max(0, fieldBottom - view);
  const maxY = Math.max(minY, fieldTop - TOP_ROOM);
  // Scroll that puts the end of the form right above the keyboard.
  const endY = Math.max(0, contentHeight - view);
  // Never scroll back up past what is already shown, unless the field is above the view.
  const wanted = Math.min(Math.max(endY, minY), maxY);
  if (fieldTop < current) return Math.max(0, fieldTop - TOP_ROOM);
  return Math.max(current, wanted);
}

/**
 * ScrollView with keyboard-friendly defaults: taps on buttons work while the
 * keyboard is open (the first tap no longer just closes it), dragging closes
 * it, and when a field is focused the form scrolls so that field and as much
 * of the rest as fits (down to the submit button) sit above the keyboard. It
 * measures the space left on each device, so it adapts to any screen size.
 */
export const KeyboardAwareScrollView = forwardRef<RNScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { keyboardShouldPersistTaps = 'handled', keyboardDismissMode, onScroll, onLayout, onContentSizeChange, scrollEventThrottle, ...rest },
  ref,
) {
  const inner = useRef<RNScrollView>(null);
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const visible = useKeyboardStore((s) => s.visible);
  useImperativeHandle(ref, () => inner.current as RNScrollView);

  useEffect(() => {
    if (Platform.OS === 'web' || rest.horizontal || !visible) return;
    listen();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      const input = TextInput.State.currentlyFocusedInput?.();
      const scroll = inner.current;
      if (!input || !scroll) return;
      // Window coordinates work through animated wrappers and nested native views.
      input.measureLayout(scroll.getInnerViewNode() as never, () => scroll.getNativeScrollRef()?.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
        input.measureInWindow((_ix: number, iy: number, _iw: number, ih: number) => {
          const keyboard = useKeyboardStore.getState();
          const bottom = Math.min(sy + sh, keyboard.visible ? keyboard.top : sy + sh) - GAP;
          const fieldTop = offset.current + iy - sy;
          const y = revealTarget({ fieldTop, fieldBottom: fieldTop + ih, contentHeight: contentHeight.current, view: Math.max(0, bottom - sy), current: offset.current });
          if (Math.abs(y - offset.current) > 4) scroll.scrollTo({ y, animated: true });
        });
      }), () => {});
    };
    // Wait for the screen padding to settle before measuring.
    timer = setTimeout(reveal, Platform.OS === 'ios' ? 320 : 260);
    // Also reveal when focus changes while the keyboard is already open.
    let focused: unknown = null;
    const interval = setInterval(() => {
      const input = TextInput.State.currentlyFocusedInput?.();
      if (input !== focused && useKeyboardStore.getState().visible) { focused = input; clearTimeout(timer); timer = setTimeout(reveal, 80); }
    }, 160);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [rest.horizontal, visible]);

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
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        contentHeight.current = h;
        onContentSizeChange?.(w, h);
      }}
      {...rest}
    />
  );
});
