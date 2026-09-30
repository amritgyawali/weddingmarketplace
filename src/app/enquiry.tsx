import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useVendor, useVenue } from '@/hooks/queries';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatLongDate } from '@/utils/format';

const FUNCTIONS = ['Wedding', 'Reception', 'Sangeet', 'Mehendi', 'Engagement', 'Haldi'];

export default function EnquiryScreen() {
  const { kind, id, pkg } = useLocalSearchParams<{ kind: 'venue' | 'vendor'; id: string; pkg?: string }>();
  const insets = useSafeAreaInsets();
  const venue = useVenue(kind === 'venue' ? id : '');
  const vendor = useVendor(kind === 'vendor' ? id : '');
  const item = kind === 'venue' ? venue.data : vendor.data;

  const profile = useAppStore((s) => s.profile);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const addBooking = useAppStore((s) => s.addBooking);
  const createLead = useDb((s) => s.createLead);
  const account = useAccount();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [date, setDate] = useState<string | null>(weddingDate);
  const [guests, setGuests] = useState('');
  const [fns, setFns] = useState<string[]>(['Wedding']);
  const [note, setNote] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const next: Record<string, string | null> = {
      name: name.trim().length < 2 ? 'Please enter your name' : null,
      phone: !/^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, '')) ? 'Enter a valid 10-digit mobile number' : null,
      date: !date ? 'Pick your event date' : null,
      guests: guests && !/^\d+$/.test(guests) ? 'Guests must be a number' : null,
    };
    setErrors(next);
    return Object.values(next).every((e) => !e);
  };

  const submit = () => {
    if (!item || !validate()) {
      triggerHaptic('medium');
      return;
    }
    updateProfile({ name: name.trim(), phone: phone.trim() });
    addBooking({
      kind,
      refId: item.id,
      title: item.name,
      subtitle: [fns.join(', '), pkg ? `${pkg} package` : null].filter(Boolean).join(' · '),
      image: item.images[0],
      eventDate: date!,
      guests: guests ? Number(guests) : undefined,
    });
    // Route the enquiry to the vendor's Leads inbox (or an auto-quote if unclaimed).
    createLead({
      listingKind: kind,
      listingId: item.id,
      listingName: item.name,
      customerId: account.id,
      customerName: name.trim(),
      customerPhone: phone.replace(/\D/g, '').slice(-10),
      city: item.city,
      eventDate: date!,
      guests: guests ? Number(guests) : undefined,
      functions: fns.length ? fns : ['Wedding'],
      message: note.trim() || undefined,
    });
    triggerHaptic('success');
    setSubmitted(true);
  };

  if (submitted && item) {
    return (
      <View style={[styles.root, styles.success, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
          <Ionicons name="checkmark" size={48} color={colors.white} />
        </Animated.View>
        <Text size={24} weight="bold" color={colors.heading} align="center">
          Enquiry sent!
        </Text>
        <Text size={15} color={colors.textBody} align="center" style={{ maxWidth: 300 }}>
          {item.name} will get back to you shortly with availability and a detailed quotation for {formatLongDate(date!)}. You’ll find it under My Wedding → Quotations.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 20 }}>
          <Button label="Track in My Wedding" onPress={() => router.replace({ pathname: '/my-wedding', params: { tab: 'quotes' } })} size="lg" />
          <Button label="Continue browsing" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={kind === 'venue' ? 'Check Availability' : 'Send Enquiry'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {item && (
            <View style={styles.itemCard}>
              <Image source={photos[item.images[0]]} style={styles.itemImage} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text size={16} weight="semibold" color={colors.heading} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {item.city}
                  {pkg ? ` · ${pkg} package` : ''}
                </Text>
              </View>
            </View>
          )}

          <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            error={errors.phone}
          />

          <View style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={colors.textBody}>
              Event date
            </Text>
            <Pressable onPress={() => setDateOpen(true)} style={[styles.dateField, !!errors.date && { borderColor: colors.danger }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text size={16} color={date ? colors.textStrong : colors.placeholder}>
                {date ? formatLongDate(date) : 'Select date'}
              </Text>
            </Pressable>
            {!!errors.date && (
              <Text size={12} color={colors.danger}>
                {errors.date}
              </Text>
            )}
          </View>

          <Field label="Number of guests" value={guests} onChangeText={setGuests} placeholder="e.g. 400" keyboardType="number-pad" error={errors.guests} />

          <View style={{ gap: 10 }}>
            <Text size={13} weight="semibold" color={colors.textBody}>
              Functions
            </Text>
            <View style={styles.chips}>
              {FUNCTIONS.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={fns.includes(f)}
                  onPress={() => setFns((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))}
                />
              ))}
            </View>
          </View>

          <Field label="Message (optional)" value={note} onChangeText={setNote} placeholder="Tell them about your requirements…" multiline />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button label="Send Enquiry" onPress={submit} size="lg" loading={!item} />
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Event date">
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Calendar value={date} onChange={setDate} />
          <Button label="Done" onPress={() => setDateOpen(false)} disabled={!date} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 18, paddingBottom: 30 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  itemImage: { width: 56, height: 56, borderRadius: radius.sm },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  success: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
