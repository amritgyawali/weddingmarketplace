import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';

/** "Minimum 10, maximum 1000 characters", or null when the field has no limits. */
export function lengthRule(minLength?: number, maxLength?: number): string | null {
  if (minLength && maxLength) return `Minimum ${minLength}, maximum ${maxLength} characters`;
  if (maxLength) return `Up to ${maxLength} characters`;
  if (minLength) return `At least ${minLength} characters`;
  return null;
}

/**
 * The line under a text field: the error if there is one, else the hint,
 * else the allowed length; with a live "12 / 1000" count on the right when
 * the field has a maximum, so a description never gets cut off by surprise.
 */
export function FieldNote({
  error,
  hint,
  length,
  minLength,
  maxLength,
  tone,
}: {
  error?: string | null;
  hint?: string;
  length: number;
  minLength?: number;
  maxLength?: number;
  tone: { danger: string; muted: string; warning: string };
}) {
  const rule = lengthRule(minLength, maxLength);
  const left = error || hint || rule;
  if (!left && !maxLength) return null;
  const short = !!minLength && length > 0 && length < minLength;
  return (
    <View style={styles.row}>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={tone.danger} />
          <Text size={12} color={tone.danger} style={{ flexShrink: 1 }}>
            {error}
          </Text>
        </View>
      ) : (
        <Text size={12} color={tone.muted} style={{ flex: 1 }}>
          {hint && rule ? `${hint} · ${rule}` : left}
        </Text>
      )}
      {!!maxLength && (
        <Text size={12} numeric color={short ? tone.warning : length >= maxLength ? tone.danger : tone.muted} accessibilityLabel={`${length} of ${maxLength} characters`}>
          {length} / {maxLength}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  error: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
