import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Acceleration (in g, gravity included) that counts as one jolt of a shake. */
const JOLT_G = 1.8;
/** Jolts needed inside the window, so walking or a dropped phone doesn't count. */
const JOLTS = 3;
const WINDOW_MS = 1200;
const COOLDOWN_MS = 3000;

/** Calls `onShake` when the phone is shaken firmly. Pass a stable function; does nothing where there is no accelerometer. */
export function useShake(onShake: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;
    const jolts: number[] = [];
    let last = 0;
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        // Browsers fire motion events at their own rate.
        if (Platform.OS !== 'web') Accelerometer.setUpdateInterval(80);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (Math.sqrt(x * x + y * y + z * z) < JOLT_G) return;
          const now = Date.now();
          jolts.push(now);
          while (jolts.length && now - jolts[0] > WINDOW_MS) jolts.shift();
          if (jolts.length >= JOLTS && now - last > COOLDOWN_MS) {
            last = now;
            jolts.length = 0;
            onShake();
          }
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, onShake]);
}
