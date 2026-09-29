import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyBlock, KButton, KeyValue, KField, StackHeader, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { GigCard } from '@/components/work/GigCard';
import { cityDistanceKm } from '@/data/cities';
import { myApplication } from '@/hooks/useWorkspace';
import { freelancerNet } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatClock, formatLongDate, formatMoney } from '@/utils/format';

/** Gig detail for crew: accept an invite, apply, ask a question or decline. */
export default function FreelancerGigDetail() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useDb((s) => s.gigs.find((g) => g.id === id));
  const applyToGig = useDb((s) => s.applyToGig);
  const respondToInvite = useDb((s) => s.respondToInvite);
  const askQuestion = useDb((s) => s.askGigQuestion);
  const withdraw = useDb((s) => s.withdrawApplication);
  const [message, setMessage] = useState('');
  const [pay, setPay] = useState('');
  const [question, setQuestion] = useState('');

  if (!gig) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Gig" />
        <EmptyBlock title="Gig not found" />
      </View>
    );
  }

  const application = myApplication(gig, account.id);
  const invited = gig.invited?.includes(account.id);
  const hired = gig.applications.filter((a) => ['hired', 'confirmed', 'checked_in', 'completed'].includes(a.status)).length;
  const skillMatch = (account.skills ?? []).includes(gig.skill);
  const km = cityDistanceKm(account.city, gig.city);
  const owned = (account.equipment ?? []).map((e) => e.name.toLowerCase());
  const missing = (gig.equipment ?? []).filter((req) => !owned.some((o) => o.includes(req.toLowerCase().split(' ')[0]) || req.toLowerCase().includes(o.split(' ')[0])));
  const client = freelancerNet(Math.round(gig.pay / 0.8));

  const apply = () => {
    applyToGig(gig.id, { freelancerId: account.id, freelancerName: account.name, skill: gig.skill, rating: account.rating ?? 4.8, message: message.trim(), expectedPay: Number(pay) || gig.pay });
    triggerHaptic('success');
    toast('Application sent 🚀', 'paper-plane');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={gig.emergency ? 'Emergency gig' : 'Gig details'} subtitle={gig.postedByName} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
          <GigCard gig={gig} distance={km} />
          <Card style={{ gap: 4 }}>
            <KeyValue label="Date" value={formatLongDate(gig.date)} />
            <KeyValue label="Reporting time" value={`${formatClock(gig.startTime)} · ${gig.hours} hours`} />
            <KeyValue label="Location" value={`${gig.location ? `${gig.location}, ` : ''}${gig.city}${km !== null ? ` · ${km} km from you` : ''}`} />
            <KeyValue label="You receive" value={`${formatMoney(gig.pay)} per person`} />
            <KeyValue label="Openings" value={`${Math.max(0, gig.slots - hired)} of ${gig.slots}`} />
            <Text size={11} color={t.c.subtle}>
              Billed to the client at {formatMoney(client.pay + client.margin)}; Vivah keeps {formatMoney(client.margin)} for insurance, escrow and payouts.
            </Text>
          </Card>
          {(!!gig.description || gig.requirements.length > 0) && (
            <Card style={{ gap: 8 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                About the gig
              </Text>
              {!!gig.description && (
                <Text size={14} color={t.c.text} lineHeight={21}>
                  {gig.description}
                </Text>
              )}
              {gig.requirements.map((r) => (
                <View key={r} style={styles.req}>
                  <Ionicons name={missing.some((m) => r.toLowerCase().includes(m.toLowerCase())) ? 'alert-circle' : 'checkmark-circle'} size={16} color={missing.some((m) => r.toLowerCase().includes(m.toLowerCase())) ? t.c.warning : t.c.primary} />
                  <Text size={13} color={t.c.text}>
                    {r}
                  </Text>
                </View>
              ))}
              {missing.length > 0 && (
                <Text size={12} color={t.c.warning}>
                  Your profile doesn’t list: {missing.join(', ')}.
                </Text>
              )}
            </Card>
          )}

          {!!gig.questions?.length && (
            <Card style={{ gap: 8 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                Questions
              </Text>
              {gig.questions.map((q) => (
                <View key={q.id} style={{ gap: 2 }}>
                  <Text size={13} weight="semibold" color={t.c.textStrong}>
                    {q.freelancerName}: {q.question}
                  </Text>
                  <Text size={13} color={q.answer ? t.c.success : t.c.muted}>
                    {q.answer ? `↳ ${q.answer}` : 'Awaiting answer'}
                  </Text>
                </View>
              ))}
            </Card>
          )}
          {gig.status === 'open' && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <KField placeholder="Ask the organiser a question" value={question} onChangeText={setQuestion} />
              </View>
              <KButton
                label="Ask"
                size="sm"
                disabled={!question.trim()}
                onPress={() => {
                  askQuestion(gig.id, { id: account.id, name: account.name }, question.trim());
                  setQuestion('');
                  toast('Question sent');
                }}
              />
            </View>
          )}

          {application ? (
            <Card style={styles.status}>
              <Ionicons name="information-circle" size={22} color={t.c.primary} />
              <View style={{ flex: 1 }}>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  {application.status === 'hired' ? 'You’re hired!' : 'You applied for this gig'}
                </Text>
                <Text size={12} color={t.c.muted}>
                  Asking {formatMoney(application.expectedPay)}
                </Text>
              </View>
              <StatusPill status={application.status} />
            </Card>
          ) : gig.status === 'open' && !invited ? (
            <Card style={{ gap: 12 }}>
              <Text size={16} weight="bold" color={t.c.textStrong}>
                Apply now
              </Text>
              {!skillMatch && (
                <Text size={12} color={t.c.warning}>
                  This gig needs {gig.skill}, which isn’t on your profile yet.
                </Text>
              )}
              <KField label="Message to the organiser" value={message} onChangeText={setMessage} multiline placeholder="Similar weddings you’ve done, your kit, availability…" />
              <KField label="Your rate for this gig" value={pay} onChangeText={(v) => setPay(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" placeholder={String(gig.pay)} />
            </Card>
          ) : gig.status !== 'open' ? (
            <Card>
              <Text size={14} color={t.c.muted}>
                This gig is no longer accepting applications.
              </Text>
            </Card>
          ) : null}
        </ScrollView>
        {gig.status === 'open' && (
          <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
            {invited && !application ? (
              <View style={styles.row}>
                <KButton label="Decline" variant="secondary" style={{ flex: 1 }} onPress={() => { respondToInvite(gig.id, account, false); toast('Invitation declined'); router.back(); }} />
                <KButton
                  label={gig.emergency ? `Accept · ${formatMoney(gig.pay)}` : 'Accept invite'}
                  icon="flash"
                  style={{ flex: 1.5 }}
                  onPress={() => {
                    respondToInvite(gig.id, account, true);
                    triggerHaptic('success');
                    toast(gig.emergency ? 'You’re on! Head to the venue 🚗' : 'Accepted — the organiser will confirm', 'checkmark-circle');
                    router.back();
                  }}
                />
              </View>
            ) : application?.status === 'applied' ? (
              <KButton label="Withdraw application" variant="secondary" onPress={() => { withdraw(gig.id, account.id); toast('Application withdrawn'); }} />
            ) : !application ? (
              <KButton label={`Apply · ${formatMoney(Number(pay) || gig.pay)}`} icon="flash" size="lg" onPress={apply} />
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  req: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
