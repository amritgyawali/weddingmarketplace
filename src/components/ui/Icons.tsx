import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

interface IconProps {
  size?: number;
  color?: string;
}

/** Magic lamp used for the GENIE tab and the Genie action on listings. */
export function GenieLampIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1.8 10.2c1.9-.2 3.5.6 4.8 1.9h10.3c.9-1.1 2.3-1.8 3.9-1.8.5 0 .9.4.8.9-.5 2.7-2.7 4.8-5.5 5.2H10c-2.7 0-5.2-1.6-6.5-4l-1.7-2.2z"
        fill={color}
      />
      <Path d="M8.6 12.1c.5-2 2.3-3.4 4.4-3.4 2.1 0 3.9 1.4 4.4 3.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={13} cy={6.9} r={1.3} fill={color} />
      <Path d="M9.2 19.4h7.6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M11.5 16.4l-.6 3M14.6 16.4l.6 3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Four-point sparkle (✦). */
export function SparkleIcon({ size = 14, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0c.8 6.3 5.7 11.2 12 12-6.3.8-11.2 5.7-12 12-.8-6.3-5.7-11.2-12-12C6.3 11.2 11.2 6.3 12 0z" fill={color} />
    </Svg>
  );
}

/** Double sparkle used in the assistant suggestion pills. */
export function SparklesIcon({ size = 22, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.5 3c.6 4.3 3.3 7 7.5 7.5-4.2.6-6.9 3.3-7.5 7.5-.6-4.2-3.3-6.9-7.5-7.5C6.2 10 8.9 7.3 9.5 3z" fill={color} />
      <Path d="M18 13.5c.3 2.1 1.4 3.2 3.5 3.5-2.1.3-3.2 1.4-3.5 3.5-.3-2.1-1.4-3.2-3.5-3.5 2.1-.3 3.2-1.4 3.5-3.5z" fill={color} />
      <Path d="M17.5 2c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2z" fill={color} />
    </Svg>
  );
}

/** Orange ribbon with a crown — the "featured" badge on venue cards. */
export function CrownRibbon({ size = 28 }: { size?: number }) {
  const h = size * 1.15;
  return (
    <Svg width={size} height={h} viewBox="0 0 28 32">
      <Path d="M0 0h28v32l-14-6-14 6z" fill={colors.crown} />
      <Path d="M6.5 17.5 5 8.5l5 4 4-6 4 6 5-4-1.5 9z" fill={colors.white} />
      <Path d="M6.8 19.5h14.4v2H6.8z" fill={colors.white} />
    </Svg>
  );
}

/** Two stacked profile cards — illustration on the "shortlisted vendors" tool card. */
export function ShortlistIllustration({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.82} viewBox="0 0 72 59">
      <Path d="M8 6a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="#DCE5F4" />
      <Circle cx={20} cy={14} r={5} fill="#A9BFE6" />
      <Path d="M12 30c1-5 4.6-8 8-8s7 3 8 8" fill="#A9BFE6" />
      <Path d="M24 18a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v33a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4z" fill="#EEF3FB" stroke="#fff" strokeWidth={2} />
      <Circle cx={46} cy={30} r={6.5} fill="#7E9FD9" />
      <Path d="M35 50c1.5-7 6-10.5 11-10.5S55.5 43 57 50" fill="#7E9FD9" />
      <Path d="M8 44h18M8 49h12" stroke="#3A4F7A" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M34 55h22" stroke="#3A4F7A" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Headset — the "Expert" button on the assistant header. */
export function HeadsetIcon({ size = 18, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 14v-2a8 8 0 1 1 16 0v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M4 14h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM20 14h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z" stroke={color} strokeWidth={1.8} />
      <Path d="M18 19.5c0 1.4-1.8 2-4 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Brand mark shown on the welcome screen (two interlocked rings). */
export function RingsMark({ size = 26, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx={12} cy={18} r={8} stroke={color} strokeWidth={2.2} />
      <Circle cx={20} cy={18} r={8} stroke={color} strokeWidth={2.2} />
      <Path d="M12 5.5l2.2 2.3L12 10 9.8 7.8z" fill={color} />
    </Svg>
  );
}
