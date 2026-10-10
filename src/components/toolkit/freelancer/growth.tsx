/** Freelancer toolkit: clients, certifications, reliability, collaborators and the gig pitch builder. */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, ProgressBar, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { reliabilityScore } from '@/data/freelancers';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatMoney, formatShortDate, percent, relativeDay } from '@/utils/format';
import { openWhatsApp } from '@/utils/links';

import { EntryList, Hint, Line, StatRow, ToolPage } from '../core';
import { useJobs } from './shared';

// ─── Clients and organisers ─────────────────────────────────────────────────

export function Clients() {
  const t = useRoleTheme();
  const { account, jobs } = useJobs();
  const organisers = [...new Set(jobs.map((j) => j.organiser))].map((name) => {
    const mine = jobs.filter((j) => j.organiser === name);
    return { name, count: mine.length, earned: mine.reduce((s, j) => s + j.pay, 0), last: mine[mine.length - 1]?.date };
  });
  return (
    <ToolPage title="Clients and organisers" subtitle="Studios, venues and couples you work with">
      {organisers.length > 0 && (
        <View>
          <SectionTitle title="From your Vivah jobs" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {organisers
              .sort((a, b) => b.count - a.count)
              .map((o, i) => (
                <View key={o.name} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text size={15} weight="semibold" color={t.c.textStrong}>
                      {o.name}
                    </Text>
                    <Text size={13} color={t.c.muted}>
                      {o.count} job{o.count > 1 ? 's' : ''}
                      {o.last ? ` · last ${formatShortDate(o.last)}` : ''}
                    </Text>
                  </View>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {formatMoney(o.earned)}
                  </Text>
                </View>
              ))}
          </Card>
        </View>
      )}
      <EntryList
        ownerId={account.id}
        tool="freelancer.clients"
        noun="client"
        defaults={{ group: 'Studio' }}
        groupBy="group"
        groupOrder={['Studio', 'Venue', 'Planner', 'Couple', 'Other']}
        fields={[
          { key: 'title', label: 'Name', kind: 'text', required: true },
          { key: 'group', label: 'Type', kind: 'select', options: ['Studio', 'Venue', 'Planner', 'Couple', 'Other'] },
          { key: 'f.contact', label: 'Contact person', kind: 'text' },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
          { key: 'f.rate', label: 'Rate they pay', kind: 'money' },
          { key: 'note', label: 'How they like to work', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.fields?.contact, e.fields?.phone, e.fields?.rate ? `${formatMoney(Number(e.fields.rate))}/day` : undefined].filter(Boolean).join(' · ') || undefined}
        rowActions={(e) => (e.fields?.phone ? [{ label: 'WhatsApp', onPress: () => openWhatsApp(`Namaste ${e.fields?.contact ?? e.title}! `, String(e.fields?.phone)) }] : [])}
        emptyTitle="Add clients from outside Vivah"
      />
    </ToolPage>
  );
}

// ─── Certifications ─────────────────────────────────────────────────────────

export function Certifications() {
  const { account } = useJobs();
  return (
    <ToolPage title="Skills and certificates" subtitle="Courses, licences and their renewal dates">
      <EntryList
        ownerId={account.id}
        tool="freelancer.certs"
        noun="certificate"
        sort={(a, b) => (a.date ?? '9').localeCompare(b.date ?? '9')}
        fields={[
          { key: 'title', label: 'Certificate or course', kind: 'text', required: true, placeholder: 'e.g. CAAN drone pilot permit, first aid' },
          { key: 'f.issuer', label: 'Issued by', kind: 'text' },
          { key: 'f.issued', label: 'Issued on', kind: 'date' },
          { key: 'date', label: 'Expires on', kind: 'date' },
          { key: 'f.link', label: 'Certificate link', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.issuer, e.date ? (daysUntil(e.date) < 0 ? `expired ${formatShortDate(e.date)}` : `renews ${relativeDay(e.date)}`) : 'no expiry'].filter(Boolean).join(' · ')}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Certificates', value: String(entries.length) },
              { label: 'Expiring in 60 days', value: String(entries.filter((e) => e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 60).length), alert: entries.some((e) => e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 60) },
              { label: 'Expired', value: String(entries.filter((e) => e.date && daysUntil(e.date) < 0).length), alert: entries.some((e) => e.date && daysUntil(e.date) < 0) },
            ]}
          />
        )}
        emptyMessage="Drone permits and first-aid training help you win higher-paying gigs — organisers can filter for them."
      />
    </ToolPage>
  );
}

