import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, KField, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { CheckState, VerificationCase, VerificationStatus } from '@/types/platform';
import { formatShortDate, timeAgo } from '@/utils/format';

type Tab = 'kyc' | 'reviews' | 'verified';
const CHECKS: { key: keyof VerificationCase['checks']; label: string }[] = [
  { key: 'business', label: 'Business docs (PAN/VAT, registration)' },
  { key: 'identity', label: 'Identity (citizenship / passport)' },
  { key: 'phone', label: 'Phone (OTP)' },
  { key: 'bank', label: 'Bank / payout details' },
  { key: 'portfolio', label: 'Portfolio authenticity' },
];
const NEXT: Record<CheckState, CheckState> = { pending: 'passed', passed: 'failed', failed: 'pending' };

function CaseCard({ vc }: { vc: VerificationCase }) {
  const t = useRoleTheme();
  const setCheck = useDb((s) => s.setVerificationCheck);
  const decide = useDb((s) => s.decideVerification);
  const [note, setNote] = useState('');
  const allPassed = Object.values(vc.checks).every((c) => c === 'passed');
  const decideAs = (status: VerificationStatus) => {
    decide(vc.id, status, note.trim() || undefined);
    toast(`${vc.title}: ${status.toLowerCase().replace('_', ' ')}`, status === 'VERIFIED' ? 'shield-checkmark' : 'close-circle');
  };
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
          <Ionicons name={vc.subjectKind === 'provider' ? 'storefront-outline' : 'person-outline'} size={20} color={t.c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={11} weight="bold" color={t.c.muted}>
            {vc.subjectKind.toUpperCase()} · submitted {timeAgo(vc.submittedAt)}
          </Text>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            {vc.title}
          </Text>
          <Text size={12} color={t.c.muted}>
            {vc.subtitle}
          </Text>
        </View>
        <StatusPill status={vc.status} />
      </View>
      {CHECKS.map((c) => (
        <Pressable key={c.key} onPress={() => setCheck(vc.id, c.key, NEXT[vc.checks[c.key]])} style={styles.check} accessibilityRole="button" accessibilityLabel={`${c.label}: ${vc.checks[c.key]}`}>
          <Ionicons
            name={vc.checks[c.key] === 'passed' ? 'checkmark-circle' : vc.checks[c.key] === 'failed' ? 'close-circle' : 'ellipse-outline'}
            size={20}
            color={vc.checks[c.key] === 'passed' ? t.c.success : vc.checks[c.key] === 'failed' ? t.c.danger : t.c.muted}
          />
          <Text size={13} color={t.c.text} style={{ flex: 1 }}>
            {c.label}
          </Text>
        </Pressable>
      ))}
      {vc.documents.map((d) => (
        <Text key={d.name} size={12} color={t.c.muted}>
          📎 {d.kind}: {d.name} ({d.status})
        </Text>
      ))}
      {vc.expiresAt && (
        <Text size={12} color={t.c.warning}>
          Re-verification due {formatShortDate(vc.expiresAt)}
        </Text>
      )}
      {vc.status !== 'VERIFIED' && vc.status !== 'REJECTED' && (
        <>
          <KField placeholder="Note to the applicant (optional)" value={note} onChangeText={setNote} />
          <View style={styles.row}>
            <KButton label="Reject" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => decideAs('REJECTED')} />
            <KButton label="Verify" variant="success" size="sm" style={{ flex: 1 }} disabled={!allPassed} onPress={() => decideAs('VERIFIED')} />
          </View>
          {!allPassed && (
            <Text size={11} color={t.c.muted}>
              Tap each check to mark it passed before verifying.
            </Text>
          )}
        </>
      )}
      {vc.status === 'VERIFIED' && <KButton label="Suspend" variant="ghost" size="sm" onPress={() => decideAs('SUSPENDED')} />}
    </Card>
  );
}

/** Trust & safety: KYC verification workflow and review moderation. */
export default function Approvals() {
  const t = useRoleTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const verifications = useDb((s) => s.verifications);
  const reviews = useDb((s) => s.reviews);
  const moderate = useDb((s) => s.moderateReview);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'kyc');
  const open = verifications.filter((v) => v.status === 'DOCUMENT_SUBMITTED' || v.status === 'UNDER_REVIEW' || v.status === 'UNVERIFIED');
  const done = verifications.filter((v) => !open.includes(v));
  const flagged = reviews.filter((r) => r.status === 'flagged');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Verification & moderation" subtitle="Providers, freelancers and reviews" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'kyc', label: 'KYC queue' },
            { id: 'reviews', label: 'Flagged reviews' },
            { id: 'verified', label: 'Decided' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ kyc: open.length, reviews: flagged.length, verified: done.length }}
        />
      </View>
      {tab === 'reviews' ? (
        <FlatList
          data={flagged}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
          ListEmptyComponent={<EmptyBlock icon="chatbox-ellipses-outline" title="No flagged reviews" />}
          renderItem={({ item }) => (
            <Card style={{ gap: 8 }}>
              <Text size={11} weight="bold" color={t.c.muted}>
                {item.targetName} · {item.overall}★ by {item.authorName} · {item.verifiedBooking ? 'verified booking' : 'no booking'}
              </Text>
              <Text size={14} color={t.c.textStrong}>
                “{item.text}”
              </Text>
              <Text size={12} color={t.c.warning}>
                {item.flagReason}
              </Text>
              <View style={styles.row}>
                <KButton label="Remove" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => moderate(item.id, false)} />
                <KButton label="Keep & publish" variant="success" size="sm" style={{ flex: 1 }} onPress={() => moderate(item.id, true)} />
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={tab === 'kyc' ? open : done}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
          ListEmptyComponent={<EmptyBlock icon="shield-checkmark-outline" title="All caught up" />}
          renderItem={({ item }) => <CaseCard vc={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
});
