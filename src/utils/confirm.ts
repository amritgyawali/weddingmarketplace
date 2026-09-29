import { Alert, Platform } from 'react-native';

/**
 * Destructive-action confirmation that works everywhere: native alert on
 * iOS/Android, `window.confirm` on web (where Alert.alert is a no-op).
 */
export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
