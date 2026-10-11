import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { reportError } from '@/backend/telemetry';
import { BRAND } from '@/constants/brand';
import { colors, themed } from '@/constants/theme';

/**
 * Shown when a screen throws while rendering. Reports the error once, then
 * offers to try again or go home. Plain React Native text on purpose: this can
 * render before the app fonts have loaded.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { handled: true, where: 'render' });
  }, [error]);

  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>Something went wrong on this screen</Text>
      <Text style={styles.body}>We’ve been told about it. Try again, or go back to the start. If it keeps happening, contact {BRAND.supportEmail}.</Text>
      <View style={styles.actions}>
        <Pressable onPress={retry} style={[styles.button, styles.primary]} accessibilityRole="button">
          <Text style={styles.primaryLabel}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} style={styles.button} accessibilityRole="button">
          <Text style={styles.label}>Go to the start</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.white },
  title: { fontSize: 20, fontWeight: '700', color: colors.heading },
  body: { fontSize: 15, lineHeight: 22, color: colors.textBody },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  button: { height: 44, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  primaryLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  label: { fontSize: 15, fontWeight: '600', color: colors.heading },
}));
