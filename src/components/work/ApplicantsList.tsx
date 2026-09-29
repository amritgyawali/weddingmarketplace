import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KButton, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig } from '@/types/platform';
import { formatINR, formatShortDate, formatTime } from '@/utils/format';

/** Applicant review for a gig: shortlist, hire, reject; shows on-site check-ins. */
export function ApplicantsList({ gig }: { gig: Gig }) {
  const t = useRoleTheme();
  const setStatus = useDb((s) => s.setApplicationStatus);
  const hiredCount = gig.applications.filter((a) => a.status === 'hired' || a.status === 'completed').length;
  const full = hiredCount >= gig.slots;

  if (!gig.applications.length) {
    return <EmptyBlock icon="hourglass-outline" title="Waiting for applicants" message="Matching freelancers have been notified. Applications usually arrive within a few hours." />;
  }

  return (
    <View style={{ gap: 10 }}>
      {gig.applications.map((a) => (
        <Card key={a.id} style={{ gap: 10 }}>
          <View style={styles.row}>
            <Avatar name={a.freelancerName} size={44} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                {a.freelancerName}
              </Text>
              <View style={styles.row}>
                <Ionicons name="star" size={12} color={t.c.warning} />
                <Text size={12} color={t.c.muted}>
                  {a.rating.toFixed(1)} · {a.skill} · asks {formatINR(a.expectedPay)}
                </Text>
              </View>
            </View>
            <StatusPill status={a.status} />
          </View>
          {!!a.message && (
            <Text size={13} color={t.c.text}>
              “{a.message}”
            </Text>
          )}
          <Text size={11} color={t.c.subtle}>
            Applied {formatShortDate(a.appliedAt)}
            {a.checkInAt ? ` · checked in ${formatTime(a.checkInAt)}` : ''}
            {a.checkOutAt ? ` · out ${formatTime(a.checkOutAt)}` : ''}
          </Text>
          {(a.status === 'applied' || a.status === 'shortlisted') && gig.status === 'open' && (
            <View style={styles.row}>
              <KButton label="Reject" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setStatus(gig.id, a.id, 'rejected')} />
              {a.status === 'applied' && <KButton label="Shortlist" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setStatus(gig.id, a.id, 'shortlisted')} />}
              <KButton
                label="Hire"
                size="sm"
                disabled={full}
                style={{ flex: 1 }}
                onPress={() => {
                  setStatus(gig.id, a.id, 'hired');
                  toast(`${a.freelancerName} hired`, 'person-add');
                }}
              />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
