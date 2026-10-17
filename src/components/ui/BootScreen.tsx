import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { splashColors } from '@/constants/theme';
import { tr } from '@/i18n/runtime';

import { Loader } from './Loader';

const MARK = require('@/assets/images/splash-icon.png');

/** How long the plain splash shows before the loader appears (a fast start never sees it). */
const LOADER_DELAY_MS = 300;
/** After this, a line says the app is still getting ready (a slow phone or a big saved database). */
const SLOW_MS = 4000;

/**
 * What the app shows while it starts: fonts load and the saved data is
 * restored from the device. It looks exactly like the native splash
 * (burgundy, the Vivah mark at 120 px), then adds the three-dot loader if
 * start-up takes longer than a blink. Rendered before the fonts are loaded,
 * so it uses the system font (and `tr`, which knows the language once the
 * preferences are restored).
 */
export function BootScreen({ onReady }: { onReady?: () => void }) {
  const [phase, setPhase] = useState<'mark' | 'loading' | 'slow'>('mark');
  useEffect(() => {
    const loading = setTimeout(() => setPhase('loading'), LOADER_DELAY_MS);
    const slow = setTimeout(() => setPhase('slow'), SLOW_MS);
    return () => {
      clearTimeout(loading);
      clearTimeout(slow);
    };
  }, []);
  return (
    <View style={styles.root} onLayout={onReady} accessibilityRole="progressbar" accessibilityLabel={tr('Loading Vivah')}>
      <Image source={MARK} style={styles.mark} contentFit="contain" transition={0} />
      <View style={styles.below}>
        {phase !== 'mark' && <Loader size={9} color={splashColors.dot} />}
        {phase === 'slow' && <Text style={styles.note}>{tr('Getting your app ready…')}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: splashColors.bg },
  mark: { width: 120, height: 120 },
  // Absolutely placed under the centred mark, so the mark never moves when the loader appears.
  below: { position: 'absolute', top: '50%', marginTop: 92, alignItems: 'center', gap: 14, left: 0, right: 0 },
  note: { color: splashColors.text, fontSize: 14 },
});
