import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { checkOnlinePayment, isOnlineGateway, onlinePaymentsReady, PAYMENT_STATE_TEXT, type PaymentState, SANDBOX_HINT, startOnlinePayment } from '@/backend/payments';
import { Card, KButton, KField, ProgressBar, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ENV } from '@/constants/env';
import { receiptHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { milestoneStatus, paymentSummary } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { PaymentMethod, PaymentMilestone, Project } from '@/types/platform';
import { formatMoney, formatShortDate, relativeDay } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; sub: string; color: string; icon: string; staffOnly?: boolean }[] = [
  { id: 'esewa', label: 'eSewa', sub: 'Wallet · instant', color: '#60BB46', icon: 'wallet' },
  { id: 'khalti', label: 'Khalti', sub: 'Wallet · instant', color: '#5C2D91', icon: 'wallet' },
  { id: 'fonepay', label: 'Fonepay QR', sub: 'Scan with any bank app', color: '#C8102E', icon: 'qr-code' },
  { id: 'connect_ips', label: 'ConnectIPS', sub: 'Direct from your bank', color: '#0C4DA2', icon: 'business' },
  { id: 'ime_pay', label: 'IME Pay', sub: 'Wallet', color: '#E31E24', icon: 'phone-portrait' },
  { id: 'card', label: 'Visa / Mastercard', sub: 'Debit or credit card', color: '#1A1F71', icon: 'card' },
  { id: 'bank_transfer', label: 'Bank transfer', sub: 'NIBL · A/C 0101 5500 1234', color: '#475569', icon: 'swap-horizontal' },
  { id: 'cash', label: 'Cash (at office)', sub: 'Recorded by your coordinator', color: '#16A34A', icon: 'cash', staffOnly: true },
];

/**
 * Paying a milestone. The demo simulates the Nepali gateways (eSewa, Khalti,
 * Fonepay QR, ConnectIPS…). With `online` (Supabase builds, couples) Khalti and
 * eSewa are real: the gateway opens, and the payment counts only once
 * payment-verify has confirmed it with the gateway (master plan §7.5).
 */
