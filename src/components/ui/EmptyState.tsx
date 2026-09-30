import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon = 'albums-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={34} color={colors.textSubtle} style={{ marginBottom: 4 }} />
      <Text weight="semibold" size={17} color={colors.heading} align="center">
        {title}
      </Text>
      {message && (
        <Text size={14} color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
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
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
});
