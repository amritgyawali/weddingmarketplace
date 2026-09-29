import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors, GUTTER, radius } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { GENIE_PACKAGES } from '@/data/genie';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatMoney, isNepalMobile } from '@/utils/format';

const COUPONS: Record<string, number> = { SHUBH10: 0.1, FIRSTWED: 0.15 };
const VAT = 0.13;
const METHODS = [
  { id: 'esewa', label: 'eSewa', icon: 'wallet-outline' },
  { id: 'khalti', label: 'Khalti', icon: 'wallet-outline' },
  { id: 'fonepay', label: 'Fonepay QR (any bank app)', icon: 'qr-code-outline' },
  { id: 'connect_ips', label: 'ConnectIPS', icon: 'business-outline' },
  { id: 'card', label: 'Visa / Mastercard', icon: 'card-outline' },
] as const;

/**
 * Checkout for Genie packages. Payment is simulated — plug a gateway SDK
 * (eSewa / Khalti / Fonepay) into `pay()` and confirm the order server-side.
 */
export default function GenieCheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const pkg = GENIE_PACKAGES.find((p) => p.id === id);
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const addBooking = useAppStore((s) => s.addBooking);
  const setBookingStatus = useAppStore((s) => s.setBookingStatus);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const city = useAppStore((s) => s.city);
  const ensureProject = useDb((s) => s.ensureCustomerProject);
  const notify = useDb((s) => s.notify);
  const account = useAccount();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('esewa');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  if (!pkg) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Checkout" />
        <EmptyState title="Package not found" actionLabel="View packages" onAction={() => router.back()} />
      </View>
    );
  }

  const discount = applied ? Math.round(pkg.price * COUPONS[applied]) : 0;
  const subtotal = pkg.price - discount;
  const tax = Math.round(subtotal * VAT);
  const total = subtotal + tax;

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (COUPONS[code]) {
      setApplied(code);
      setCouponError(null);
      triggerHaptic('success');
    } else {
      setApplied(null);
      setCouponError('Invalid coupon code');
    }
  };

  const pay = async () => {
    const next = {
      name: name.trim().length < 2 ? 'Please enter your name' : null,
      phone: !isNepalMobile(phone) ? 'Enter a valid mobile number' : null,
      email: email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    updateProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    setPaying(true);
    const booking = addBooking({
      kind: 'genie',
      refId: pkg.id,
      title: pkg.title,
      subtitle: BRAND.genieService,
      amount: total,
    });
    await new Promise((r) => setTimeout(r, 1600));
    setBookingStatus(booking.id, 'confirmed');
    // Hand the wedding to the platform's Genie planners.
    const project = ensureProject(account, { weddingDate, city: city === ALL_CITIES ? account.city : city, managedBy: 'platform', geniePackageId: pkg.id });
    notify('platform', `New Genie client: ${name.trim()}`, `${pkg.title} · ${project.code}`, `/platform/project/${project.id}`);
    triggerHaptic('success');
    setPaying(false);
    setDone(true);
  };

  if (done) {
    return (
      <View style={[styles.root, styles.success, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
          <Ionicons name="sparkles" size={44} color={colors.white} />
        </Animated.View>
        <Text size={24} weight="bold" color={colors.heading} align="center">
          Welcome to Genie!
        </Text>
        <Text size={15} color={colors.textBody} align="center" style={{ maxWidth: 310 }}>
          Payment of {formatMoney(total)} received for the {pkg.title}. Your personal Genie will call you on {phone} within 24 hours.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 20 }}>
          <Button label="Open My Wedding" size="lg" onPress={() => router.replace({ pathname: '/my-wedding', params: { tab: 'plan' } })} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Checkout" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text size={12} weight="bold" color={colors.primary} tracking={0.8}>
              {BRAND.genieService.toUpperCase()}
            </Text>
            <Text size={20} weight="bold" color={colors.heading}>
              {pkg.title}
            </Text>
            <Text size={14} color={colors.textMuted}>
              {pkg.subtitle}
            </Text>
          </View>

          <Text size={17} weight="bold" color={colors.heading}>
            Your details
          </Text>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" error={errors.name} />
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" error={errors.phone} />
          <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />

          <Text size={17} weight="bold" color={colors.heading} style={{ marginTop: 6 }}>
            Coupon
          </Text>
          <View style={styles.couponRow}>
            <View style={{ flex: 1 }}>
              <Field label="Have a code? Try SHUBH10" value={coupon} onChangeText={setCoupon} autoCapitalize="characters" placeholder="Enter coupon" error={couponError} />
            </View>
            <Button label={applied ? 'Applied' : 'Apply'} variant={applied ? 'soft' : 'outline'} size="md" onPress={applyCoupon} style={{ marginTop: 22 }} />
          </View>

          <Text size={17} weight="bold" color={colors.heading} style={{ marginTop: 6 }}>
            Payment method
          </Text>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMethod(m.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: method === m.id }}
              style={[styles.method, method === m.id && styles.methodActive]}>
              <Ionicons name={m.icon} size={20} color={colors.text} />
              <Text size={15} color={colors.text} style={{ flex: 1 }}>
                {m.label}
              </Text>
              <Ionicons name={method === m.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={method === m.id ? colors.primary : colors.textSubtle} />
            </Pressable>
          ))}

          <View style={styles.bill}>
            <BillRow label="Package price" value={formatMoney(pkg.mrp)} strike />
            <BillRow label="Offer price" value={formatMoney(pkg.price)} />
            {!!discount && <BillRow label={`Coupon ${applied}`} value={`− ${formatMoney(discount)}`} accent />}
            <BillRow label="VAT (13%)" value={formatMoney(tax)} />
            <View style={styles.billDivider} />
            <BillRow label="Total payable" value={formatMoney(total)} bold />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button label={paying ? 'Processing…' : `Pay ${formatMoney(total)}`} onPress={pay} loading={paying} size="lg" />
          <View style={styles.secure}>
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
            <Text size={12} color={colors.textMuted}>
              100% secure payments
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function BillRow({ label, value, bold, strike, accent }: { label: string; value: string; bold?: boolean; strike?: boolean; accent?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text size={bold ? 16 : 14} weight={bold ? 'bold' : 'regular'} color={colors.textBody}>
        {label}
      </Text>
      <Text
        size={bold ? 17 : 14}
        weight={bold ? 'bold' : 'medium'}
        color={accent ? colors.success : bold ? colors.textStrong : colors.text}
        style={strike ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 14, paddingBottom: 30 },
  summary: { padding: 16, borderRadius: radius.lg, backgroundColor: colors.primaryTint, gap: 4, borderWidth: 1, borderColor: colors.primarySoft },
  couponRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  bill: { marginTop: 8, padding: 16, borderRadius: radius.md, backgroundColor: colors.bgSoft, gap: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billDivider: { height: 1, backgroundColor: colors.hairline },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, gap: 8 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  success: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
