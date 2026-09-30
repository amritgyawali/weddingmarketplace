import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

/** The fields payment-initiate signs; nothing else is passed on to eSewa. */
const FIELDS = [
  'amount',
  'tax_amount',
  'total_amount',
  'transaction_uuid',
  'product_code',
  'product_service_charge',
  'product_delivery_charge',
  'success_url',
  'failure_url',
  'signed_field_names',
  'signature',
] as const;

/** Only eSewa's own form endpoints. */
const isEsewa = (action?: string) => {
  try {
    const u = new URL(action ?? '');
    return u.protocol === 'https:' && (u.hostname === 'epay.esewa.com.np' || u.hostname === 'rc-epay.esewa.com.np') && u.pathname === '/api/epay/main/v2/form';
  } catch {
    return false;
  }
};

/**
 * eSewa only accepts a form POST, which a phone can't open as a link. The app
 * opens this web page instead, with the form payment-initiate signed; the page
 * posts it straight on to eSewa.
 */
export default function EsewaCheckoutScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const error =
    Platform.OS !== 'web'
      ? 'Open this payment in your browser.'
      : !isEsewa(params.action) || FIELDS.some((f) => typeof params[f] !== 'string')
        ? 'This payment link is incomplete. Start the payment again from the app.'
        : null;

  useEffect(() => {
    if (error) return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = params.action!;
    for (const name of FIELDS) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = params[name]!;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }, [error, params]);

  return (
    <View style={styles.root}>
      {error ? (
        <Text size={15} color={colors.danger} align="center">
          {error}
        </Text>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text size={15} color={colors.textMuted}>
            Opening eSewa…
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: colors.white },
});
