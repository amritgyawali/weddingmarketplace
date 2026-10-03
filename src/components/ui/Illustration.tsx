import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

export type ArtName = 'mandap' | 'garland' | 'kalash' | 'diya' | 'rings';

/**
 * Small line drawings for empty states: a mandap, a marigold toran, a
 * kalash, a diya and a pair of rings. Burgundy lines with champagne
 * details, drawn on a 96-unit grid so they stay crisp at any size.
 */
export function Illustration({ name, size = 72 }: { name: ArtName; size?: number }) {
  const t = useRoleTheme();
  const ink = { stroke: t.c.primary, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const gilt = { ...ink, stroke: t.c.accent };
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'mandap' && (
        <>
          <Path d="M18 40 L48 20 L78 40 Z" {...ink} />
          <Path d="M24 40 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0" {...gilt} />
          <Path d="M26 46 V76 M70 46 V76" {...ink} />
          <Path d="M26 54 Q48 66 70 54" {...gilt} />
          <Path d="M16 82 H80 M22 82 V76 H74 V82" {...ink} />
          <Path d="M48 20 V11" {...ink} />
          <Circle cx={48} cy={9} r={2.5} {...gilt} />
          <Path d="M42 76 q6 3 12 0 M48 72 c-2 -3 -1 -6 0 -8 c1 2 2 5 0 8" {...gilt} />
        </>
      )}
      {name === 'garland' && (
        <>
          <Path d="M8 22 H88" {...ink} />
          <Path d="M10 22 q9.5 16 19 0 q9.5 16 19 0 q9.5 16 19 0 q9.5 16 19 0" {...gilt} />
          {[19.5, 38.5, 57.5, 76.5].map((x) => (
            <Path key={x} d={`M${x} 40 V58 M${x} 58 q-4 6 0 13 q4 -7 0 -13`} {...ink} />
          ))}
          {[19.5, 38.5, 57.5, 76.5].map((x) => (
            <Circle key={`f${x}`} cx={x} cy={35} r={4.5} {...ink} />
          ))}
          {[19.5, 38.5, 57.5, 76.5].map((x) => (
            <Circle key={`c${x}`} cx={x} cy={35} r={1.5} {...gilt} />
          ))}
        </>
      )}
      {name === 'kalash' && (
        <>
          <Path d="M30 52 C30 70 38 80 48 80 C58 80 66 70 66 52 C66 46 58 43 48 43 C38 43 30 46 30 52 Z" {...ink} />
          <Path d="M32 60 Q48 67 64 60" {...gilt} />
          <Path d="M39 43 V37 H57 V43 M34 37 H62" {...ink} />
          <Path d="M40 80 L37 87 H59 L56 80" {...ink} />
          <Path d="M47 36 q-13 -3 -19 -13 q11 2 19 13 M49 36 q13 -3 19 -13 q-11 2 -19 13 M48 35 q-6 -8 -4 -18 q6 8 4 18" {...gilt} />
          <Circle cx={48} cy={26} r={6} {...ink} />
        </>
      )}
      {name === 'diya' && (
        <>
          <Path d="M48 50 C42 43 45 35 48 26 C51 35 54 43 48 50 Z" {...gilt} />
          <Path d="M48 50 V56" {...gilt} />
          <Path d="M18 58 H74 Q69 74 46 74 Q24 74 18 58 Z" {...ink} />
          <Path d="M74 58 Q82 57 86 50" {...ink} />
          <Path d="M38 74 L35 83 H59 L56 74" {...ink} />
          <Path d="M26 64 Q46 70 66 64" {...gilt} />
        </>
      )}
      {name === 'rings' && (
        <>
          <Circle cx={39} cy={56} r={17} {...ink} />
          <Circle cx={57} cy={56} r={17} {...gilt} />
          <Path d="M39 39 l-5 -7 l5 -6 l5 6 Z" {...ink} />
          <Path d="M16 84 H80" {...gilt} />
        </>
      )}
    </Svg>
  );
}

/** Round pearl medallion with a champagne hairline: frames an empty state's icon or drawing. */
export function Medallion({ size = 88, children }: { size?: number; children: ReactNode }) {
  const t = useRoleTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.surfaceAlt, borderWidth: 1, borderColor: colors.goldLine, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}
