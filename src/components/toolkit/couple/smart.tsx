/** Couple toolkit, smart planning: health check, headcount forecast, fair price check, family vote and marriage registration. */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, ListRow, ProgressBar, SectionTitle, StatusPill, type IconName } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { sameServiceArea } from '@/data/cities';
import { PROVIDERS } from '@/data/providers';
import { CORE_SERVICES, SERVICE_BY_ID, serviceName } from '@/data/services';
import { DEFAULT_TURNOUT, headcountForecast, parseOptions, priceCheck, registrationDeadline, REGISTRATION_DAYS, tallyVotes, weddingHealth, type HealthPart, type PriceVerdict } from '@/services/insights';
import { paymentSummary } from '@/services/pricing';
import { missingServices, nextBestAction, planningProgress, questionsToAsk } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';
import { daysUntil, formatLongDate, formatMoney, formatShortDate, percent, today } from '@/utils/format';
import { openWhatsApp } from '@/utils/links';

import { EntryList, Hint, Line, NumberField, StatRow, ToolPage, useToolEntries, useToolState } from '../core';
import { useWedding } from './shared';

const NO_PLAN = { title: 'Start your plan first', message: 'Tell us your date, city and guests and this tool fills itself in from your plan.' };

function NoPlan({ title }: { title: string }) {
  return (
    <ToolPage title={title}>
      <EmptyBlock icon="sparkles-outline" title={NO_PLAN.title} message={NO_PLAN.message} action="Plan my wedding" onAction={() => router.push('/plan')} />
    </ToolPage>
  );
}

// ─── Wedding health check ───────────────────────────────────────────────────

const PART_ACTION: Record<HealthPart['id'], { label: string; href: Href; icon: IconName }> = {
  vendors: { label: 'Book your remaining services', href: '/my-wedding?tab=services', icon: 'storefront-outline' },
  payments: { label: 'Clear overdue payments', href: '/my-wedding?tab=payments', icon: 'card-outline' },
  tasks: { label: 'Finish your shared tasks', href: '/my-wedding?tab=tasks', icon: 'checkbox-outline' },
  guests: { label: 'Invite guests and chase replies', href: '/guests', icon: 'people-outline' },
  contracts: { label: 'Sign your contracts', href: '/contracts', icon: 'document-text-outline' },
  budget: { label: 'Bring the budget back in line', href: '/budget', icon: 'wallet-outline' },
};

const PACE_LABEL = { ahead: 'Ahead of schedule', on_track: 'On track', behind: 'Behind schedule', done: 'All set' } as const;
const PACE_STATUS = { ahead: 'won', on_track: 'confirmed', behind: 'overdue', done: 'done' } as const;

