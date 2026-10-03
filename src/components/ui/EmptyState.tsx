import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

import { Button } from './Button';
import { Illustration, Medallion, type ArtName } from './Illustration';
import { Text } from './Text';

/**
 * Empty, not-found and nothing-yet screens: a pearl medallion with an icon
 * (or one of the line drawings via `art`), a serif title, one short line and
 * at most one action.
 */
export function EmptyState({
  icon = 'albums-outline',
  art,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** A line drawing (mandap, garland, kalash, diya, rings) instead of the icon. */
  art?: ArtName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={{ marginBottom: 6 }}>
        <Medallion size={art ? 104 : 80}>{art ? <Illustration name={art} size={72} /> : <Ionicons name={icon} size={30} color={colors.primary} />}</Medallion>
      </View>
      <Text serif weight="bold" size={18} color={colors.heading} align="center">
        {title}
      </Text>
      {message && (
        <Text size={14} color={colors.textMuted} align="center" style={{ maxWidth: 300 }}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} size="sm" variant="outline" style={{ marginTop: 8, paddingHorizontal: 20 }} />
      )}
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn't load this"
      message={message ?? 'Check your connection, then try again.'}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
});
