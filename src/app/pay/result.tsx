import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkOnlinePayment, onlinePaymentsReady, PAYMENT_STATE_TEXT, type PaymentState } from '@/backend/payments';
import { KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useSession } from '@/store/useSession';

const STATES = Object.keys(PAYMENT_STATE_TEXT) as PaymentState[];
const asState = (s?: string): PaymentState => (STATES.includes(s as PaymentState) ? (s as PaymentState) : 'unknown');

/**
 * Where Khalti and eSewa send the couple back to (through payment-verify,
 * which has already asked the gateway). The status in the link is only a hint:
 * a signed-in couple's attempt is checked again here.
 */
export default function PaymentResultScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intent?: string; status?: string; receipt?: string }>();
  const signedIn = useSession((s) => !!s.session);
  const canCheck = !!params.intent && signedIn && onlinePaymentsReady();
  // Checked again on arrival, and on "Check again".
  const checked = useQuery({
    queryKey: ['payment', params.intent],
    queryFn: async () => {
      const out = await checkOnlinePayment(params.intent!);
      if (!out.ok) throw new Error(out.error);
      return out.value;
    },
    enabled: canCheck,
    staleTime: 0,
    retry: false,
  });
  const busy = checked.isFetching;
  const state = checked.data?.status ?? asState(params.status);
  const receipt = checked.data?.receiptNo ?? params.receipt ?? null;
  const error = checked.error ? checked.error.message : null;

  const text = PAYMENT_STATE_TEXT[state];
  const good = state === 'completed' || state === 'refund_due';
  const waiting = state === 'pending' || state === 'initiated' || state === 'checking';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        {busy ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <Ionicons name={good ? 'checkmark-circle' : waiting ? 'time-outline' : 'close-circle-outline'} size={56} color={good ? colors.success : waiting ? colors.textMuted : colors.danger} />
        )}
        <Text size={22} weight="bold" color={colors.textStrong} align="center">
          {busy ? 'Checking with the gateway…' : text.title}
        </Text>
        {!busy && (
          <Text size={15} color={colors.textMuted} align="center">
            {text.body}
          </Text>
        )}
        {receipt && (
          <Text size={14} weight="semibold" color={colors.text}>
            Receipt {receipt}
          </Text>
        )}
        {error && (
          <Text size={13} color={colors.danger} align="center">
            {error}
          </Text>
        )}
      </View>
      <View style={{ gap: 10 }}>
        {waiting && signedIn && params.intent && <KButton label="Check again" icon="refresh" variant="secondary" onPress={() => checked.refetch()} disabled={busy} />}
        <KButton
          label={signedIn ? 'Back to payments' : 'Open Vivah'}
          onPress={() => (signedIn ? router.replace('/my-wedding?tab=payments') : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 24, justifyContent: 'space-between', maxWidth: 520, width: '100%', alignSelf: 'center' },
  body: { alignItems: 'center', gap: 12 },
});