// ─── Reliability coach ──────────────────────────────────────────────────────

export function ReliabilityCoach() {
  const t = useRoleTheme();
  const { account, ws } = useJobs();
  const done = ws.assignments.filter((a) => a.assignment.status === 'COMPLETED');
  const late = ws.assignments.filter((a) => (a.assignment.lateMinutes ?? 0) > 0);
  const noShows = ws.assignments.filter((a) => a.assignment.status === 'NO_SHOW').length;
  const cancelled = ws.applied.filter((g) => g.applications.some((x) => x.freelancerId === account.id && (x.status === 'withdrawn' || x.status === 'cancelled'))).length;
  const invites = ws.gigs.filter((g) => g.invited?.includes(account.id));
  const answered = invites.filter((g) => g.applications.some((x) => x.freelancerId === account.id && x.status !== 'invited')).length;
  const total = Math.max(1, done.length + cancelled);
  const responseRate = invites.length ? answered / invites.length : 1;
  const score = reliabilityScore({ cancellationRate: cancelled / total, rating: account.rating ?? 4.5, responseRate, completed: done.length, lateArrivals: late.length, noShows });
  const tips: string[] = [];
  if (late.length) tips.push(`You checked in late ${late.length} time${late.length > 1 ? 's' : ''}. Each late arrival costs 2 points — aim to arrive 30 minutes before call time.`);
  if (noShows) tips.push('A no-show costs 10 points. If you cannot make it, withdraw early so the organiser can replace you.');
  if (responseRate < 0.9) tips.push(`You answered ${percent(responseRate)} of invites. Reply to every invite, even with a no — it lifts your response score.`);
  if (done.length < 40) tips.push(`${done.length} completed jobs so far. Experience keeps adding points up to 40 jobs.`);
  if (!tips.length) tips.push('Excellent record. Keep checking in with GPS and uploading proof photos to stay at the top of matching.');
  return (
    <ToolPage title="Reliability coach" subtitle="What organisers and matching see">
      <Card style={{ gap: 8 }}>
        <View style={styles.between}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            Reliability score
          </Text>
          <Text size={28} weight="semibold" serif color={score < 60 ? t.c.danger : t.c.textStrong}>
            {score}
          </Text>
        </View>
        <ProgressBar value={score / 100} height={6} color={score >= 80 ? t.c.success : score < 60 ? t.c.danger : undefined} />
      </Card>
      <Card style={{ gap: 2 }}>
        <Line label="Completed jobs" value={String(done.length)} />
        <Line label="Late check-ins" value={String(late.length)} tone={late.length ? 'danger' : undefined} />
        <Line label="No-shows" value={String(noShows)} tone={noShows ? 'danger' : undefined} />
        <Line label="Withdrawn after hire" value={String(cancelled)} />
        <Line label="Invites answered" value={percent(responseRate)} />
        <Line label="Rating" value={`${(account.rating ?? 4.5).toFixed(1)}★`} />
      </Card>
      <SectionTitle title="How to improve" />
      {tips.map((tip) => (
        <Card key={tip}>
          <Text size={14} color={t.c.text}>
            {tip}
          </Text>
        </Card>
      ))}
    </ToolPage>
  );
}

// ─── Collaborators ──────────────────────────────────────────────────────────

