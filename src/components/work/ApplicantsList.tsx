import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KButton, KField, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { rankFreelancers } from '@/services/matching';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatShortDate, formatTime } from '@/utils/format';

import { GigCard } from './GigCard';

const HIRED = ['hired', 'confirmed', 'checked_in', 'completed'];

/** Applicant review for a gig: compare, shortlist, hire, reject; shows on-site check-ins. */
export function ApplicantsList({ gig }: { gig: Gig }) {
  const t = useRoleTheme();
  const setStatus = useDb((s) => s.setApplicationStatus);
  const pool = useDb((s) => s.freelancerPool)();
  const hiredCount = gig.applications.filter((a) => HIRED.includes(a.status)).length;
  const full = hiredCount >= gig.slots;

  if (!gig.applications.length) {
    return <EmptyBlock icon="hourglass-outline" title="Waiting for applicants" message="Matching freelancers have been notified. Invite top matches below to speed things up." />;
  }

  return (
    <View style={{ gap: 10 }}>
      {gig.applications.map((a) => {
        const profile = pool.find((f) => f.id === a.freelancerId);
        return (
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
                    {a.rating.toFixed(1)} · asks {formatMoney(a.expectedPay)}
                    {profile ? ` · reliability ${profile.reliability} · ${profile.completedGigs} gigs` : ''}
                  </Text>
                </View>
                {profile && (
                  <Text size={11} color={t.c.muted} numberOfLines={1}>
                    {profile.city} · {profile.equipment.map((e) => e.name).join(', ') || 'no equipment listed'}
                  </Text>
                )}
              </View>
              <StatusPill status={a.status} />
            </View>
            {!!a.message && (
              <Text size={13} color={t.c.text}>
                “{a.message}”
              </Text>
            )}
            <Text size={11} color={t.c.muted}>
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
                  missing={full && 'Every place on this gig is filled. Add more people needed to hire again.'}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setStatus(gig.id, a.id, 'hired');
                    toast(`${a.freelancerName} hired${gig.bookingId ? ' & added to the crew' : ''}`, 'person-add');
                  }}
                />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

/** Full gig management for the poster (vendor or platform). */
export function GigManage({ gig }: { gig: Gig }) {
  const t = useRoleTheme();
  const availability = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const pool = useDb((s) => s.freelancerPool)();
  const invite = useDb((s) => s.inviteToGig);
  const answer = useDb((s) => s.answerGigQuestion);
  const cancelGig = useDb((s) => s.cancelGig);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ranked = rankFreelancers(
    { role: gig.skill, date: gig.date, city: gig.city, pay: gig.pay, equipment: gig.equipment ?? [], emergency: gig.emergency },
    { availability, rules, pool, skipIds: gig.applications.map((a) => a.freelancerId) },
    { limit: 6 },
  );

  return (
    <View style={{ gap: 16 }}>
      <GigCard gig={gig} showApplicants />
      {(!!gig.description || gig.requirements.length > 0) && (
        <Card style={{ gap: 6 }}>
          {!!gig.description && (
            <Text size={14} color={t.c.text}>
              {gig.description}
            </Text>
          )}
          {gig.requirements.map((r) => (
            <Text key={r} size={13} color={t.c.muted}>
              • {r}
            </Text>
          ))}
          {gig.bookingId && (
            <Text size={12} color={t.c.info}>
              Linked to a booking crew slot — hired freelancers are added to the wedding crew automatically.
            </Text>
          )}
        </Card>
      )}
      <View>
        <SectionTitle title={`Applicants (${gig.applications.length})`} />
        <ApplicantsList gig={gig} />
      </View>
      {gig.status === 'open' && ranked.length > 0 && (
        <View>
          <SectionTitle title={gig.emergency ? 'Best available right now' : 'Suggested freelancers'} />
          <View style={{ gap: 8 }}>
            {ranked.map((r) => {
              const invited = gig.invited?.includes(r.freelancer.id);
              return (
                <Card key={r.freelancer.id} style={styles.row}>
                  <Avatar name={r.freelancer.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="bold" color={t.c.textStrong}>
                      {r.freelancer.name} <Text size={12} color={t.c.primary}>· {Math.round(r.score)}</Text>
                    </Text>
                    <Text size={12} color={t.c.muted} numberOfLines={1}>
                      {[...r.reasons, ...r.warnings].join(' · ')}
                    </Text>
                  </View>
                  <KButton
                    label={invited ? 'Invited' : 'Invite'}
                    size="sm"
                    variant={invited ? 'ghost' : 'secondary'}
                    missing={invited && `${r.freelancer.name} is already invited`}
                    onPress={() => {
                      invite(gig.id, r.freelancer.id);
                      toast(`Invited ${r.freelancer.name}`, 'paper-plane');
                    }}
                  />
                </Card>
              );
            })}
          </View>
        </View>
      )}
      {!!gig.questions?.length && (
        <View>
          <SectionTitle title="Questions" />
          <View style={{ gap: 8 }}>
            {gig.questions.map((q) => (
              <Card key={q.id} style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.textStrong}>
                  {q.freelancerName}: {q.question}
                </Text>
                {q.answer ? (
                  <Text size={13} color={t.c.success}>
                    ↳ {q.answer}
                  </Text>
                ) : (
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <KField placeholder="Answer" value={answers[q.id] ?? ''} onChangeText={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))} />
                    </View>
                    <KButton label="Reply" size="sm" missing={!answers[q.id]?.trim() && 'Type your answer first'} onPress={() => answer(gig.id, q.id, answers[q.id].trim())} />
                  </View>
                )}
              </Card>
            ))}
          </View>
        </View>
      )}
      {gig.status === 'open' && <KButton label="Cancel gig" variant="danger" size="sm" onPress={() => confirm('Cancel this gig?', 'Applicants will be notified.', 'Cancel gig', () => cancelGig(gig.id))} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
