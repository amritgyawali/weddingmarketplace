import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KeyValue, KField, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BookingCard, CrewPanel, DeliverablesPanel } from '@/components/work/Bookings';
import { FilesPanel, NotesPanel, RiskList } from '@/components/work/Collab';
import { EventsPanel } from '@/components/work/EventsPanel';
import { MatchPanel } from '@/components/work/MatchPanel';
import { PaymentsPanel } from '@/components/work/Payments';
import { nextStatuses, PipelineStepper, STATUS_LABEL } from '@/components/work/Pipeline';
import { TaskBoard } from '@/components/work/TaskBoard';
import { TimelineView } from '@/components/work/Timeline';
import { photos } from '@/constants/images';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { findService, serviceName, SERVICES } from '@/data/services';
import { useLayout } from '@/hooks/useLayout';
import { projectEconomics, releasable } from '@/services/pricing';
import { quoteTotals } from '@/services/quotes';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectStatus, Requirement } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate, formatMoney, formatMoneyCompact, formatMoneyRange, formatPhone, formatShortDate, timeAgo } from '@/utils/format';

type Tab = 'overview' | 'services' | 'quote' | 'crew' | 'events' | 'payments' | 'tasks' | 'timeline' | 'chat' | 'notes' | 'files' | 'activity';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services & matching' },
  { id: 'quote', label: 'Quote' },
  { id: 'crew', label: 'Crew' },
  { id: 'events', label: 'Functions' },
  { id: 'payments', label: 'Money' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'chat', label: 'Chat' },
  { id: 'notes', label: 'Internal notes' },
  { id: 'files', label: 'Files' },
  { id: 'activity', label: 'Activity' },
];