export function Network() {
  const { account } = useJobs();
  return (
    <ToolPage title="Crew network" subtitle="Second shooters, assistants and people you trust">
      <EntryList
        ownerId={account.id}
        tool="freelancer.network"
        noun="person"
        groupBy="group"
        groupOrder={['Second shooter', 'Videographer', 'Assistant', 'Editor', 'Makeup', 'Other']}
        defaults={{ group: 'Second shooter' }}
        fields={[
          { key: 'title', label: 'Name', kind: 'text', required: true },
          { key: 'group', label: 'Works as', kind: 'select', options: ['Second shooter', 'Videographer', 'Assistant', 'Editor', 'Makeup', 'Other'] },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
          { key: 'f.city', label: 'City', kind: 'text' },
          { key: 'f.rate', label: 'Day rate', kind: 'money' },
          { key: 'f.trusted', label: 'I’d recommend them', kind: 'toggle' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.city, e.fields?.rate ? `${formatMoney(Number(e.fields.rate))}/day` : undefined, e.fields?.trusted ? 'recommended' : undefined, e.note].filter(Boolean).join(' · ') || undefined}
        rowActions={(e) => (e.fields?.phone ? [{ label: 'Ask if free', onPress: () => openWhatsApp(`Namaste ${e.title}! Are you free to join me on a wedding job? I'll share the date and pay.`, String(e.fields?.phone)) }] : [])}
        emptyMessage="When an organiser asks you to bring a team, this is your call list."
      />
    </ToolPage>
  );
}

// ─── Pitch builder ──────────────────────────────────────────────────────────

export function PitchBuilder() {
  const t = useRoleTheme();
  const { account, ws } = useJobs();
  const targets = ws.matched.slice(0, 5);
  const [gigId, setGigId] = useState<string | undefined>(targets[0]?.id);
  const [tone, setTone] = useState('Warm');
  const gig = targets.find((g) => g.id === gigId);
  const kit = (account.equipment ?? []).slice(0, 3).map((e) => e.name).join(', ');
  const years = account.experienceYears ?? 3;
  const opener = tone === 'Warm' ? 'Namaste!' : 'Hello,';
  const pitch = `${opener} I'm ${account.name}, a ${(account.skills ?? ['wedding freelancer'])[0].toLowerCase()} based in ${account.city} with ${years} years of wedding work${account.rating ? ` and a ${account.rating.toFixed(1)}★ rating on Vivah` : ''}.${gig ? ` I'd love to cover "${gig.title}" on ${formatShortDate(gig.date)} in ${gig.city}.` : ''}${kit ? ` I bring my own kit (${kit}).` : ''} ${tone === 'Warm' ? 'I know the rituals well and stay calm when timings shift.' : 'I arrive early, follow the run sheet and deliver on time.'}${gig ? ` My rate for this job is ${formatMoney(gig.pay)} as posted.` : ''} ${tone === 'Warm' ? 'Thank you!' : 'Thank you.'}`;
  return (
    <ToolPage title="Pitch builder" subtitle="A strong application message in one tap">
      {targets.length > 0 ? (
        <Card style={{ gap: 8 }}>
          <Text size={13} weight="medium" color={t.c.text}>
            Open gigs that match your skills
          </Text>
          <ChoiceChips options={targets.map((g) => `${g.title} · ${formatShortDate(g.date)}`)} selected={gig ? [`${gig.title} · ${formatShortDate(gig.date)}`] : []} onToggle={(label) => setGigId(targets.find((g) => `${g.title} · ${formatShortDate(g.date)}` === label)?.id)} />
        </Card>
      ) : (
        <Hint>No open gigs match your skills right now; this builds a general pitch.</Hint>
      )}
      <ChoiceChips options={['Warm', 'Professional']} selected={[tone]} onToggle={setTone} />
      <Card>
        <Text size={15} color={t.c.textStrong} lineHeight={22}>
          {pitch}
        </Text>
      </Card>
      <KButton label="Copy pitch" icon="copy-outline" onPress={() => Clipboard.setStringAsync(pitch).then(() => toast('Pitch copied — paste it into your application'))} />
      <Hint>Uses your profile: skills, city, experience, rating and equipment. A fuller profile makes a stronger pitch.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
