import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyBlock, KButton, KeyValue, KField, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { GigCard } from '@/components/work/GigCard';
import { myApplication } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatINR, formatLongDate } from '@/utils/format';

export default function FreelancerGigDetail() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useDb((s) => s.gigs.find((g) => g.id === id));
  const applyToGig = useDb((s) => s.applyToGig);
  const [message, setMessage] = useState('');
  const [pay, setPay] = useState('');

  if (!gig) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Gig" />
        <EmptyBlock title="Gig not found" />
      </View>
    );
  }

  const application = myApplication(gig, account.id);
  const hired = gig.applications.filter((a) => a.status === 'hired' || a.status === 'completed').length;
  const skillMatch = (account.skills ?? []).includes(gig.skill);

  const apply = () => {
    applyToGig(gig.id, {
      freelancerId: account.id,
      freelancerName: account.name,
      skill: gig.skill,
      rating: account.rating ?? 5,
      message: message.trim(),
      expectedPay: Number(pay) || gig.pay,
    });
    toast('Application sent 🚀', 'paper-plane');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Gig details" subtitle={gig.postedByName} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <GigCard gig={gig} />
          <Card style={{ gap: 4 }}>
            <KeyValue label="Date" value={formatLongDate(gig.date)} />
            <KeyValue label="Reporting time" value={`${gig.startTime} · ${gig.hours} hours`} />
            <KeyValue label="Location" value={gig.city} />
            <KeyValue label="Pay" value={`${formatINR(gig.pay)} per person`} />
            <KeyValue label="Openings" value={`${gig.slots - hired} of ${gig.slots}`} />
          </Card>
          {!!gig.description && (
            <Card style={{ gap: 8 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                About the gig
              </Text>
              <Text size={14} color={t.c.text} lineHeight={21}>
                {gig.description}
              </Text>
              {gig.requirements.map((r) => (
                <View key={r} style={styles.req}>
                  <Ionicons name="checkmark-circle" size={16} color={t.c.primary} />
                  <Text size={13} color={t.c.text}>
                    {r}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {application ? (
            <Card style={styles.status}>
              <Ionicons name="information-circle" size={22} color={t.c.primary} />
              <View style={{ flex: 1 }}>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  You applied for this gig
                </Text>
                <Text size={12} color={t.c.muted}>
                  Asking {formatINR(application.expectedPay)}
                </Text>
              </View>
              <StatusPill status={application.status} />
            </Card>
          ) : gig.status === 'open' ? (
            <Card style={{ gap: 12 }}>
              <Text size={16} weight="bold" color={t.c.textStrong}>
                Apply now
              </Text>
              {!skillMatch && (
                <Text size={12} color={t.c.warning}>
                  This gig needs {gig.skill}, which isn’t on your profile yet.
                </Text>
              )}
              <KField label="Message to the organiser" value={message} onChangeText={setMessage} multiline placeholder="Your experience with similar weddings, availability, kit…" />
              <KField label="Your rate for this gig" value={pay} onChangeText={(v) => setPay(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="₹" placeholder={String(gig.pay)} />
            </Card>
          ) : (
            <Card>
              <Text size={14} color={t.c.muted}>
                This gig is no longer accepting applications.
              </Text>
            </Card>
          )}
        </ScrollView>
        {!application && gig.status === 'open' && (
          <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
            <KButton label={`Apply · ${formatINR(Number(pay) || gig.pay)}`} icon="flash" size="lg" onPress={apply} />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  req: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