export function HealthCheck() {
  const t = useRoleTheme();
  const w = useWedding();
  const quotes = useDb((s) => s.quotes);
  const contracts = useDb((s) => s.contracts);
  if (!w.project) return <NoPlan title="Plan health check" />;
  const p = w.project;
  const progress = planningProgress(p);
  const mine = contracts.filter((c) => c.projectId === p.id && c.status !== 'void');
  const invited = w.guests.filter((g) => g.invites.some((i) => i.sentAt || i.rsvp !== 'pending')).length;
  const responded = w.guests.filter((g) => g.invites.some((i) => i.rsvp !== 'pending')).length;
  const committed = p.bookings.filter((b) => b.status !== 'CANCELLED').reduce((s, b) => s + b.agreedPrice, 0);
  const days = daysUntil(p.weddingDate);
  const h = weddingHealth({
    daysToGo: days,
    services: progress.services,
    missingServices: missingServices(p).length,
    tasks: progress.tasks,
    overdueMilestones: paymentSummary(p).overdue.length,
    guests: { total: w.guests.length, invited, responded },
    contracts: { signed: mine.filter((c) => c.status === 'signed').length, total: mine.length },
    budget: p.budget,
    committed,
  });
  const next = nextBestAction(p, quotes);
  return (
    <ToolPage title="Plan health check" subtitle={`${w.names} · ${days >= 0 ? `${days} days to go` : 'Celebrated'}`}>
      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              Readiness
            </Text>
            <StatusPill status={PACE_STATUS[h.pace]} label={PACE_LABEL[h.pace]} />
          </View>
          <Text size={40} weight="semibold" serif color={h.pace === 'behind' ? t.c.danger : t.c.textStrong}>
            {h.score}
          </Text>
        </View>
        <ProgressBar value={h.score / 100} height={6} color={h.pace === 'behind' ? t.c.danger : h.score >= 80 ? t.c.success : undefined} />
        <Hint>{days > 0 ? `Couples with ${days} days to go are usually around ${h.expected} out of 100.` : 'Your day has come. Anything left below is wrap-up.'}</Hint>
      </Card>

      <SectionTitle title="Do this first" />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <ListRow icon="flash-outline" title={next.title} subtitle={next.body} onPress={() => router.push(next.href as Href)} />
      </Card>

      <SectionTitle title="Where you stand" />
      <Card style={{ gap: 12 }}>
        {h.parts.map((part) => (
          <View key={part.id} style={{ gap: 4 }}>
            <View style={styles.between}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {part.label}
              </Text>
              <Text size={13} color={t.c.muted}>
                {Math.round(part.value * part.weight)} / {part.weight}
              </Text>
            </View>
            <ProgressBar value={part.value} color={part.value < 0.4 ? t.c.danger : part.value >= 0.9 ? t.c.success : undefined} />
            <Text size={12} color={t.c.muted}>
              {part.detail}
            </Text>
          </View>
        ))}
      </Card>

      {h.gaps.length > 0 && (
        <View>
          <SectionTitle title="Biggest gains next" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {h.gaps.slice(0, 4).map((g) => (
              <ListRow key={g.id} icon={PART_ACTION[g.id].icon} title={PART_ACTION[g.id].label} subtitle={`Up to ${Math.round(g.weight * (1 - g.value))} points · ${g.detail}`} onPress={() => router.push(PART_ACTION[g.id].href)} />
            ))}
          </Card>
        </View>
      )}
      <Hint>The score weighs vendors booked (30), payments on time (15), tasks (15), guests and replies (15), contracts (10) and budget (15). It is worked out live from your plan and never shared with vendors.</Hint>
    </ToolPage>
  );
}

// ─── Headcount forecast ─────────────────────────────────────────────────────

