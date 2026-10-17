import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { checkOnlinePayment, isOnlineGateway, onlinePaymentsReady, PAYMENT_STATE_TEXT, type PaymentState, SANDBOX_HINT, startOnlinePayment } from '@/backend/payments';
import { Card, KButton, KeyValue, KField, ProgressBar, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ENV } from '@/constants/env';
import { colors } from '@/constants/theme';
import { receiptHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { formatCountdown, MILESTONE_STATUS_TEXT, milestoneDueText, milestonePaymentDetails, milestonePurpose, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_TEXT, PAYMENT_WINDOW_SECONDS, type PaymentDetail } from '@/services/paymentInfo';
import { milestoneStatus, paymentSummary } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Payment, PaymentMethod, PaymentMilestone, Project } from '@/types/platform';
import { displayCurrency, formatLongDate, formatMoney, formatNpr, formatShortDate, formatTime, isConverted } from '@/utils/format';
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
 *
 * The pay screen stays open for `PAYMENT_WINDOW_SECONDS`. If the payment isn't
 * finished in time the attempt is rejected (nothing is charged) and the person
 * can pay again, so an old amount or QR code is never paid by mistake.
 */
export function PaymentSheet({
  visible,
  title,
  amount,
  allowPartial,
  staff,
  online,
  details,
  purpose,
  onClose,
  onPay,
  onReceipt,
}: {
  visible: boolean;
  title: string;
  amount: number;
  allowPartial?: boolean;
  staff?: boolean;
  /** Real Khalti and eSewa payments for this milestone. */
  online?: { milestoneId: string };
  /** "What you're paying for" rows (celebration, instalment, due date, balance). */
  details?: (payNow: number) => PaymentDetail[];
  /** One line on why this payment is due. */
  purpose?: string;
  onClose: () => void;
  /** Records the payment; return the saved record to offer its receipt. */
  onPay: (method: PaymentMethod, amount: number) => Payment | null | void;
  /** Opens the receipt PDF for a payment made in this sheet. */
  onReceipt?: (payment: Payment) => void;
}) {
  const t = useRoleTheme();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState<'choose' | 'confirm' | 'processing' | 'gateway' | 'done' | 'expired'>('choose');
  const [custom, setCustom] = useState('');
  const [intent, setIntent] = useState<string | null>(null);
  const [gatewayState, setGatewayState] = useState<PaymentState | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [paid, setPaid] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SECONDS);
  const payAmount = allowPartial && Number(custom) > 0 ? Math.min(amount, Number(custom)) : amount;
  const m = PAYMENT_METHODS.find((x) => x.id === method);
  const methods = online ? PAYMENT_METHODS.filter((x) => isOnlineGateway(x.id)) : PAYMENT_METHODS.filter((x) => staff || !x.staffOnly);
  // Staff recording cash or a transfer that already happened don't race a clock.
  const timed = !staff;

  // The payment window: counts down while the pay screen is open, then rejects the attempt.
  useEffect(() => {
    if (!visible || step !== 'confirm' || !timed) return;
    const deadline = Date.now() + PAYMENT_WINDOW_SECONDS * 1000;
    const timer = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      if (left <= 0) {
        clearInterval(timer);
        setSecondsLeft(0);
        triggerHaptic('medium');
        setStep('expired');
        return;
      }
      setSecondsLeft(left);
    }, 250);
    return () => clearInterval(timer);
  }, [visible, step, timed, method]);

  /** Opens the pay screen with a fresh payment window. */
  const toConfirm = () => {
    setSecondsLeft(PAYMENT_WINDOW_SECONDS);
    setStep('confirm');
  };

  const close = () => {
    setStep('choose');
    setMethod(null);
    setCustom('');
    setIntent(null);
    setGatewayState(null);
    setReceipt(null);
    setPaid(null);
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
        return toConfirm();
      }
      setIntent(started.value.intent);
      setGatewayState(null);
      return setStep('gateway');
    }
    setStep('processing');
    await new Promise((r) => setTimeout(r, 1300));
    const saved = onPay(method!, payAmount);
    if (saved) {
      setPaid(saved);
      setReceipt(saved.receiptNo);
    }
    triggerHaptic('success');
    setStep('done');
  };

  const rows = details?.(payAmount) ?? [];
  const urgent = secondsLeft <= 10;

  return (
    <Sheet visible={visible} onClose={close} title={step === 'done' ? 'Payment successful' : step === 'expired' ? 'Payment time ran out' : title}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {step === 'choose' && (
          <>
            <View style={[styles.amountBox, { backgroundColor: t.c.soft }]}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                {payAmount < amount ? 'You’re paying now' : 'Amount due'}
              </Text>
              <Text size={26} weight="bold" color={t.c.textStrong} numeric>
                {formatNpr(payAmount)}
              </Text>
              {isConverted() && (
                <Text size={13} color={t.c.muted}>
                  About {formatMoney(payAmount)}. You pay in NPR.
                </Text>
              )}
            </View>
            {(rows.length > 0 || purpose) && (
              <Card style={{ gap: 6 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  What you’re paying for
                </Text>
                {!!purpose && (
                  <Text size={13} color={t.c.muted}>
                    {purpose}
                  </Text>
                )}
                {rows.map((r) => (
                  <View key={r.label} style={styles.detailRow}>
                    <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
                      {r.label}
                    </Text>
                    <Text size={13} weight="semibold" color={t.c.textStrong} style={{ flex: 1.3, textAlign: 'right' }} raw>
                      {r.value}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
            {allowPartial && <KField label="Pay a smaller amount now (optional)" value={custom} onChangeText={(v) => setCustom(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" placeholder={String(amount)} hint="Leave empty to pay the full amount. The rest stays due on the same date." />}
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              Choose how to pay
            </Text>
            {methods.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => {
                  setMethod(x.id);
                  toConfirm();
                }}
                style={({ pressed }) => [styles.method, { borderColor: t.c.border, opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Pay with ${x.label}`}>
                <View style={[styles.methodIcon, { backgroundColor: x.color }]}>
                  <Ionicons name={x.icon as never} size={18} color={colors.onDark} />
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
              <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                Vivah holds your money safely and releases it to providers only as your payment plan says.
              </Text>
            </View>
            {timed && (
              <View style={styles.secure}>
                <Ionicons name="time-outline" size={14} color={t.c.muted} />
                <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                  Once you pick a method you have {PAYMENT_WINDOW_SECONDS} seconds to finish. If time runs out, nothing is charged and you can pay again.
                </Text>
              </View>
            )}
          </>
        )}
        {step === 'confirm' && m && (
          <>
            {timed && (
              <View style={[styles.timer, { borderColor: urgent ? t.c.danger : t.c.borderStrong }]} accessibilityLiveRegion="polite" accessibilityLabel={`${Math.ceil(secondsLeft)} seconds left to pay`}>
                <Ionicons name="time-outline" size={18} color={urgent ? t.c.danger : t.c.textStrong} />
                <Text size={14} weight="semibold" color={urgent ? t.c.danger : t.c.textStrong} style={{ flex: 1 }}>
                  {urgent ? 'Hurry, finish paying within' : 'Finish paying within'}
                </Text>
                <Text size={18} weight="bold" color={urgent ? t.c.danger : t.c.textStrong} numeric raw>
                  {formatCountdown(secondsLeft)}
                </Text>
              </View>
            )}
            {timed && <ProgressBar value={secondsLeft / PAYMENT_WINDOW_SECONDS} color={urgent ? t.c.danger : undefined} />}
            <View style={[styles.gateway, { backgroundColor: m.color }]}>
              <Ionicons name={m.icon as never} size={26} color={colors.onDark} />
              <Text size={18} weight="bold" color={colors.onDark}>
                {m.label}
              </Text>
              <Text size={24} weight="bold" color={colors.onDark} numeric>
                {formatNpr(payAmount)}
              </Text>
              <Text size={13} color={colors.onDark} align="center" raw>
                {title}
              </Text>
            </View>
            {method === 'fonepay' && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ padding: 12, backgroundColor: colors.onDark, borderRadius: 8 }}>
                  <QRCode value={`fonepay://pay?merchant=VIVAH&amount=${payAmount}&ref=${title.replace(/\s+/g, '-')}`} size={170} />
                </View>
                <Text size={12} color={t.c.muted} align="center">
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
            {!online && (method === 'esewa' || method === 'khalti' || method === 'ime_pay') && <KField label={`${m.label} ID or mobile number`} placeholder="98XXXXXXXX" keyboardType="phone-pad" />}
            {method === 'card' && <KField label="Card number" placeholder="4111 1111 1111 1111" keyboardType="number-pad" />}
            <KButton
              label={online ? `Continue to ${m.label}` : method === 'bank_transfer' || method === 'fonepay' || method === 'cash' ? 'I’ve paid, confirm' : `Pay ${formatNpr(payAmount)}`}
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
              Confirming your payment with {m?.label}…
            </Text>
            <Text size={12} color={t.c.muted}>
              Please keep this screen open.
            </Text>
          </View>
        )}
        {step === 'expired' && (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <View style={[styles.expiredIcon, { backgroundColor: t.c.surfaceAlt }]}>
              <Ionicons name="hourglass-outline" size={34} color={t.c.danger} />
            </View>
            <View style={{ alignSelf: 'center' }}>
              <StatusPill status="FAILED" label="Payment rejected" />
            </View>
            <Text size={15} weight="semibold" color={t.c.textStrong} align="center">
              The payment wasn’t finished within {PAYMENT_WINDOW_SECONDS} seconds
            </Text>
            <Text size={13} color={t.c.muted} align="center">
              For your safety we cancelled this attempt. Nothing was charged and your instalment is still due. Start again whenever you’re ready.
            </Text>
            <KButton label={`Pay ${formatNpr(payAmount)} again`} icon="refresh" onPress={() => toConfirm()} style={{ alignSelf: 'stretch' }} />
            <KButton label="Choose another method" variant="secondary" onPress={() => setStep('choose')} style={{ alignSelf: 'stretch' }} />
            <KButton label="Close" variant="ghost" size="sm" onPress={close} />
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
            {(gatewayState === 'failed' || gatewayState === 'cancelled' || gatewayState === 'expired') && <KButton label="Pay again" variant="secondary" onPress={() => toConfirm()} />}
            <KButton label="Close" variant="ghost" size="sm" onPress={close} />
          </View>
        )}
        {step === 'done' && (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
            <Ionicons name="checkmark-circle" size={64} color={t.c.success} />
            <View style={{ alignSelf: 'center' }}>
              <StatusPill status="SUCCEEDED" label="Payment successful" />
            </View>
            <Text size={22} weight="bold" color={t.c.textStrong} numeric>
              {formatNpr(payAmount)}
            </Text>
            <Card style={{ gap: 6, alignSelf: 'stretch' }}>
              <View style={styles.detailRow}>
                <Text size={13} color={t.c.muted}>
                  Paid for
                </Text>
                <Text size={13} weight="semibold" color={t.c.textStrong} raw style={{ flexShrink: 1, textAlign: 'right' }}>
                  {title}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text size={13} color={t.c.muted}>
                  Method
                </Text>
                <Text size={13} weight="semibold" color={t.c.textStrong}>
                  {m?.label ?? ''}
                </Text>
              </View>
              {!!receipt && (
                <View style={styles.detailRow}>
                  <Text size={13} color={t.c.muted}>
                    Receipt number
                  </Text>
                  <Text size={13} weight="semibold" color={t.c.textStrong} raw>
                    {receipt}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text size={13} color={t.c.muted}>
                  Paid on
                </Text>
                <Text size={13} weight="semibold" color={t.c.textStrong}>
                  {formatLongDate(paid?.at ?? new Date().toISOString())} · {formatTime(paid?.at ?? new Date().toISOString())}
                </Text>
              </View>
            </Card>
            <Text size={13} color={t.c.muted} align="center">
              {online ? 'Your receipt is in Payments and has been emailed to you.' : 'Your receipt is saved in Payments. You can download it as a PDF any time.'}
            </Text>
            {paid && onReceipt && <KButton label="Download receipt (PDF)" icon="download-outline" variant="secondary" onPress={() => onReceipt(paid)} style={{ alignSelf: 'stretch' }} />}
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
  const late = status === 'OVERDUE';
  const icon = status === 'PAID' ? 'checkmark-circle' : status === 'WAIVED' ? 'remove-circle-outline' : late ? 'alert-circle' : status === 'DUE' ? 'time' : 'calendar-outline';
  const iconColor = status === 'PAID' ? t.c.success : late ? t.c.danger : status === 'DUE' ? t.c.warning : t.c.muted;
  return (
    <Card style={{ gap: 8, borderColor: late ? t.c.danger : t.c.border }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {m.label}
            {m.percent ? ` · ${m.percent}%` : ''}
          </Text>
          <View style={styles.dueLine}>
            <Ionicons name={icon} size={14} color={iconColor} />
            <Text size={13} weight={late ? 'semibold' : 'regular'} color={late ? t.c.danger : t.c.muted}>
              {status === 'PAID' || status === 'WAIVED' ? milestoneDueText(m) : `${milestoneDueText(m)} · ${formatShortDate(m.due)}`}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text size={16} weight="bold" color={t.c.textStrong} numeric>
            {formatMoney(m.amount)}
          </Text>
          <StatusPill status={status} label={MILESTONE_STATUS_TEXT[status]} />
        </View>
      </View>
      {mode === 'customer' && status !== 'PAID' && status !== 'WAIVED' && (
        <Text size={13} color={t.c.muted}>
          {milestonePurpose(m)}
        </Text>
      )}
      {m.paidAmount > 0 && status !== 'PAID' && (
        <View style={{ gap: 4 }}>
          <ProgressBar value={m.paidAmount / m.amount} />
          <Text size={12} color={t.c.muted}>
            {formatMoney(m.paidAmount)} paid · {formatMoney(outstanding)} left to pay
          </Text>
        </View>
      )}
      {late && mode === 'customer' && (
        <Text size={13} color={t.c.danger}>
          Please pay soon so your bookings stay confirmed. Talk to your coordinator if you need more time.
        </Text>
      )}
      {status !== 'PAID' && status !== 'WAIVED' && mode !== 'vendor' && (
        <KButton label={mode === 'customer' ? `Pay ${formatNpr(outstanding)}` : 'Record payment'} size="sm" variant={mode === 'customer' ? 'primary' : 'secondary'} icon={mode === 'customer' ? 'card-outline' : 'add'} onPress={onPay} />
      )}
    </Card>
  );
}

/** One receipt: amount, method, status in words, and its details on tap. */
function ReceiptRow({ p, project, mode, onRefund }: { p: Payment; project: Project; mode: 'customer' | 'platform' | 'vendor'; onRefund: () => void }) {
  const t = useRoleTheme();
  const [open, setOpen] = useState(false);
  const milestone = project.milestones.find((x) => x.id === p.milestoneId);
  const status = PAYMENT_STATUS_TEXT[p.status];
  return (
    <Card style={{ gap: 10, padding: 12 }}>
      <View style={styles.receipt}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.receiptMain} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Receipt ${p.receiptNo}, ${status.label}. Show details`}>
          <View style={[styles.methodIcon, { backgroundColor: PAYMENT_METHODS.find((x) => x.id === p.method)?.color ?? t.c.primary }]}>
            <Ionicons name="receipt-outline" size={16} color={colors.onDark} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong} numeric>
              {formatNpr(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}
            </Text>
            <Text size={12} color={t.c.muted}>
              {milestone?.label ?? 'Payment'} · {formatShortDate(p.at)}
            </Text>
            <StatusPill status={p.status} label={status.label} />
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.c.subtle} />
        </Pressable>
        <Pressable onPress={() => sharePdf(receiptHtml(p, project), p.receiptNo)} hitSlop={8} style={styles.receiptAction} accessibilityRole="button" accessibilityLabel="Download receipt PDF">
          <Ionicons name="download-outline" size={20} color={t.c.primary} />
          <Text size={11} weight="semibold" color={t.c.primary}>
            PDF
          </Text>
        </Pressable>
      </View>
      {open && (
        <View style={{ gap: 4, paddingTop: 2 }}>
          <Text size={13} color={t.c.muted}>
            {status.detail}
          </Text>
          <KeyValue label="Receipt number" value={p.receiptNo} />
          <KeyValue label="Paid on" value={`${formatLongDate(p.at)} · ${formatTime(p.at)}`} />
          <KeyValue label="Paid by" value={p.payerName} />
          <KeyValue label="Transaction reference" value={p.reference} />
          <KeyValue label="Amount" value={formatNpr(p.amount)} />
          {p.refunded > 0 && <KeyValue label="Refunded" value={formatNpr(p.refunded)} />}
          {mode === 'customer' && p.status === 'SUCCEEDED' && <KButton label="Request a refund" icon="return-down-back-outline" variant="ghost" size="sm" onPress={onRefund} style={{ alignSelf: 'flex-start' }} />}
        </View>
      )}
    </Card>
  );
}

/** Customer payment milestones, receipts and refunds for a project. */
/** `openMilestoneId` opens that milestone's payment sheet straight away (from "Next up" on My Wedding). */
export function PaymentsPanel({ project, mode, openMilestoneId, focusMilestoneId, onFocusTarget }: { project: Project; mode: 'customer' | 'platform' | 'vendor'; openMilestoneId?: string; focusMilestoneId?: string; onFocusTarget?: (node: View) => void }) {
  const t = useRoleTheme();
  const account = useAccount();
  const payMilestone = useDb((s) => s.payMilestone);
  const requestRefund = useDb((s) => s.requestRefund);
  const allPayments = useDb((s) => s.payments);
  const [paying, setPaying] = useState<PaymentMilestone | null>(() => {
    const m = mode === 'vendor' ? undefined : project.milestones.find((x) => x.id === openMilestoneId);
    return m && milestoneStatus(m) !== 'PAID' && milestoneStatus(m) !== 'WAIVED' ? m : null;
  });
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
          Your payment plan appears here once you accept a quotation.
        </Text>
      </Card>
    );
  }

  const paidShare = summary.total ? Math.round((summary.paid / summary.total) * 100) : 0;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <View style={styles.rowBetween}>
          <View>
            <Text size={13} color={t.c.muted}>
              Paid so far
            </Text>
            <Text size={22} weight="bold" color={t.c.textStrong} numeric>
              {formatMoney(summary.paid)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text size={13} color={t.c.muted}>
              Total, incl. 13% VAT
            </Text>
            <Text size={16} weight="bold" color={t.c.text} numeric>
              {formatMoney(summary.total)}
            </Text>
          </View>
        </View>
        <ProgressBar value={summary.total ? summary.paid / summary.total : 0} height={8} />
        <Text size={13} color={t.c.muted}>
          {summary.outstanding > 0 ? `${paidShare}% paid · ${formatMoney(summary.outstanding)} still to pay` : 'Everything is paid. Thank you!'}
        </Text>
        {summary.next && (
          <Text size={13} weight={summary.overdue.length ? 'semibold' : 'regular'} color={summary.overdue.length ? t.c.danger : t.c.textStrong}>
            Next: {summary.next.label} · {formatMoney(summary.next.amount - summary.next.paidAmount)} · {milestoneDueText(summary.next).toLowerCase()}
          </Text>
        )}
        {isConverted() && (
          <Text size={12} color={t.c.muted}>
            Amounts are shown in {displayCurrency()} at an indicative rate. You always pay in NPR.
          </Text>
        )}
      </Card>

      {project.milestones.map((m) => (
        <View key={m.id} ref={(node) => { if (node && m.id === focusMilestoneId) requestAnimationFrame(() => onFocusTarget?.(node)); }} collapsable={false} style={m.id === focusMilestoneId ? { borderWidth: 2, borderColor: t.c.primary, borderRadius: 10 } : undefined}>
          <MilestoneRow m={m} mode={mode} onPay={() => setPaying(m)} />
        </View>
      ))}

      {payments.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            Receipts
          </Text>
          <Text size={12} color={t.c.muted}>
            Tap a receipt for its details, or download it as a PDF.
          </Text>
          {payments.map((p) => (
            <ReceiptRow key={p.id} p={p} project={project} mode={mode} onRefund={() => setRefundFor(p.id)} />
          ))}
        </View>
      )}

      <PaymentSheet
        visible={!!paying}
        title={paying ? `${paying.label} · ${project.code}` : ''}
        amount={paying ? paying.amount - paying.paidAmount : 0}
        allowPartial
        staff={mode === 'platform'}
        online={mode === 'customer' && onlinePaymentsReady() && paying ? { milestoneId: paying.id } : undefined}
        details={paying ? (payNow) => milestonePaymentDetails(project, paying, payNow) : undefined}
        purpose={paying && mode === 'customer' ? milestonePurpose(paying) : undefined}
        onClose={() => setPaying(null)}
        onPay={(method, amount) => {
          if (!paying) return null;
          const payer = mode === 'customer' ? account.name : project.customerName;
          const saved = payMilestone(project.id, paying.id, amount, method, payer);
          if (mode === 'platform') toast(`Payment of ${formatNpr(amount)} recorded for ${payer}. The receipt is ready`, 'checkmark-circle');
          return saved;
        }}
        onReceipt={(p) => sharePdf(receiptHtml(p, useDb.getState().projects.find((x) => x.id === project.id) ?? project), p.receiptNo)}
      />
      <Sheet visible={!!refundFor} onClose={() => setRefundFor(null)} title="Request a refund">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text size={13} color={t.c.muted}>
            Refunds follow your contract’s cancellation policy. Our finance team reviews every request within 2 working days and lets you know.
          </Text>
          <KField placeholder="Why do you need a refund?" value={reason} onChangeText={setReason} multiline minLength={5} maxLength={500} />
          <KButton
            label="Send request"
            missing={reason.trim().length < 5 && (reason.trim() ? 'Give a little more detail (at least 5 characters)' : 'Tell us why you need the refund')}
            onPress={() => {
              const p = payments.find((x) => x.id === refundFor);
              const err = p ? requestRefund(p.id, p.amount - p.refunded, reason.trim()) : 'This payment no longer exists';
              setRefundFor(null);
              setReason('');
              toast(err ?? 'Refund requested. We’ll reply within 2 working days', err ? 'alert-circle' : 'paper-plane');
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
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptAction: { alignItems: 'center', gap: 1, paddingHorizontal: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  dueLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  expiredIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
