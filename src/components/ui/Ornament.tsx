import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

/**
 * A gilt divider drawn from the Dhaka weave: two fine rules meeting at a
 * chain of diamonds. Vivah's one ornament, kept to a few places (the
 * wedding band, the plan hero, the wedding website), never as wallpaper.
 */
export function Ornament({ width = 120, color = colors.gold, style }: { width?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const mid = width / 2;
  const line = { stroke: color, strokeWidth: 1, strokeLinecap: 'round' as const };
  return (
    <Svg width={width} height={12} viewBox={`0 0 ${width} 12`} style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={`M0 6 H${mid - 16} M${mid + 16} 6 H${width}`} {...line} />
      <Circle cx={mid - 16} cy={6} r={1.2} fill={color} />
      <Circle cx={mid + 16} cy={6} r={1.2} fill={color} />
      <Path d={`M${mid - 10} 3.5 L${mid - 7.5} 6 L${mid - 10} 8.5 L${mid - 12.5} 6 Z M${mid + 10} 3.5 L${mid + 12.5} 6 L${mid + 10} 8.5 L${mid + 7.5} 6 Z`} {...line} fill="none" />
      <Path d={`M${mid} 1 L${mid + 5} 6 L${mid} 11 L${mid - 5} 6 Z`} {...line} fill="none" />
      <Path d={`M${mid} 4 L${mid + 2} 6 L${mid} 8 L${mid - 2} 6 Z`} fill={color} />
    </Svg>
  );
}