export function HeadcountForecast() {
  const t = useRoleTheme();
  const w = useWedding();
  const [s, set] = useToolState(w.owner, 'couple.headcount', { maybe: DEFAULT_TURNOUT.maybe * 100, pending: DEFAULT_TURNOUT.pending * 100, buffer: DEFAULT_TURNOUT.buffer * 100 });
  if (!w.project) return <NoPlan title="Headcount forecast" />;
  // Functions still to come (or not yet dated); past ones need no plates.
  const upcoming = w.events.filter((e) => !e.date || e.date >= today());
  const rows = headcountForecast(w.guests, upcoming.length ? upcoming : w.events, { maybe: Number(s.maybe) / 100, pending: Number(s.pending) / 100, buffer: Number(s.buffer) / 100 });
  const replied = w.guests.filter((g) => g.invites.some((i) => i.rsvp !== 'pending')).length;
  return (
    <ToolPage title="Headcount forecast" subtitle="How many will really come, and how many plates to order">
      <StatRow
        items={[
          { label: 'Guests on the list', value: String(w.guests.length) },
          { label: 'Replied', value: w.guests.length ? percent(replied / w.guests.length) : '—' },
          { label: 'Plates, all functions', value: String(rows.reduce((n, r) => n + r.plates, 0)) },
        ]}
      />
      {w.guests.length === 0 ? (
        <EmptyBlock icon="people-outline" title="No guests yet" message="Add your guest list and invite them to each function. The forecast updates as replies come in." action="Open guests" onAction={() => router.push('/guests')} />
      ) : (
        rows.map((r) => {
          const gap = r.planned ? r.expected - r.planned : 0;
          if (!r.invited)
            return (
              <Card key={r.eventId} style={{ gap: 2 }}>
                <View style={styles.between}>
                  <Text size={16} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                    {r.name}
                  </Text>
                  <Text size={13} color={t.c.muted}>
                    {r.date ? formatShortDate(r.date) : 'Date to be set'}
                  </Text>
                </View>
                <Text size={13} color={t.c.muted}>
                  No one invited to this function yet.
                </Text>
              </Card>
            );
          return (
            <Card key={r.eventId} style={{ gap: 2 }}>
              <View style={styles.between}>
                <Text size={16} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                  {r.name}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {r.date ? formatShortDate(r.date) : 'Date to be set'}
                </Text>
              </View>
              <Text size={13} color={t.c.muted} style={{ marginBottom: 6 }}>
                {r.invited} households invited · {r.yes} yes · {r.maybe} maybe · {r.pending} no reply · {r.no} declined
              </Text>
              <Line label="Confirmed" value={String(r.floor)} note="Only those who said yes" />
              <Line label="Expected" value={String(r.expected)} strong />
              <Line label="Everyone not declined" value={String(r.ceiling)} note="The most that could come" />
              <Line label="Plates to order" value={String(r.plates)} strong note={`Expected plus ${s.buffer}% buffer, rounded to tables of 10`} />
              {r.planned > 0 && Math.abs(gap) >= 20 && (
                <Text size={13} color={gap > 0 ? t.c.danger : t.c.muted} style={{ marginTop: 6 }}>
                  {gap > 0 ? `About ${gap} more than the ${r.planned} you planned for. Tell your caterer and venue.` : `${-gap} fewer than the ${r.planned} you planned for. If your guest list is complete, ask your caterer about a lower plate guarantee.`}
                </Text>
              )}
            </Card>
          );
        })
      )}
      <SectionTitle title="Turnout assumptions" />
      <Card style={{ gap: 10 }}>
        <NumberField label="“Maybe” guests who come (%)" value={Number(s.maybe)} onChange={(n) => set({ maybe: Math.min(100, n) })} />
        <NumberField label="Guests with no reply who come anyway (%)" value={Number(s.pending)} onChange={(n) => set({ pending: Math.min(100, n) })} />
        <NumberField label="Extra plates buffer (%)" value={Number(s.buffer)} onChange={(n) => set({ buffer: Math.min(50, n) })} />
      </Card>
      <Hint>In Nepal many relatives never reply but still come, and a household often brings more people than its card says. Most caterers bill a minimum guarantee, so order the forecast, not the ceiling.</Hint>
    </ToolPage>
  );
}

// ─── Fair price check ───────────────────────────────────────────────────────

const VERDICT: Record<PriceVerdict, { label: string; status: string; tip: string }> = {
  good: { label: 'Good price', status: 'won', tip: 'Below most similar providers. Confirm exactly what is included before you book: a low price sometimes leaves things out.' },
  fair: { label: 'Fair price', status: 'confirmed', tip: 'In line with the market. Ask for a small extra (an album page, a longer shoot, free tasting) rather than a discount.' },
  high: { label: 'On the high side', status: 'pending', tip: 'Above most similar providers. Ask what makes it worth more, or for a weekday or off-peak price.' },
  very_high: { label: 'Well above the market', status: 'overdue', tip: 'Much higher than similar providers nearby. Get two more quotes before deciding, and share them when you negotiate.' },
};