export function PaymentSheet({
  visible,
  title,
  amount,
  allowPartial,
  staff,
  online,
  onClose,
  onPay,
}: {
  visible: boolean;
  title: string;
  amount: number;
  allowPartial?: boolean;
  staff?: boolean;
  /** Real Khalti and eSewa payments for this milestone. */
  online?: { milestoneId: string };
  onClose: () => void;
  onPay: (method: PaymentMethod, amount: number) => void;
}) {
  const t = useRoleTheme();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState<'choose' | 'confirm' | 'processing' | 'gateway' | 'done'>('choose');
  const [custom, setCustom] = useState('');
  const [intent, setIntent] = useState<string | null>(null);
  const [gatewayState, setGatewayState] = useState<PaymentState | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payAmount = allowPartial && Number(custom) > 0 ? Math.min(amount, Number(custom)) : amount;
  const m = PAYMENT_METHODS.find((x) => x.id === method);
  const methods = online ? PAYMENT_METHODS.filter((x) => isOnlineGateway(x.id)) : PAYMENT_METHODS.filter((x) => staff || !x.staffOnly);

  const close = () => {
    setStep('choose');
    setMethod(null);
    setCustom('');
    setIntent(null);
    setGatewayState(null);
    setReceipt(null);
    setError(null);
    onClose();
  };

  const checkGateway = async () => {
    if (!intent) return;
    setError(null);
    setStep('processing');
    const out = await checkOnlinePayment(intent);
    if (!out.ok) {
      setError(out.error);
      return setStep('gateway');
    }
    setGatewayState(out.value.status);
    if (out.value.status === 'completed') {
      setReceipt(out.value.receiptNo);
      triggerHaptic('success');
      return setStep('done');
    }
    setStep('gateway');
  };

  const pay = async () => {
    setError(null);
    if (online && method && isOnlineGateway(method)) {
      setStep('processing');
      const started = await startOnlinePayment(online.milestoneId, method, payAmount < amount ? payAmount : undefined);
      if (!started.ok) {
        setError(started.error);
        return setStep('confirm');
      }
      setIntent(started.value.intent);
      setGatewayState(null);
      return setStep('gateway');
    }
    setStep('processing');
    await new Promise((r) => setTimeout(r, 1300));
    onPay(method!, payAmount);
    triggerHaptic('success');
    setStep('done');
  };

  return (
    <Sheet visible={visible} onClose={close} title={step === 'done' ? 'Payment successful' : title}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {step === 'choose' && (
          <>
            <View style={[styles.amountBox, { backgroundColor: t.c.soft }]}>
              <Text size={12} weight="semibold" color={t.c.muted}>
                Amount due
              </Text>
              <Text size={26} weight="bold" color={t.c.textStrong}>
                {formatMoney(payAmount)}
              </Text>
            </View>
            {allowPartial && <KField label="Pay a different amount (optional)" value={custom} onChangeText={(v) => setCustom(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" placeholder={String(amount)} />}
            {methods.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => {
                  setMethod(x.id);
                  setStep('confirm');
                }}
                style={({ pressed }) => [styles.method, { borderColor: t.c.border, opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Pay with ${x.label}`}>
                <View style={[styles.methodIcon, { backgroundColor: x.color }]}>
                  <Ionicons name={x.icon as never} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="semibold" color={t.c.textStrong}>
                    {x.label}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {x.sub}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.c.subtle} />
              </Pressable>
            ))}
            {online && (
              <Text size={12} color={t.c.muted}>
                Fonepay, ConnectIPS and cards are coming soon. For a bank transfer, ask your coordinator.
              </Text>
            )}
            <View style={styles.secure}>
              <Ionicons name="shield-checkmark" size={14} color={t.c.success} />
              <Text size={12} color={t.c.muted}>
                Held in escrow by Vivah — released to providers only per your schedule.
              </Text>
            </View>
          </>
        )}
        {step === 'confirm' && m && (
          <>
            <View style={[styles.gateway, { backgroundColor: m.color }]}>
              <Ionicons name={m.icon as never} size={26} color="#fff" />
              <Text size={18} weight="bold" color="#fff">
                {m.label}
              </Text>
              <Text size={24} weight="bold" color="#fff">
                {formatMoney(payAmount)}
              </Text>
            </View>
            {method === 'fonepay' && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8 }}>
                  <QRCode value={`fonepay://pay?merchant=VIVAH&amount=${payAmount}&ref=${title.replace(/\s+/g, '-')}`} size={170} />
                </View>
                <Text size={12} color={t.c.muted}>
                  Scan with Nabil, NIC Asia, Global IME or any Fonepay app
                </Text>
              </View>
            )}
            {method === 'bank_transfer' && (
              <Card style={{ gap: 4 }}>
                <Text size={13} color={t.c.text}>
                  Nabil Bank · Vivah Weddings Pvt. Ltd.{'\n'}A/C 0101 5500 1234 · Branch: New Baneshwor{'\n'}Remarks: {title}
                </Text>
              </Card>
            )}
            {online && isOnlineGateway(m.id) && (
              <Text size={13} color={t.c.muted}>
                {m.label} opens to take the payment. Come back here when you’ve paid.
                {ENV.paymentMode === 'sandbox' ? ` ${SANDBOX_HINT[m.id]}` : ''}
              </Text>
            )}
            {error && (
              <Text size={13} color={t.c.danger}>
                {error}
              </Text>
            )}
            {!online && (method === 'esewa' || method === 'khalti' || method === 'ime_pay') && <KField label={`${m.label} ID / mobile`} placeholder="98XXXXXXXX" keyboardType="phone-pad" />}
            {method === 'card' && <KField label="Card number" placeholder="4111 1111 1111 1111" keyboardType="number-pad" />}
            <KButton
              label={online ? `Continue to ${m.label}` : method === 'bank_transfer' || method === 'fonepay' || method === 'cash' ? 'I’ve paid — confirm' : `Pay ${formatMoney(payAmount)}`}
              icon={online ? 'open-outline' : 'lock-closed'}
              onPress={pay}
            />
            <KButton label="Choose another method" variant="ghost" size="sm" onPress={() => setStep('choose')} />
          </>
        )}
        {step === 'processing' && (
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 30 }}>
            <ActivityIndicator size="large" color={t.c.primary} />
            <Text size={14} color={t.c.muted}>
              Confirming with {m?.label}…
            </Text>
          </View>
        )}
        {step === 'gateway' && m && (
          <View style={{ gap: 12, paddingVertical: 8 }}>
            <Text size={16} weight="semibold" color={t.c.textStrong}>
              {gatewayState ? PAYMENT_STATE_TEXT[gatewayState].title : `Finish paying in ${m.label}`}
            </Text>
            <Text size={13} color={t.c.muted}>
              {gatewayState ? PAYMENT_STATE_TEXT[gatewayState].body : `When ${m.label} is done you’ll come back here. If you don’t, check the payment below; you won’t be charged twice.`}
            </Text>
            {error && (
              <Text size={13} color={t.c.danger}>
                {error}
              </Text>
            )}
            <KButton label="Check payment" icon="refresh" onPress={checkGateway} />
            {(gatewayState === 'failed' || gatewayState === 'cancelled' || gatewayState === 'expired') && <KButton label="Try again" variant="secondary" onPress={() => setStep('confirm')} />}
            <KButton label="Close" variant="ghost" size="sm" onPress={close} />
          </View>
        )}
        {step === 'done' && (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
            <Ionicons name="checkmark-circle" size={64} color={t.c.success} />
            <Text size={22} weight="bold" color={t.c.textStrong}>
              {formatMoney(payAmount)}
            </Text>
            <Text size={14} color={t.c.muted} align="center">
              {online ? `Paid via ${m?.label}. Receipt ${receipt ?? ''} is in your payments and your email.` : `Paid via ${m?.label}. Your receipt is saved under Files → Invoices.`}
            </Text>
            <KButton label="Done" onPress={close} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

function MilestoneRow({ m, mode, onPay }: { m: PaymentMilestone; mode: 'customer' | 'platform' | 'vendor'; onPay: () => void }) {
  const t = useRoleTheme();
  const status = milestoneStatus(m);
  const outstanding = m.amount - m.paidAmount;
  return (
    <Card style={{ gap: 8, borderColor: status === 'OVERDUE' ? t.c.danger : t.c.border }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {m.label}
            {m.percent ? ` · ${m.percent}%` : ''}
          </Text>
          <Text size={12} color={status === 'OVERDUE' ? t.c.danger : t.c.muted}>
            {status === 'PAID' ? 'Paid in full' : `Due ${formatShortDate(m.due)} · ${relativeDay(m.due)}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            {formatMoney(m.amount)}
          </Text>
          <StatusPill status={status} />
        </View>
      </View>
      {m.paidAmount > 0 && status !== 'PAID' && (
        <View style={{ gap: 4 }}>
          <ProgressBar value={m.paidAmount / m.amount} />
          <Text size={12} color={t.c.muted}>
            {formatMoney(m.paidAmount)} paid · {formatMoney(outstanding)} remaining
          </Text>
        </View>
      )}
      {status !== 'PAID' && status !== 'WAIVED' && mode !== 'vendor' && (
        <KButton label={mode === 'customer' ? `Pay ${formatMoney(outstanding)}` : 'Record payment'} size="sm" variant={mode === 'customer' ? 'primary' : 'secondary'} icon={mode === 'customer' ? 'card-outline' : 'add'} onPress={onPay} />
      )}
    </Card>
  );
}

/** Customer payment milestones, receipts and refunds for a project. */
export function PaymentsPanel({ project, mode }: { project: Project; mode: 'customer' | 'platform' | 'vendor' }) {
  const t = useRoleTheme();
  const account = useAccount();
  const payMilestone = useDb((s) => s.payMilestone);
  const requestRefund = useDb((s) => s.requestRefund);
  const allPayments = useDb((s) => s.payments);
  const [paying, setPaying] = useState<PaymentMilestone | null>(null);
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const payments = allPayments.filter((p) => p.projectId === project.id && !p.registryItemId).sort((a, b) => b.at.localeCompare(a.at));
  const summary = paymentSummary(project);

  if (!project.milestones.length) {
    return (
      <Card style={{ gap: 6, alignItems: 'center', padding: 24 }}>
        <Ionicons name="wallet-outline" size={32} color={t.c.primary} />
        <Text size={15} weight="bold" color={t.c.textStrong}>
          No payments yet
        </Text>
        <Text size={13} color={t.c.muted} align="center">
          Your payment schedule appears here once you accept a quotation.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <View style={styles.rowBetween}>
          <View>
            <Text size={12} color={t.c.muted}>
              Paid so far
            </Text>
            <Text size={22} weight="bold" color={t.c.textStrong}>
              {formatMoney(summary.paid)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text size={12} color={t.c.muted}>
              Total
            </Text>
            <Text size={16} weight="bold" color={t.c.text}>
              {formatMoney(summary.total)}
            </Text>
          </View>
        </View>
        <ProgressBar value={summary.total ? summary.paid / summary.total : 0} height={8} />
        {summary.next && (
          <Text size={13} color={summary.overdue.length ? t.c.danger : t.c.muted}>
            Next: {summary.next.label} · {formatMoney(summary.next.amount - summary.next.paidAmount)} due {formatShortDate(summary.next.due)}
          </Text>
        )}
      </Card>

      {project.milestones.map((m) => (
        <MilestoneRow key={m.id} m={m} mode={mode} onPay={() => setPaying(m)} />
      ))}

      {payments.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text size={13} weight="medium" color={t.c.muted}>
            Receipts
          </Text>
          {payments.map((p) => (
            <Card key={p.id} style={styles.receipt}>
              <View style={[styles.methodIcon, { backgroundColor: PAYMENT_METHODS.find((x) => x.id === p.method)?.color ?? t.c.primary }]}>
                <Ionicons name="receipt-outline" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {formatMoney(p.amount)} · {PAYMENT_METHODS.find((x) => x.id === p.method)?.label}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {p.receiptNo} · {formatShortDate(p.at)} · {p.payerName}
                </Text>
              </View>
              {p.status !== 'SUCCEEDED' && <StatusPill status={p.status} />}
              <Pressable onPress={() => sharePdf(receiptHtml(p, project), p.receiptNo)} hitSlop={8} accessibilityLabel="Download receipt">
                <Ionicons name="download-outline" size={20} color={t.c.primary} />
              </Pressable>
              {mode === 'customer' && p.status === 'SUCCEEDED' && (
                <Pressable onPress={() => setRefundFor(p.id)} hitSlop={8} accessibilityLabel="Request refund">
                  <Ionicons name="return-down-back-outline" size={20} color={t.c.muted} />
                </Pressable>
              )}
            </Card>
          ))}
        </View>
      )}

      <PaymentSheet
        visible={!!paying}
        title={paying?.label ?? ''}
        amount={paying ? paying.amount - paying.paidAmount : 0}
        allowPartial
        staff={mode === 'platform'}
        online={mode === 'customer' && onlinePaymentsReady() && paying ? { milestoneId: paying.id } : undefined}
        onClose={() => setPaying(null)}
        onPay={(method, amount) => {
          if (paying) payMilestone(project.id, paying.id, amount, method, mode === 'customer' ? account.name : project.customerName);
          toast('Payment recorded', 'checkmark-circle');
        }}
      />
      <Sheet visible={!!refundFor} onClose={() => setRefundFor(null)} title="Request a refund">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text size={13} color={t.c.muted}>
            Refunds follow your contract’s cancellation policy. Your coordinator will review the request within 2 working days.
          </Text>
          <KField placeholder="Reason for the refund" value={reason} onChangeText={setReason} multiline />
          <KButton
            label="Submit request"
            disabled={reason.trim().length < 5}
            onPress={() => {
              const p = payments.find((x) => x.id === refundFor);
              const err = p ? requestRefund(p.id, p.amount - p.refunded, reason.trim()) : 'This payment no longer exists';
              setRefundFor(null);
              setReason('');
              toast(err ?? 'Refund request sent', err ? 'alert-circle' : 'paper-plane');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  amountBox: { borderRadius: 8, padding: 14, alignItems: 'center', gap: 2 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  methodIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  gateway: { borderRadius: 10, padding: 18, alignItems: 'center', gap: 6 },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});
