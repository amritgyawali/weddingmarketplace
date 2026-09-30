import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { Role } from '@/types';
import { formatLongDate } from '@/utils/format';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const store = useAppStore(
    useShallow((s) => ({
      profile: s.profile,
      role: s.role,
      weddingDate: s.weddingDate,
      city: s.city,
      updateProfile: s.updateProfile,
      setRole: s.setRole,
      setWeddingDate: s.setWeddingDate,
    })),
  );
  const [name, setName] = useState(store.profile.name);
  const [partner, setPartner] = useState(store.profile.partnerName);
  const [email, setEmail] = useState(store.profile.email);
  const [phone, setPhone] = useState(store.profile.phone);
  const [role, setRole] = useState<Role | null>(store.role);
  const [date, setDate] = useState<string | null>(store.weddingDate);
  const [dateOpen, setDateOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const save = () => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Enter a valid email');
      return;
    }
    store.updateProfile({ name: name.trim(), partnerName: partner.trim(), email: email.trim(), phone: phone.trim() });
    if (role) store.setRole(role);
    store.setWeddingDate(date);
    toast('Profile updated');
    router.back();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 10 }}>
            <Text size={13} weight="semibold" color={colors.textBody}>
              I am the
            </Text>
            <View style={styles.row}>
              {(['bride', 'groom', 'other'] as Role[]).map((r) => (
                <Chip key={r} label={`${r[0].toUpperCase()}${r.slice(1)}`} selected={role === r} onPress={() => setRole(r)} />
              ))}
            </View>
          </View>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="Full name" autoComplete="name" />
          <Field label="Partner's name" value={partner} onChangeText={setPartner} placeholder="Partner's name" />
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" />
          <Field
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            error={emailError}
          />
          <View style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={colors.textBody}>
              Wedding date
            </Text>
            <Pressable onPress={() => setDateOpen(true)} style={styles.dateField}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text size={16} color={date ? colors.textStrong : colors.placeholder} style={{ flex: 1 }}>
                {date ? formatLongDate(date) : 'Add your wedding date'}
              </Text>
              {date && (
                <Pressable onPress={() => setDate(null)} hitSlop={10} accessibilityLabel="Clear date">
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              )}
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/select-city')} style={styles.dateField}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text size={16} color={colors.textStrong} style={{ flex: 1 }}>
              {store.city}
            </Text>
            <Text size={14} weight="semibold" color={colors.primary}>
              Change
            </Text>
          </Pressable>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button label="Save changes" size="lg" onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Wedding date">
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Calendar value={date} onChange={setDate} />
          <Button label="Done" onPress={() => setDateOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 18 },
  row: { flexDirection: 'row', gap: 10 },
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
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});