export function PriceCheck() {
  const t = useRoleTheme();
  const w = useWedding();
  const add = useDb((s) => s.addToolEntry);
  const remove = useDb((s) => s.removeToolEntry);
  const saved = useToolEntries(w.owner, 'couple.pricecheck');
  const planServices = w.project?.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId) ?? [];
  const options = [...new Set([...planServices, ...CORE_SERVICES])].filter((id) => SERVICE_BY_ID[id]);
  const [serviceId, setServiceId] = useState(options[0] ?? 'venue');
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [vendor, setVendor] = useState('');
  const svc = SERVICE_BY_ID[serviceId];
  const market = PROVIDERS.filter((p) => p.serviceId === serviceId && (sameServiceArea(p.city, w.city) || p.serviceAreas.includes(w.city))).map((p) => p.startingPrice);
  const check = price > 0 && svc ? priceCheck(price, market, svc.priceRange) : null;
  const unit = svc?.unit ?? 'per event';
  const save = () => {
    if (!check) return;
    add({ ownerId: w.owner, tool: 'couple.pricecheck', title: vendor.trim() || serviceName(serviceId), group: serviceId, amount: price, qty, status: check.verdict, date: today(), fields: { median: check.median } });
    toast('Price check saved');
    setVendor('');
  };
  return (
    <ToolPage title="Fair price check" subtitle={`Is a quote fair for ${w.city}?`}>
      <Card style={{ gap: 10 }}>
        <Text size={13} weight="medium" color={t.c.text}>
          Service
        </Text>
        <ChoiceChips options={options.map(serviceName)} selected={[serviceName(serviceId)]} onToggle={(label) => setServiceId(options.find((o) => serviceName(o) === label) ?? serviceId)} />
        <NumberField label={`Quoted price ${unit}`} money value={price} onChange={setPrice} />
        {unit !== 'per event' && unit !== 'per package' && <NumberField label={`How many (${unit.replace('per ', '')}s)`} value={qty} onChange={(n) => setQty(Math.max(1, n))} />}
        <KField label="Vendor (optional)" value={vendor} onChangeText={setVendor} placeholder="Who quoted it" />
      </Card>
      {check ? (
        <Card style={{ gap: 4 }}>
          <View style={[styles.between, { marginBottom: 6 }]}>
            <Text size={16} weight="semibold" color={t.c.textStrong}>
              {serviceName(serviceId)}
            </Text>
            <StatusPill status={VERDICT[check.verdict].status} label={VERDICT[check.verdict].label} />
          </View>
          <Line label="Market middle" value={formatMoney(check.median)} note={check.basis === 'listings' ? `${check.samples} similar providers in your area, ${unit}` : `Typical Nepal range ${unit} (few listings nearby)`} />
          <Line label="Most charge between" value={`${formatMoney(check.p25)} – ${formatMoney(check.p75)}`} />
          <Line label="Cheaper than this quote" value={percent(check.percentile)} note="Share of similar providers below your quote" />
          {check.overMedian > 0 && <Line label="Above the middle, in total" value={formatMoney(check.overMedian * qty)} tone="danger" strong />}
          <Text size={14} color={t.c.text} style={{ marginTop: 8 }}>
            {VERDICT[check.verdict].tip}
          </Text>
          <KButton label="Save this check" variant="secondary" size="sm" style={{ marginTop: 8 }} onPress={save} />
        </Card>
      ) : (
        <Hint>Enter the price a vendor quoted you. We compare it with the starting prices of similar providers in your city.</Hint>
      )}
      <SectionTitle title="Questions to ask before you book" />
      <Card style={{ gap: 6 }}>
        {questionsToAsk(serviceId).map((q) => (
          <Text key={q} size={14} color={t.c.text}>
            • {q}
          </Text>
        ))}
      </Card>
      {saved.length > 0 && (
        <View>
          <SectionTitle title={`Saved checks (${saved.length})`} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {[...saved]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((e) => (
                <ListRow
                  key={e.id}
                  icon="pricetag-outline"
                  title={e.title}
                  subtitle={`${serviceName(e.group ?? '')} · ${formatMoney(e.amount ?? 0)} · market ${formatMoney(Number(e.fields?.median ?? 0))}`}
                  trailing={<StatusPill status={VERDICT[(e.status as PriceVerdict) ?? 'fair']?.status ?? 'confirmed'} label={VERDICT[(e.status as PriceVerdict) ?? 'fair']?.label} />}
                  onPress={() => confirm('Remove this check?', e.title, 'Remove', () => remove(e.id))}
                />
              ))}
          </Card>
        </View>
      )}
      <Hint>Listed starting prices are where providers begin; a full package is usually higher. Use this as a guide when you negotiate, not as a final word.</Hint>
    </ToolPage>
  );
}

// ─── Family vote ────────────────────────────────────────────────────────────