function Summary({ project }: { project: Project }) {
  const t = useRoleTheme();
  const accounts = useSession((s) => s.accounts);
  const assign = useDb((s) => s.assignCoordinator);
  const setStatus = useDb((s) => s.setProjectStatus);
  const [statusOpen, setStatusOpen] = useState(false);
  const [coordOpen, setCoordOpen] = useState(false);
  const [note, setNote] = useState('');
  const staff = accounts.filter((a) => a.role === 'platform');
  const phone = project.customerPhone.replace(/\D/g, '');

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            {project.code} · {EVENT_TYPE_BY_ID[project.eventType]?.label} · {project.source.replace('_', ' ')}
          </Text>
          <Text size={20} weight="bold" color={t.c.textStrong}>
            {project.title}
          </Text>
          <Text size={13} color={t.c.muted}>
            {project.city}
            {project.area ? `, ${project.area}` : ''} · {formatLongDate(project.weddingDate)} · {project.guests} guests
          </Text>
        </View>
        <Pressable onPress={() => setStatusOpen(true)} accessibilityLabel="Change status">
          <StatusPill status={project.status} label={`${STATUS_LABEL[project.status]} ▾`} />
        </Pressable>
      </View>
      <PipelineStepper project={project} />
      <View style={styles.people}>
        <View style={[styles.person, { backgroundColor: t.c.surfaceAlt }]}>
          <Avatar name={project.customerName} size={34} />
          <View style={{ flex: 1 }}>
            <Text size={13} weight="bold" color={t.c.textStrong} numberOfLines={1}>
              {project.customerName}
            </Text>
            <Text size={11} color={t.c.muted}>
              {formatPhone(project.customerPhone)}
            </Text>
          </View>
          <Pressable onPress={() => Linking.openURL(`tel:+977${phone}`)} hitSlop={6} accessibilityLabel="Call customer">
            <Ionicons name="call" size={18} color={t.c.success} />
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`https://wa.me/977${phone}`)} hitSlop={6} accessibilityLabel="WhatsApp customer">
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          </Pressable>
        </View>
        <Pressable onPress={() => setCoordOpen(true)} style={[styles.person, { backgroundColor: project.coordinatorName ? t.c.surfaceAlt : `${t.c.danger}1A` }]} accessibilityLabel="Assign coordinator">
          <Ionicons name="person-circle" size={34} color={project.coordinatorName ? t.c.primary : t.c.danger} />
          <View style={{ flex: 1 }}>
            <Text size={13} weight="bold" color={t.c.textStrong} numberOfLines={1}>
              {project.coordinatorName ?? 'Unassigned'}
            </Text>
            <Text size={11} color={t.c.muted}>
              Coordinator · tap to {project.coordinatorName ? 'reassign' : 'assign'}
            </Text>
          </View>
        </Pressable>
      </View>
      <View style={styles.kvGrid}>
        <KeyValue label="Budget" value={project.budget ? formatMoney(project.budget) : project.budgetMode === 'per_service' ? 'Per service' : 'Not set'} />
        <KeyValue label="Functions" value={project.events.map((e) => `${e.name}${e.date ? ` ${formatShortDate(e.date).slice(4)}` : ' (TBC)'}`).join(' · ')} />
        {project.venueSelected && <KeyValue label="Venue chosen" value={project.venueSelected} />}
        {project.partnerName && <KeyValue label="Partner" value={project.partnerName} />}
      </View>
      {!!project.notes && (
        <View style={[styles.quote, { borderLeftColor: t.c.primary, backgroundColor: t.c.surfaceAlt }]}>
          <Text size={13} color={t.c.text} lineHeight={19}>
            “{project.notes}”
          </Text>
        </View>
      )}
      {project.inspiration.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {project.inspiration.map((p) => (
            <Image key={p} source={photos[p]} style={styles.inspo} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      <Sheet visible={statusOpen} onClose={() => setStatusOpen(false)} title="Move project to…">
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <KField placeholder="Note for the customer (optional)" value={note} onChangeText={setNote} />
          {nextStatuses(project.status).map((s) => (
            <KButton
              key={s}
              label={STATUS_LABEL[s]}
              variant={s === 'CANCELLED' || s === 'QUOTE_REJECTED' ? 'danger' : 'secondary'}
              onPress={() => {
                const apply = () => {
                  setStatus(project.id, s as ProjectStatus, note.trim() || undefined);
                  setStatusOpen(false);
                  setNote('');
                  toast(`Moved to ${STATUS_LABEL[s]}`);
                };
                if (s === 'CANCELLED') confirm('Cancel project?', 'The customer will be notified.', 'Cancel project', apply);
                else apply();
              }}
            />
          ))}
          {!nextStatuses(project.status).length && (
            <Text size={13} color={t.c.muted}>
              No manual transitions from {STATUS_LABEL[project.status]}.
            </Text>
          )}
        </View>
      </Sheet>
      <Sheet visible={coordOpen} onClose={() => setCoordOpen(false)} title="Assign coordinator">
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {staff.map((a) => (
            <KButton
              key={a.id}
              label={`${a.name} · ${a.team ?? 'Team'}`}
              variant={a.id === project.coordinatorId ? 'primary' : 'secondary'}
              onPress={() => {
                assign(project.id, { id: a.id, name: a.name });
                setCoordOpen(false);
                toast(`${a.name} now owns ${project.code}`);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Card>
  );
}

function Overview({ project, go }: { project: Project; go: (t: Tab) => void }) {
  const t = useRoleTheme();
  const gigs = useDb((s) => s.gigs);
  const quotes = useDb((s) => s.quotes);
  const runMatching = useDb((s) => s.runMatching);
  const risks = projectRisks(project, { gigs, quotes });
  const econ = projectEconomics(project);
  const open = project.requirements.filter((r) => r.status === 'OPEN' || r.status === 'MATCHING');

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <Text size={15} weight="bold" color={t.c.textStrong}>
          Risks & alerts
        </Text>
        <RiskList risks={risks} onPress={(r) => go(r.kind === 'PAYMENT_OVERDUE' ? 'payments' : r.kind === 'CREW_UNFILLED' || r.kind === 'EMERGENCY' ? 'crew' : 'services')} />
      </Card>
      <View style={styles.kpis}>
        {[
          { label: 'GMV', value: formatMoneyCompact(econ.gmv) },
          { label: 'Provider payouts', value: formatMoneyCompact(econ.providerCost) },
          { label: 'Platform revenue', value: formatMoneyCompact(econ.platformFees + econ.crewMargin), tone: t.c.success },
          { label: 'Take rate', value: `${Math.round(econ.takeRate * 1000) / 10}%` },
        ].map((k) => (
          <Card key={k.label} style={styles.kpi}>
            <Text size={11} color={t.c.muted}>
              {k.label}
            </Text>
            <Text size={17} weight="bold" color={k.tone ?? t.c.textStrong}>
              {k.value}
            </Text>
          </Card>
        ))}
      </View>
      <Card style={{ gap: 8 }}>
        <Text size={15} weight="bold" color={t.c.textStrong}>
          Services
        </Text>
        {project.requirements
          .filter((r) => r.status !== 'CANCELLED')
          .map((r) => {
            const b = project.bookings.find((x) => x.requirementId === r.id && x.status !== 'CANCELLED');
            return (
              <Pressable key={r.id} onPress={() => go('services')} style={styles.rowBetween}>
                <Text size={13} color={t.c.text} style={{ flex: 1 }}>
                  {serviceName(r.serviceId)}
                  {b ? ` · ${b.providerName}` : ''}
                </Text>
                <StatusPill status={b?.status === 'CONFIRMED' ? 'CONFIRMED' : r.status} label={r.status === 'CONFIRMED' ? 'Confirmed' : !b && (r.status === 'OPEN' || r.status === 'MATCHING') ? 'Missing ⚠' : undefined} />
              </Pressable>
            );
          })}
      </Card>
      <View style={styles.actions}>
        {open.length > 0 && (
          <KButton
            label={`Match ${open.length} open service${open.length > 1 ? 's' : ''}`}
            icon="git-compare-outline"
            size="sm"
            onPress={() => {
              open.forEach((r) => runMatching(project.id, r.id));
              toast('Matching complete', 'git-compare');
              go('services');
            }}
            style={{ flex: 1 }}
          />
        )}
        <KButton label="Quote" icon="document-text-outline" size="sm" variant="secondary" onPress={() => go('quote')} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function RequirementEditor({ project, requirement, onClose }: { project: Project; requirement: Requirement | null; onClose: () => void }) {
  const t = useRoleTheme();
  const update = useDb((s) => s.updateRequirement);
  const remove = useDb((s) => s.removeRequirement);
  const def = requirement ? findService(requirement.serviceId) : undefined;
  const [details, setDetails] = useState(requirement?.details ?? {});
  const [min, setMin] = useState(String(requirement?.budgetMin ?? ''));
  const [max, setMax] = useState(String(requirement?.budgetMax ?? ''));
  const [styles_, setStyles] = useState(requirement?.styles ?? []);
  const [eventIds, setEventIds] = useState(requirement?.eventIds ?? []);
  if (!requirement || !def) return null;
  return (
    <Sheet visible onClose={onClose} title={def.name}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <Text size={13} weight="semibold" color={t.c.muted}>
          Functions
        </Text>
        <ChoiceChips options={project.events.map((e) => e.name)} selected={project.events.filter((e) => eventIds.includes(e.id)).map((e) => e.name)} onToggle={(name) => {
          const e = project.events.find((x) => x.name === name)!;
          setEventIds((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]));
        }} />
        {def.fields.map((f) => (
          <View key={f.key} style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={t.c.muted}>
              {f.label}
            </Text>
            {f.kind === 'toggle' ? (
              <ChoiceChips options={['Yes', 'No']} selected={[details[f.key] ? 'Yes' : 'No']} onToggle={(v) => setDetails((d) => ({ ...d, [f.key]: v === 'Yes' }))} />
            ) : f.kind === 'choice' ? (
              <ChoiceChips options={f.options} selected={[String(details[f.key] ?? f.default)]} onToggle={(v) => setDetails((d) => ({ ...d, [f.key]: v }))} />
            ) : (
              <KField value={String(details[f.key] ?? f.default)} onChangeText={(v) => setDetails((d) => ({ ...d, [f.key]: Number(v.replace(/\D/g, '')) || 0 }))} keyboardType="number-pad" />
            )}
          </View>
        ))}
        <Text size={13} weight="semibold" color={t.c.muted}>
          Budget ({def.unit})
        </Text>
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <KField placeholder="Min" value={min} onChangeText={setMin} keyboardType="number-pad" prefix="NPR" />
          </View>
          <View style={{ flex: 1 }}>
            <KField placeholder="Max" value={max} onChangeText={setMax} keyboardType="number-pad" prefix="NPR" />
          </View>
        </View>
        <Text size={13} weight="semibold" color={t.c.muted}>
          Style
        </Text>
        <ChoiceChips options={def.styles} selected={styles_} onToggle={(v) => setStyles((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))} />
        <KButton
          label="Save requirement"
          onPress={() => {
            update(project.id, requirement.id, { details, budgetMin: Number(min) || undefined, budgetMax: Number(max) || undefined, styles: styles_, eventIds });
            onClose();
            toast('Requirement updated');
          }}
        />
        <KButton
          label="Remove service"
          variant="ghost"
          size="sm"
          onPress={() =>
            confirm('Remove this service?', 'Any proposed bookings stay until cancelled.', 'Remove', () => {
              remove(project.id, requirement.id);
              onClose();
            })
          }
        />
      </ScrollView>
    </Sheet>
  );
}

function Services({ project }: { project: Project }) {
  const t = useRoleTheme();
  const respondToBooking = useDb((s) => s.respondToBooking);
  const confirmBooking = useDb((s) => s.confirmBooking);
  const cancelBooking = useDb((s) => s.cancelBooking);
  const addRequirement = useDb((s) => s.addRequirement);
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const requirements = project.requirements.filter((r) => r.status !== 'CANCELLED');

  return (
    <View style={{ gap: 16 }}>
      <KButton label="Add service requirement" icon="add" variant="secondary" size="sm" onPress={() => setAdding(true)} />
      {requirements.map((r) => {
        const def = findService(r.serviceId);
        const bookings = project.bookings.filter((b) => b.requirementId === r.id);
        const events = project.events.filter((e) => r.eventIds.includes(e.id));
        return (
          <Card key={r.id} style={{ gap: 12 }}>
            <Pressable onPress={() => setEditing(r)} style={styles.rowBetween} accessibilityLabel={`Edit ${def?.name}`}>
              <View style={[styles.icon, { borderWidth: 1, borderColor: t.c.border }]}>
                <Ionicons name={(def?.icon ?? 'briefcase-outline') as never} size={20} color={t.c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={16} weight="bold" color={t.c.textStrong}>
                  {def?.name}
                </Text>
                <Text size={12} color={t.c.muted} numberOfLines={2}>
                  {events.map((e) => e.name).join(', ') || 'No function linked'} · {r.budgetMax ? `${formatMoneyRange(r.budgetMin ?? 0, r.budgetMax)} ${def?.unit}` : 'no budget'}
                  {r.styles.length ? ` · ${r.styles.join('/')}` : ''}
                </Text>
              </View>
              <StatusPill status={r.status} />
            </Pressable>
            <View style={styles.chips}>
              {Object.entries(r.details)
                .slice(0, 5)
                .map(([k, v]) => (
                  <View key={k} style={[styles.chip, { backgroundColor: t.c.surfaceAlt }]}>
                    <Text size={11} color={t.c.text}>
                      {def?.fields.find((f) => f.key === k)?.label ?? k}: {typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}
                    </Text>
                  </View>
                ))}
            </View>
            {bookings.map((b) => (
              <View key={b.id} style={{ gap: 8 }}>
                <BookingCard project={project} booking={b} mode="platform" onPress={() => setExpanded(expanded === b.id ? null : b.id)} />
                {b.status !== 'CANCELLED' && (
                  <View style={styles.actions}>
                    {b.providerResponse === 'pending' && (
                      <KButton label="Provider confirmed" size="sm" variant="secondary" icon="call-outline" onPress={() => respondToBooking(project.id, b.id, true, 'Confirmed by phone')} style={{ flex: 1 }} />
                    )}
                    {(b.status === 'PROPOSED' || b.status === 'HELD') && b.providerResponse === 'accepted' && (
                      <KButton label="Confirm booking" size="sm" icon="checkmark" onPress={() => confirmBooking(project.id, b.id)} style={{ flex: 1 }} />
                    )}
                    <KButton label="Cancel" size="sm" variant="ghost" onPress={() => confirm('Cancel this booking?', `${b.providerName} will be notified and the requirement reopens for matching.`, 'Cancel booking', () => cancelBooking(project.id, b.id, 'Cancelled by coordinator'))} />
                  </View>
                )}
                {expanded === b.id && <DeliverablesPanel project={project} booking={b} mode="platform" />}
              </View>
            ))}
            {r.status !== 'CONFIRMED' && <MatchPanel project={project} requirement={r} />}
          </Card>
        );
      })}
      <RequirementEditor key={editing?.id ?? 'none'} project={project} requirement={editing} onClose={() => setEditing(null)} />
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a service">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingBottom: 12 }}>
          <ChoiceChips
            options={SERVICES.filter((s) => !project.requirements.some((r) => r.serviceId === s.id && r.status !== 'CANCELLED')).map((s) => s.name)}
            selected={[]}
            onToggle={(name) => {
              const def = SERVICES.find((s) => s.name === name);
              if (def) addRequirement(project.id, def.id);
              setAdding(false);
            }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

function QuoteTab({ project }: { project: Project }) {
  const t = useRoleTheme();
  const quotes = useDb((s) => s.quotes);
  const draft = useDb((s) => s.draftProjectQuote);
  const reviseQuote = useDb((s) => s.reviseQuote);
  const list = quotes.filter((q) => q.projectId === project.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const bookings = project.bookings.filter((b) => b.status !== 'CANCELLED');
  return (
    <View style={{ gap: 12 }}>
      {!list.some((q) => q.fromKind === 'platform' && q.status !== 'declined') && (
        <Card style={{ gap: 8 }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Build the package quotation
          </Text>
          <Text size={13} color={t.c.muted}>
            {bookings.length} selected provider{bookings.length === 1 ? '' : 's'} become quote lines with their costs, your business model per line, package discount and service fee.
          </Text>
          <KButton
            label="Build quote from selected providers"
            icon="construct-outline"
            disabled={!bookings.length}
            onPress={() => {
              const q = draft(project.id);
              if (q) router.push({ pathname: '/platform/quote/[id]', params: { id: q.id } });
            }}
          />
        </Card>
      )}
      {list.map((q) => (
        <Card key={q.id} onPress={() => router.push({ pathname: '/platform/quote/[id]', params: { id: q.id } })} style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text size={12} weight="medium" color={t.c.muted}>
              {q.number} · v{q.version} · {q.fromKind === 'platform' ? 'Package' : q.fromName}
            </Text>
            <StatusPill status={q.status} />
          </View>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            {formatMoney(quoteTotals(q).total)}
          </Text>
          <Text size={12} color={t.c.muted}>
            {q.items.length} lines · margin {formatMoney(quoteTotals(q).margin)} · {q.versions.length} version{q.versions.length === 1 ? '' : 's'} sent
          </Text>
          {q.status === 'revision' && (
            <>
              <Text size={13} color={t.c.warning}>
                “{q.revisionNote}”
              </Text>
              <KButton
                label={`Prepare v${q.versions.length + 1}`}
                size="sm"
                icon="create-outline"
                onPress={() => {
                  reviseQuote(q.id);
                  router.push({ pathname: '/platform/quote/[id]', params: { id: q.id } });
                }}
              />
            </>
          )}
        </Card>
      ))}
    </View>
  );
}

function CrewTab({ project }: { project: Project }) {
  const t = useRoleTheme();
  const gigs = useDb((s) => s.gigs);
  const bookings = project.bookings.filter((b) => (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') && (b.crew.length || b.assignments.length));
  const projectGigs = gigs.filter((g) => g.projectId === project.id);
  return (
    <View style={{ gap: 14 }}>
      {projectGigs.filter((g) => g.status === 'open').map((g) => (
        <Card key={g.id} onPress={() => router.push({ pathname: '/platform/gig/[id]', params: { id: g.id } })} style={[styles.rowBetween, g.emergency && { borderColor: t.c.danger, borderWidth: 1 }]}>
          <Ionicons name={g.emergency ? 'medkit' : 'megaphone-outline'} size={20} color={g.emergency ? t.c.danger : t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="bold" color={t.c.textStrong}>
              {g.title}
            </Text>
            <Text size={12} color={t.c.muted}>
              {g.applications.length} applicant(s) · {g.invited?.length ?? 0} invited · {formatMoney(g.pay)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.c.subtle} />
        </Card>
      ))}
      {!bookings.length && <EmptyBlock icon="people-outline" title="No crew to staff yet" message="Crew plans appear once bookings are confirmed." />}
      {bookings.map((b) => (
        <Card key={b.id} style={{ gap: 10 }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            {serviceName(b.serviceId)} · {b.providerName}
          </Text>
          <CrewPanel project={project} booking={b} mode="platform" />
        </Card>
      ))}
    </View>
  );
}

function MoneyTab({ project }: { project: Project }) {
  const t = useRoleTheme();
  const payables = useDb((s) => s.payables);
  const revenue = useDb((s) => s.revenue);
  const release = useDb((s) => s.releasePayable);
  const mine = payables.filter((p) => p.projectId === project.id);
  const rev = revenue.filter((r) => r.projectId === project.id);
  const payments = useDb((s) => s.payments).filter((p) => p.projectId === project.id && p.status === 'SUCCEEDED');
  const collected = payments.reduce((s, p) => s + p.amount - p.refunded, 0);
  const paidOut = mine.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.kpis}>
        {[
          { label: 'Collected', value: formatMoney(collected) },
          { label: 'Paid out', value: formatMoney(paidOut) },
          { label: 'Escrow balance', value: formatMoney(collected - paidOut), tone: t.c.info },
          { label: 'Revenue', value: formatMoney(rev.reduce((s, r) => s + r.amount, 0)), tone: t.c.success },
        ].map((k) => (
          <Card key={k.label} style={styles.kpi}>
            <Text size={11} color={t.c.muted}>
              {k.label}
            </Text>
            <Text size={15} weight="bold" color={k.tone ?? t.c.textStrong}>
              {k.value}
            </Text>
          </Card>
        ))}
      </View>
      <Text size={13} weight="medium" color={t.c.muted}>
        Customer payments
      </Text>
      <PaymentsPanel project={project} mode="platform" />
      <Text size={13} weight="bold" color={t.c.muted}>
        PAYABLES (PROVIDERS & CREW)
      </Text>
      {mine.map((p) => (
        <Card key={p.id} style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {p.label}
              </Text>
              <Text size={12} color={t.c.muted}>
                {p.payeeKind} · due {formatShortDate(p.due)}
                {p.holdReason ? ` · ${p.holdReason}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                {formatMoney(p.amount)}
              </Text>
              <StatusPill status={p.status} />
            </View>
          </View>
          {(p.status === 'READY' || (p.status === 'ACCRUED' && releasable(p, project))) && <KButton label="Release payout" size="sm" variant="success" onPress={() => release(p.id)} />}
        </Card>
      ))}
      <Text size={13} weight="medium" color={t.c.muted}>
        Platform revenue
      </Text>
      {rev.map((r) => (
        <View key={r.id} style={styles.rowBetween}>
          <Text size={13} color={t.c.text} style={{ flex: 1 }}>
            {r.kind.replace('_', ' ').toLowerCase()} {r.note ? `· ${r.note}` : ''}
          </Text>
          <Text size={13} weight="bold" color={r.amount >= 0 ? t.c.success : t.c.danger}>
            {formatMoney(r.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ChatTab({ project }: { project: Project }) {
  const t = useRoleTheme();
  const threads = useDb((s) => s.threads);
  const openThread = useDb((s) => s.openThread);
  const list = threads.filter((th) => th.projectId === project.id);
  return (
    <View style={{ gap: 10 }}>
      {list.map((th) => (
        <Card key={th.id} onPress={() => router.push({ pathname: '/platform/inbox/[id]', params: { id: th.id } })} style={styles.rowBetween}>
          <Ionicons name={th.kind === 'project' ? 'people' : 'chatbubbles'} size={20} color={t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="bold" color={t.c.textStrong}>
              {th.title}
            </Text>
            <Text size={12} color={t.c.muted}>
              {th.members.map((m) => m.name.split(' ')[0]).join(', ')} · {timeAgo(th.lastAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.c.subtle} />
        </Card>
      ))}
      {project.bookings
        .filter((b) => b.status !== 'CANCELLED' && !list.some((th) => th.bookingId === b.id))
        .map((b) => (
          <KButton
            key={b.id}
            label={`Open ${serviceName(b.serviceId).toLowerCase()} thread with ${b.providerName}`}
            variant="ghost"
            size="sm"
            icon="add"
            onPress={() => {
              const id = openThread({
                kind: 'service',
                projectId: project.id,
                bookingId: b.id,
                title: `${serviceName(b.serviceId)} · ${b.providerName}`,
                members: [
                  { id: project.customerId, name: project.customerName, role: 'customer' },
                  ...(project.coordinatorId ? [{ id: project.coordinatorId, name: project.coordinatorName ?? 'Coordinator', role: 'platform' as const }] : []),
                  { id: b.providerAccountId ?? `listing_${b.providerId}`, name: b.providerName, role: 'vendor' },
                ],
              });
              router.push({ pathname: '/platform/inbox/[id]', params: { id } });
            }}
          />
        ))}
    </View>
  );
}

function Activity({ project }: { project: Project }) {
  const t = useRoleTheme();
  const audit = useDb((s) => s.audit);
  const ids = new Set([project.id, ...project.bookings.map((b) => b.id), ...project.bookings.flatMap((b) => b.assignments.map((a) => a.id))]);
  const entries = [
    ...project.statusHistory.map((h) => ({ at: h.at, text: `${h.by} → ${STATUS_LABEL[h.status]}${h.note ? ` (${h.note})` : ''}` })),
    ...audit.filter((a) => ids.has(a.entityId)).map((a) => ({ at: a.at, text: `${a.actorName}: ${a.action}${a.detail ? ` — ${a.detail}` : ''}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <View style={{ gap: 8 }}>
      {entries.map((e, i) => (
        <View key={i} style={styles.activity}>
          <View style={[styles.dot, { backgroundColor: t.c.primary }]} />
          <View style={{ flex: 1 }}>
            <Text size={13} color={t.c.text}>
              {e.text}
            </Text>
            <Text size={11} color={t.c.muted}>
              {timeAgo(e.at)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Coordinator console for one wedding project. */
export default function PlatformProject() {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const project = useDb((s) => s.projects.find((p) => p.id === id));
  const [tab, setTab] = useState<Tab>(initial ?? 'overview');

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Project" />
        <EmptyBlock title="Project not found" />
      </View>
    );
  }

  const content = (
    <>
      {tab === 'overview' && <Overview project={project} go={setTab} />}
      {tab === 'services' && <Services project={project} />}
      {tab === 'quote' && <QuoteTab project={project} />}
      {tab === 'crew' && <CrewTab project={project} />}
      {tab === 'events' && <EventsPanel project={project} mode="platform" />}
      {tab === 'payments' && <MoneyTab project={project} />}
      {tab === 'tasks' && <TaskBoard project={project} mode="platform" />}
      {tab === 'timeline' && <TimelineView project={project} mode="platform" />}
      {tab === 'chat' && <ChatTab project={project} />}
      {tab === 'notes' && <NotesPanel project={project} />}
      {tab === 'files' && <FilesPanel project={project} mode="platform" />}
      {tab === 'activity' && <Activity project={project} />}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={project.title} subtitle={`${project.code} · ${project.city} · ${STATUS_LABEL[project.status]}`} />
      {wide ? (
        <View style={styles.wide}>
          <ScrollView style={{ width: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Summary project={project} />
          </ScrollView>
          <View style={{ flex: 1 }}>
            <View style={{ paddingVertical: 12 }}>
              <Segmented options={TABS} value={tab} onChange={setTab} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>{content}</ScrollView>
          </View>
        </View>
      ) : (
        <>
          <View style={{ paddingVertical: 12 }}>
            <Segmented options={TABS} value={tab} onChange={setTab} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60, gap: 12 }}>
            {tab === 'overview' && <Summary project={project} />}
            {content}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  people: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  person: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 8 },
  kvGrid: { gap: 2 },
  quote: { borderLeftWidth: 3, borderRadius: 8, padding: 10 },
  inspo: { width: 70, height: 90, borderRadius: 8 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flex: 1, minWidth: 140, gap: 2, padding: 12 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activity: { flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  wide: { flex: 1, flexDirection: 'row' },
});
