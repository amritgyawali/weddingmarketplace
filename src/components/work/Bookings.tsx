import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, KButton, KField, ProgressBar, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { findService, serviceName } from '@/data/services';
import { rankFreelancers } from '@/services/matching';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Assignment, CrewRequirement, Deliverable, Project, ServiceBooking } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { daysUntil, formatClock, formatMoney, formatShortDate, formatTime, relativeDay } from '@/utils/format';

export type WorkMode = 'customer' | 'vendor' | 'platform' | 'freelancer';

const ACTIVE = ['ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];

export function crewFill(b: ServiceBooking) {
  const needed = b.crew.reduce((s, c) => s + c.count, 0);
  const filled = b.assignments.filter((a) => ACTIVE.includes(a.status)).length;
  return { needed, filled };
}

/** One provider booking. Money shown depends on who is looking. */
export function BookingCard({ project, booking, mode, onPress }: { project: Project; booking: ServiceBooking; mode: WorkMode; onPress?: () => void }) {
  const t = useRoleTheme();
  const def = findService(booking.serviceId);
  const events = project.events.filter((e) => booking.eventIds.includes(e.id));
  const { needed, filled } = crewFill(booking);
  const delivered = booking.deliverables.filter((d) => d.status === 'DELIVERED' || d.status === 'APPROVED').length;
  const status = booking.providerResponse === 'pending' && booking.status !== 'CANCELLED' ? 'pending' : booking.status;
  return (
    <Card onPress={onPress} style={{ gap: 10 }} accessibilityLabel={`${serviceName(booking.serviceId)} by ${booking.providerName}`}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
          <Ionicons name={(def?.icon ?? 'briefcase-outline') as never} size={20} color={t.c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="bold" color={t.c.primary}>
            {serviceName(booking.serviceId).toUpperCase()}
          </Text>
          <Text size={15} weight="bold" color={t.c.textStrong} numberOfLines={1}>
            {mode === 'vendor' ? project.title : booking.providerName}
          </Text>
          <Text size={12} color={t.c.muted} numberOfLines={1}>
            {events.map((e) => `${e.name}${e.date ? ` ${formatShortDate(e.date).slice(4)}` : ''}`).join(' · ') || 'Events TBC'}
          </Text>
        </View>
        <StatusPill status={status} label={status === 'pending' ? 'Awaiting provider' : undefined} />
      </View>
      <View style={styles.moneyRow}>
        {mode === 'customer' && <Money label="Price" value={booking.agreedPrice} />}
        {mode === 'vendor' && (
          <>
            <Money label="You receive" value={booking.providerPayable} />
            <Money label="Platform fee" value={booking.platformFee} muted />
          </>
        )}
        {mode === 'platform' && (
          <>
            <Money label="Customer" value={booking.agreedPrice} />
            <Money label="Provider" value={booking.providerPayable} muted />
            <Money label={booking.pricingModel === 'MARKUP' ? 'Markup' : booking.pricingModel === 'LEAD_FEE' ? 'Lead fee' : 'Commission'} value={booking.platformFee} tone={t.c.success} />
          </>
        )}
      </View>
      {(needed > 0 && mode !== 'customer') || booking.deliverables.length > 0 ? (
        <View style={styles.row}>
          {needed > 0 && mode !== 'customer' && (
            <View style={{ flex: 1, gap: 4 }}>
              <Text size={11} color={t.c.muted}>
                Crew {filled}/{needed}
              </Text>
              <ProgressBar value={filled / needed} color={filled >= needed ? t.c.success : t.c.warning} />
            </View>
          )}
          {booking.deliverables.length > 0 && (
            <View style={{ flex: 1, gap: 4 }}>
              <Text size={11} color={t.c.muted}>
                Deliverables {delivered}/{booking.deliverables.length}
              </Text>
              <ProgressBar value={booking.deliverables.reduce((s, d) => s + d.progress, 0) / booking.deliverables.length} color={t.c.info} />
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function Money({ label, value, muted, tone }: { label: string; value: number; muted?: boolean; tone?: string }) {
  const t = useRoleTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text size={11} color={t.c.muted}>
        {label}
      </Text>
      <Text size={14} weight="bold" color={tone ?? (muted ? t.c.text : t.c.textStrong)}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

// ── Crew ─────────────────────────────────────────────────────────────────

function AssignmentRow({ project, booking, a, mode }: { project: Project; booking: ServiceBooking; a: Assignment; mode: WorkMode }) {
  const t = useRoleTheme();
  const setStatus = useDb((s) => s.setAssignmentStatus);
  const confirmWork = useDb((s) => s.confirmAssignmentWork);
  const startEmergency = useDb((s) => s.startEmergencyReplacement);
  const [emergency, setEmergency] = useState(false);
  const [reason, setReason] = useState('');
  const replacement = booking.assignments.find((x) => x.replacesId === a.id);
  const emergencyGig = useDb((s) => s.gigs.find((g) => g.replacesAssignmentId === a.id));
  const canManage = mode === 'platform' || mode === 'vendor';

  return (
    <View style={[styles.assignment, { borderColor: a.status === 'EMERGENCY_REPLACEMENT' ? t.c.danger : t.c.border }]}>
      <View style={styles.row}>
        <Avatar name={a.workerName} size={36} />
        <View style={{ flex: 1 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            {a.workerName}
            {a.workerKind === 'staff' ? ' · staff' : ''}
          </Text>
          <Text size={12} color={t.c.muted}>
            {a.role} · {formatShortDate(a.date)} {formatClock(a.startTime)} · {formatMoney(a.pay)}
          </Text>
          {a.checkedInAt && (
            <Text size={11} color={t.c.success}>
              In {formatTime(a.checkedInAt)}
              {a.checkedOutAt ? ` · out ${formatTime(a.checkedOutAt)}` : ''}
              {a.lateMinutes ? ` · ${a.lateMinutes} min late` : ''}
            </Text>
          )}
          {a.status === 'EMERGENCY_REPLACEMENT' && (
            <Text size={11} color={t.c.danger}>
              {a.checkInNote ?? 'Unavailable'} · {replacement ? `replaced by ${replacement.workerName}` : 'finding replacement…'}
            </Text>
          )}
        </View>
        <StatusPill status={a.status} label={a.status === 'EMERGENCY_REPLACEMENT' ? 'Emergency' : undefined} />
      </View>
      {canManage && (
        <View style={styles.actionsRow}>
          {a.status === 'ASSIGNED' && mode === 'platform' && <KButton label="Mark confirmed" size="sm" variant="secondary" onPress={() => setStatus(project.id, booking.id, a.id, 'CONFIRMED')} style={{ flex: 1 }} />}
          {a.status === 'COMPLETED' && !a.confirmedByProvider && (
            <KButton
              label="Confirm work"
              size="sm"
              variant="success"
              icon="checkmark-done"
              onPress={() => {
                confirmWork(project.id, booking.id, a.id);
                toast(`Payout for ${a.workerName} is ready`, 'wallet');
              }}
              style={{ flex: 1 }}
            />
          )}
          {['ASSIGNED', 'CONFIRMED', 'INVITED'].includes(a.status) && daysUntil(a.date) <= 7 && (
            <KButton label="Emergency" size="sm" variant="danger" icon="medkit-outline" onPress={() => setEmergency(true)} style={{ flex: 1 }} />
          )}
          {['ASSIGNED', 'CONFIRMED'].includes(a.status) && daysUntil(a.date) <= 0 && (
            <KButton label="No-show" size="sm" variant="ghost" onPress={() => confirm('Mark as no-show?', `${a.workerName} did not arrive. This affects their reliability score.`, 'No-show', () => setStatus(project.id, booking.id, a.id, 'NO_SHOW'))} style={{ flex: 1 }} />
          )}
          {a.status === 'EMERGENCY_REPLACEMENT' && !replacement && emergencyGig && (
            <KButton
              label="Open emergency gig"
              size="sm"
              variant="secondary"
              icon="megaphone-outline"
              onPress={() => router.push(mode === 'platform' ? { pathname: '/platform/gig/[id]', params: { id: emergencyGig.id } } : { pathname: '/business/gig/[id]', params: { id: emergencyGig.id } })}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
      <Sheet visible={emergency} onClose={() => setEmergency(false)} title="Emergency replacement">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Text size={14} color={t.c.muted}>
            {a.workerName} will be released and an urgent gig ({formatMoney(Math.round((a.pay * 1.25) / 500) * 500)}, +25%) goes out to the best available {a.role.toLowerCase()}s nearby with matching equipment and high reliability.
          </Text>
          <ChoiceChips options={['Sick', 'Family emergency', 'Vehicle breakdown', 'Not responding']} selected={[reason]} onToggle={setReason} />
          <KField placeholder="Or describe what happened" value={reason} onChangeText={setReason} />
          <KButton
            label="Start emergency replacement"
            variant="danger"
            icon="medkit"
            disabled={!reason.trim()}
            onPress={() => {
              const gig = startEmergency(project.id, booking.id, a.id, reason.trim());
              setEmergency(false);
              triggerHaptic('medium');
              toast('Emergency gig sent to nearby crew', 'megaphone');
              if (gig) router.push(mode === 'platform' ? { pathname: '/platform/gig/[id]', params: { id: gig.id } } : { pathname: '/business/gig/[id]', params: { id: gig.id } });
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/** Pick a freelancer (ranked by fit) or in-house staff for a crew slot. */
export function WorkerPicker({ project, booking, crew, visible, onClose }: { project: Project; booking: ServiceBooking; crew: CrewRequirement | null; visible: boolean; onClose: () => void }) {
  const t = useRoleTheme();
  const account = useAccount();
  const availability = useDb((s) => s.availability);
  const pool = useDb((s) => s.freelancerPool)();
  const staffAll = useDb((s) => s.staff);
  const assignWorker = useDb((s) => s.assignWorker);
  const postGig = useDb((s) => s.postGig);
  const [tab, setTab] = useState<'freelancers' | 'staff'>('freelancers');
  if (!crew) return null;
  const event = project.events.find((e) => e.id === crew.eventId) ?? project.events.find((e) => booking.eventIds.includes(e.id));
  const date = event?.date ?? project.weddingDate;
  const ranked = rankFreelancers({ role: crew.role, date, city: event?.city ?? project.city, pay: crew.pay, equipment: crew.equipment }, { availability, pool, skipIds: booking.assignments.filter((a) => ACTIVE.includes(a.status)).map((a) => a.workerId) }, { limit: 12, includeExcluded: true });
  const staff = staffAll.filter((m) => m.orgAccountId === (booking.providerAccountId ?? account.id) && m.active);

  return (
    <Sheet visible={visible} onClose={onClose} title={`Assign ${crew.role}`}>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <Text size={13} color={t.c.muted}>
          {event?.name ?? 'Event'} · {formatShortDate(date)} · {formatMoney(crew.pay)} {crew.equipment.length ? `· needs ${crew.equipment.join(', ')}` : ''}
        </Text>
        <ChoiceChips options={['Freelancers', 'In-house staff']} selected={[tab === 'freelancers' ? 'Freelancers' : 'In-house staff']} onToggle={(v) => setTab(v === 'Freelancers' ? 'freelancers' : 'staff')} />
      </View>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 10 }}>
        {tab === 'freelancers' &&
          ranked.map((r) => (
            <Pressable
              key={r.freelancer.id}
              disabled={!!r.excluded}
              onPress={() => {
                assignWorker(project.id, booking.id, crew.id, { id: r.freelancer.id, name: r.freelancer.name, kind: 'freelancer' }, { pay: crew.pay });
                toast(`${r.freelancer.name} assigned`, 'person-add');
                onClose();
              }}
              style={({ pressed }) => [styles.pick, { borderColor: t.c.border, opacity: r.excluded ? 0.45 : pressed ? 0.7 : 1 }]}>
              <Avatar name={r.freelancer.name} size={38} />
              <View style={{ flex: 1 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {r.freelancer.name}
                </Text>
                <Text size={12} color={t.c.muted} numberOfLines={1}>
                  {r.excluded ?? [...r.reasons, ...r.warnings].join(' · ')}
                </Text>
              </View>
              <Text size={14} weight="bold" color={r.excluded ? t.c.muted : t.c.primary}>
                {r.excluded ? '—' : Math.round(r.score)}
              </Text>
            </Pressable>
          ))}
        {tab === 'staff' &&
          (staff.length ? (
            staff.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  assignWorker(project.id, booking.id, crew.id, { id: m.id, name: m.name, kind: 'staff' }, { pay: 0 });
                  toast(`${m.name} assigned`, 'person-add');
                  onClose();
                }}
                style={({ pressed }) => [styles.pick, { borderColor: t.c.border, opacity: pressed ? 0.7 : 1 }]}>
                <Avatar name={m.name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {m.name}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {m.role}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text size={13} color={t.c.muted}>
              No in-house staff yet — add your team under Business → Team.
            </Text>
          ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20 }}>
        <KButton
          label="Post as open gig instead"
          variant="secondary"
          icon="megaphone-outline"
          onPress={() => {
            const gig = postGig({
              title: `${crew.role} — ${project.title}`,
              skill: crew.role,
              postedById: account.role === 'platform' ? 'platform' : account.id,
              postedByName: account.role === 'platform' ? 'Vivah Operations' : (account.businessName ?? account.name),
              postedByKind: account.role === 'platform' ? 'platform' : 'vendor',
              projectId: project.id,
              eventId: event?.id,
              bookingId: booking.id,
              crewId: crew.id,
              city: event?.city ?? project.city,
              location: event?.venue,
              date,
              startTime: event?.startTime ?? '08:00',
              hours: 10,
              pay: crew.pay,
              description: `${crew.role} for ${event?.name ?? 'the event'} (${project.guests} guests).`,
              requirements: crew.equipment,
              equipment: crew.equipment,
              slots: Math.max(1, crew.count - booking.assignments.filter((a) => a.crewId === crew.id && ACTIVE.includes(a.status)).length),
              invited: ranked.filter((r) => !r.excluded).slice(0, 5).map((r) => r.freelancer.id),
            });
            toast('Gig posted and top 5 matches invited', 'megaphone');
            onClose();
            router.push(account.role === 'platform' ? { pathname: '/platform/gig/[id]', params: { id: gig.id } } : { pathname: '/business/gig/[id]', params: { id: gig.id } });
          }}
        />
      </View>
    </Sheet>
  );
}

export function CrewPanel({ project, booking, mode }: { project: Project; booking: ServiceBooking; mode: WorkMode }) {
  const t = useRoleTheme();
  const [picking, setPicking] = useState<CrewRequirement | null>(null);
  const canManage = mode === 'platform' || mode === 'vendor';
  if (!booking.crew.length && !booking.assignments.length) {
    return (
      <Text size={13} color={t.c.muted}>
        No crew plan for this service.
      </Text>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {booking.crew.map((c) => {
        const assigned = booking.assignments.filter((a) => a.crewId === c.id);
        const active = assigned.filter((a) => ACTIVE.includes(a.status)).length;
        return (
          <View key={c.id} style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <Text size={14} weight="bold" color={t.c.textStrong}>
                {c.role} · {active}/{c.count}
              </Text>
              <Text size={12} color={t.c.muted}>
                {formatMoney(c.pay)} each · {c.staffing === 'marketplace' ? 'via gigs' : 'in-house'}
              </Text>
            </View>
            {assigned.map((a) => (
              <AssignmentRow key={a.id} project={project} booking={booking} a={a} mode={mode} />
            ))}
            {canManage && active < c.count && booking.status !== 'CANCELLED' && (
              <KButton label={`Assign ${c.role.toLowerCase()}`} size="sm" variant="secondary" icon="person-add-outline" onPress={() => setPicking(c)} />
            )}
          </View>
        );
      })}
      {booking.assignments
        .filter((a) => !a.crewId || !booking.crew.some((c) => c.id === a.crewId))
        .map((a) => (
          <AssignmentRow key={a.id} project={project} booking={booking} a={a} mode={mode} />
        ))}
      <WorkerPicker project={project} booking={booking} crew={picking} visible={!!picking} onClose={() => setPicking(null)} />
    </View>
  );
}

// ── Deliverables ─────────────────────────────────────────────────────────

function DeliverableRow({ project, booking, d, mode }: { project: Project; booking: ServiceBooking; d: Deliverable; mode: WorkMode }) {
  const t = useRoleTheme();
  const update = useDb((s) => s.updateDeliverable);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [link, setLink] = useState(d.link ?? '');
  const [progress, setProgress] = useState(Math.round(d.progress * 100));
  const overdue = d.status !== 'DELIVERED' && d.status !== 'APPROVED' && daysUntil(d.due) < 0;
  const provider = mode === 'vendor' || mode === 'platform';

  return (
    <View style={[styles.deliverable, { borderColor: overdue ? t.c.danger : t.c.border }]}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            {d.title}
            {d.quantity ? ` · ${d.quantity} ${d.unit ?? ''}` : ''}
          </Text>
          <Text size={12} color={overdue ? t.c.danger : t.c.muted}>
            Due {formatShortDate(d.due)} ({relativeDay(d.due)}){d.revisions ? ` · revision ${d.revisions}/${d.revisionLimit}` : ''}
          </Text>
        </View>
        <StatusPill status={d.status} />
      </View>
      <ProgressBar value={d.progress} color={d.status === 'REVISION_REQUESTED' ? t.c.warning : t.c.success} />
      {!!d.link && (
        <Pressable onPress={() => Linking.openURL(d.link!)} style={styles.inline}>
          <Ionicons name="link-outline" size={14} color={t.c.primary} />
          <Text size={12} weight="semibold" color={t.c.primary} numberOfLines={1}>
            Open delivery folder
          </Text>
        </Pressable>
      )}
      {mode === 'customer' && d.status === 'READY_FOR_REVIEW' && (
        <View style={{ gap: 8 }}>
          <KField placeholder="Comments or changes (optional)" value={note} onChangeText={setNote} />
          <View style={styles.actionsRow}>
            <KButton
              label="Request changes"
              size="sm"
              variant="secondary"
              disabled={d.revisions >= d.revisionLimit || !note.trim()}
              onPress={() => {
                update(project.id, booking.id, d.id, { status: 'REVISION_REQUESTED' }, note.trim());
                toast('Changes requested', 'create');
              }}
              style={{ flex: 1 }}
            />
            <KButton
              label="Approve"
              size="sm"
              icon="checkmark"
              onPress={() => {
                update(project.id, booking.id, d.id, { status: 'APPROVED' }, note.trim() || undefined);
                triggerHaptic('success');
                toast(`${d.title} approved`, 'checkmark-circle');
              }}
              style={{ flex: 1 }}
            />
          </View>
          {d.revisions >= d.revisionLimit && (
            <Text size={11} color={t.c.muted}>
              Revision limit reached — contact your coordinator for more changes.
            </Text>
          )}
        </View>
      )}
      {provider && d.status !== 'DELIVERED' && (
        <>
          {editing ? (
            <View style={{ gap: 8 }}>
              <ChoiceChips options={['0', '25', '50', '75', '100'].map((p) => `${p}%`)} selected={[`${Math.round(progress / 25) * 25}%`]} onToggle={(v) => setProgress(Number(v.replace('%', '')))} />
              <KField placeholder="Delivery link (Google Drive / WeTransfer)" value={link} onChangeText={setLink} autoCapitalize="none" />
              <View style={styles.actionsRow}>
                <KButton
                  label="Save progress"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    update(project.id, booking.id, d.id, { progress: progress / 100, link: link || undefined, status: d.status === 'NOT_STARTED' && progress > 0 ? 'IN_PROGRESS' : d.status });
                    setEditing(false);
                  }}
                  style={{ flex: 1 }}
                />
                <KButton
                  label="Ready for review"
                  size="sm"
                  icon="eye"
                  disabled={!link.trim()}
                  onPress={() => {
                    update(project.id, booking.id, d.id, { status: 'READY_FOR_REVIEW', link: link.trim() });
                    setEditing(false);
                    toast('Customer notified to review', 'paper-plane');
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <KButton label="Update" size="sm" variant="ghost" icon="create-outline" onPress={() => setEditing(true)} style={{ flex: 1 }} />
              {d.status === 'APPROVED' && <KButton label="Mark delivered" size="sm" variant="success" onPress={() => update(project.id, booking.id, d.id, { status: 'DELIVERED' })} style={{ flex: 1 }} />}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function DeliverablesPanel({ project, booking, mode }: { project: Project; booking: ServiceBooking; mode: WorkMode }) {
  const t = useRoleTheme();
  const addDeliverable = useDb((s) => s.addDeliverable);
  const [title, setTitle] = useState('');
  if (!booking.deliverables.length && mode === 'customer') return null;
  return (
    <View style={{ gap: 10 }}>
      {booking.deliverables.map((d) => (
        <DeliverableRow key={d.id} project={project} booking={booking} d={d} mode={mode} />
      ))}
      {!booking.deliverables.length && (
        <Text size={13} color={t.c.muted}>
          No deliverables tracked for this booking.
        </Text>
      )}
      {(mode === 'vendor' || mode === 'platform') && (
        <View style={styles.actionsRow}>
          <View style={{ flex: 1 }}>
            <KField placeholder="Add deliverable (e.g. Same-day edit)" value={title} onChangeText={setTitle} />
          </View>
          <KButton
            label="Add"
            size="sm"
            disabled={!title.trim()}
            onPress={() => {
              addDeliverable(project.id, booking.id, { title: title.trim(), kind: 'other', due: project.weddingDate });
              setTitle('');
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moneyRow: { flexDirection: 'row', gap: 10 },
  assignment: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  deliverable: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
