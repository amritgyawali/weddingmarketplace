import { useState } from 'react';
import { type GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useRoleTheme } from '@/theme/RoleTheme';

/** Finger/mouse signature capture; returns an SVG path string. */
export function SignaturePad({ onDone, height = 180 }: { onDone: (path: string) => void; height?: number }) {
  const t = useRoleTheme();
  const [ink, setInk] = useState<{ paths: string[]; current: string }>({ paths: [], current: '' });
  const pt = (e: GestureResponderEvent) => `${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`;

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const p = pt(e);
        setInk((s) => ({ ...s, current: `M${p}` }));
      },
      onPanResponderMove: (e) => {
        const p = pt(e);
        setInk((s) => ({ ...s, current: `${s.current} L${p}` }));
      },
      onPanResponderRelease: () => setInk((s) => ({ paths: s.current.includes('L') ? [...s.paths, s.current] : s.paths, current: '' })),
    }),
  );

  const paths = ink.paths;
  const all = [...paths, ink.current].filter(Boolean);

  return (
    <View style={{ gap: 10 }}>
      <View {...responder.panHandlers} style={[styles.pad, { height, borderColor: t.c.border, backgroundColor: t.dark ? t.c.surfaceAlt : '#FFFCF8' }]}>
        <Svg width="100%" height="100%">
          {all.map((d, i) => (
            <Path key={i} d={d} stroke="#251B18" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {!all.length && (
          <View style={[styles.hint, { pointerEvents: 'none' }]}>
            <Text size={13} color={t.c.subtle}>
              Sign here with your finger
            </Text>
          </View>
        )}
        <View style={[styles.line, { backgroundColor: t.c.border, pointerEvents: 'none' }]} />
      </View>
      <View style={styles.row}>
        <KButton label="Clear" variant="ghost" size="sm" onPress={() => setInk({ paths: [], current: '' })} style={{ flex: 1 }} />
        <KButton label="Sign" icon="create" size="sm" disabled={!paths.length} onPress={() => onDone(paths.join(' '))} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

/** Render a stored signature path. */
export function SignatureImage({ path, height = 60 }: { path: string; height?: number }) {
  return (
    <View style={{ height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 340 ${height * 3}`} preserveAspectRatio="xMidYMid meet">
        <Path d={path} stroke="#251B18" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  hint: { position: 'absolute', top: '42%', alignSelf: 'center' },
  line: { position: 'absolute', left: 20, right: 20, bottom: 36, height: 1 },
  row: { flexDirection: 'row', gap: 8 },
});