export function FamilyVote() {
  const t = useRoleTheme();
  const w = useWedding();
  const add = useDb((s) => s.addToolEntry);
  const update = useDb((s) => s.updateToolEntry);
  const remove = useDb((s) => s.removeToolEntry);
  const polls = useToolEntries(w.owner, 'couple.votes').sort((a, b) => Number(!!a.done) - Number(!!b.done) || b.createdAt.localeCompare(a.createdAt));
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const options = parseOptions(optionsText);
  const me = w.account;
  const start = () => {
    const created = add({ ownerId: w.owner, tool: 'couple.votes', title: question.trim(), fields: { options: options.join('\n') } });
    if (!created) return;
    setQuestion('');
    setOptionsText('');
    toast('Vote started. Family who joined your plan can vote now');
  };
  return (
    <ToolPage title="Family vote" subtitle="Settle choices together: venues, menus, outfits, dates">
      <Card style={{ gap: 10 }}>
        <KField label="Question" value={question} onChangeText={setQuestion} placeholder="e.g. Which venue for the reception?" maxLength={120} />
        <KField label="Options, one per line" value={optionsText} onChangeText={setOptionsText} multiline placeholder={'Everest Grand\nHotel Shanker\nGarden at home'} maxLength={300} />
        <KButton label="Start the vote" icon="checkmark-done-outline" missing={!question.trim() ? 'Enter a question' : options.length < 2 ? 'Add at least two options, one per line' : null} onPress={start} />
      </Card>
      {polls.length === 0 && <EmptyBlock icon="hand-left-outline" title="No votes yet" message="Everyone who joined your plan sees the same votes and taps their choice. The one with most votes wins." />}
      {polls.map((poll) => {
        const opts = String(poll.fields?.options ?? '').split('\n').filter(Boolean);
        const tally = tallyVotes(opts, poll.fields);
        const mine = poll.fields?.[`vote:${me.id}`];
        const voters = (i: number) =>
          Object.entries(poll.fields ?? {})
            .filter(([k, v]) => k.startsWith('vote:') && Number(v) === i)
            .map(([k]) => String(poll.fields?.[`name:${k.slice(5)}`] ?? 'Someone'));
        const vote = (i: number) => update(poll.id, { fields: { ...poll.fields, [`vote:${me.id}`]: i, [`name:${me.id}`]: me.name.split(' ')[0] } });
        return (
          <Card key={poll.id} style={{ gap: 10 }}>
            <View style={styles.between}>
              <Text size={16} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                {poll.title}
              </Text>
              {poll.done ? <StatusPill status="done" label="Decided" /> : <StatusPill status="open" label={`${tally.total} vote${tally.total === 1 ? '' : 's'}`} />}
            </View>
            {opts.map((o, i) => {
              const share = tally.total ? tally.counts[i] / tally.total : 0;
              const picked = Number(mine) === i && mine !== undefined;
              const names = voters(i);
              return (
                <Pressable key={o} disabled={!!poll.done} onPress={() => vote(i)} accessibilityRole="radio" accessibilityState={{ checked: picked }} accessibilityLabel={o} style={[styles.option, { borderColor: picked ? t.c.primary : t.c.border }]}>
                  <View style={styles.between}>
                    <Text size={15} weight={picked ? 'semibold' : 'regular'} color={t.c.textStrong} style={{ flex: 1 }}>
                      {o}
                    </Text>
                    <Text size={13} color={t.c.muted}>
                      {tally.counts[i]}
                    </Text>
                  </View>
                  <ProgressBar value={share} color={poll.done && tally.leaders.includes(o) ? t.c.success : undefined} />
                  {names.length > 0 && (
                    <Text size={12} color={t.c.muted}>
                      {names.join(', ')}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            {poll.done && tally.leaders.length > 0 && (
              <Text size={14} weight="semibold" color={t.c.success}>
                {tally.leaders.length === 1 ? `Decided: ${tally.leaders[0]}` : `Tie: ${tally.leaders.join(' and ')}`}
              </Text>
            )}
            <View style={styles.actions}>
              <KButton label={poll.done ? 'Reopen' : 'Close the vote'} size="sm" variant="secondary" onPress={() => update(poll.id, { done: !poll.done })} />
              <KButton
                label="Ask on WhatsApp"
                size="sm"
                variant="ghost"
                icon="logo-whatsapp"
                onPress={() => openWhatsApp(`${poll.title}\n\n${opts.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nReply with the number of your choice. Thank you!`)}
              />
              <KButton label="Delete" size="sm" variant="ghost" onPress={() => confirm('Delete this vote?', poll.title, 'Delete', () => remove(poll.id))} />
            </View>
          </Card>
        );
      })}
      <Hint>Votes are shared with everyone on your plan, one vote each. Invite family to your plan (My wedding → Team) so they can vote here, or ask on WhatsApp and decide together.</Hint>
    </ToolPage>
  );
}

// ─── Marriage registration ──────────────────────────────────────────────────

const REG_GROUPS = ['Before the wedding', 'At the ward office', 'After registering'];

const REG_PRESETS = [
  { title: 'Citizenship certificates of both partners', note: 'Originals and two photocopies each', group: REG_GROUPS[0] },
  { title: 'Passport-size photos', note: 'Two of each partner; some wards ask for one together', group: REG_GROUPS[0] },
  { title: 'A photo from the wedding ceremony', note: 'Many ward offices ask for one as proof', group: REG_GROUPS[0] },
  { title: 'Parents’ citizenship copies', note: 'Some wards ask for them; carry them to be safe', group: REG_GROUPS[0] },
  { title: 'Find the right ward office', note: 'Usually the ward of the groom’s permanent address; ask about either partner’s ward', group: REG_GROUPS[0] },
  { title: 'Both partners go in person', note: 'Take the originals with you', group: REG_GROUPS[1] },
  { title: 'Fill in the marriage registration form (vivah darta)', group: REG_GROUPS[1] },
  { title: 'Pay the fee and get a receipt', note: 'Set by each municipality; a late fee applies after 35 days', group: REG_GROUPS[1] },
  { title: 'Collect the marriage registration certificate', group: REG_GROUPS[1] },
  { title: 'Make five photocopies of the certificate', note: 'For visas, insurance and office records', group: REG_GROUPS[2] },
  { title: 'Migration certificate (basai sarai), if moving ward', group: REG_GROUPS[2] },
  { title: 'Update citizenship details, if you choose', note: 'Name or address after marriage is optional', group: REG_GROUPS[2] },
  { title: 'Update passport, bank KYC and nominees', group: REG_GROUPS[2] },
];

export function MarriageRegistration() {
  const t = useRoleTheme();
  const w = useWedding();
  const reg = registrationDeadline(w.date);
  const late = reg.daysLeft < 0;
  return (
    <ToolPage title="Marriage registration" subtitle="Register at your ward office within 35 days">
      <Card style={{ gap: 6 }}>
        <Text size={13} color={t.c.muted}>
          Register by
        </Text>
        <Text size={24} weight="semibold" serif color={late ? t.c.danger : t.c.textStrong}>
          {formatLongDate(reg.due)}
        </Text>
        <Text size={14} color={late ? t.c.danger : t.c.text}>
          {late ? `The ${REGISTRATION_DAYS}-day window has passed. You can still register; expect a small late fee.` : reg.started ? `${reg.daysLeft} days left to register without a late fee.` : `${REGISTRATION_DAYS} days after your wedding on ${formatShortDate(w.date)}.`}
        </Text>
      </Card>
      <EntryList
        ownerId={w.owner}
        tool="couple.registration"
        noun="step"
        checklist
        groupBy="group"
        groupOrder={REG_GROUPS}
        presets={REG_PRESETS}
        defaults={{ group: REG_GROUPS[0] }}
        fields={[
          { key: 'title', label: 'Step', kind: 'text', required: true },
          { key: 'group', label: 'When', kind: 'select', options: REG_GROUPS },
          { key: 'date', label: 'Planned date', kind: 'date' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
      />
      <Hint>A registered marriage is needed for passports, visas, the bride’s migration certificate and inheritance. Ward offices set their own document lists and fees, so call yours first. Court marriage at the District Court has a separate process.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  option: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
