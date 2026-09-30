import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Avatar, StatusPill } from '@/components/kit';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { bsMonthLabel } from '@/data/events';
import { findService, serviceName } from '@/data/services';
import { occasionOf } from '@/services/experience';
import { planningProgress } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { paymentSummary } from '@/services/pricing';
import type { Project, ProjectEvent, RequirementStatus } from '@/types/platform';
import { daysUntil, formatLongDate, formatMoney, formatMoneyCompact, formatShortDate, fromISODate, pluralize } from '@/utils/format';

const SCRIM = ['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.78)'] as const;
const OVERLAY_BUTTON = 'rgba(20,16,12,0.34)';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The main ceremony: the one the countdown and the hero date refer to. */
export const mainEvent = (project: Project): ProjectEvent | undefined => project.events.find((e) => e.type === project.eventType) ?? project.events[0];

export const HERO_HEIGHT = 300;

/** Full-bleed photo header with the couple's names set over a dark scrim. */
export function WeddingHero({
  project,
  shared,
  onBack,
  actions,
}: {
  project: Project;
  shared?: boolean;
  onBack: () => void;
  actions?: { icon: 'calendar-outline' | 'globe-outline' | 'share-outline'; label: string; onPress: () => void }[];
}) {
  const insets = useSafeAreaInsets();
  const main = mainEvent(project);
  const cover = project.inspiration[0] ?? 'ideaCoupleGardenWalk';
  return (
    <View style={[styles.hero, { height: HERO_HEIGHT + insets.top }]}>
      <Image source={photos[cover]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: '50%', top: '38%' }} transition={250} />
      <LinearGradient colors={SCRIM} locations={[0, 0.3, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.heroTop, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevron-back" iconSize={22} color={colors.white} background={OVERLAY_BUTTON} accessibilityLabel="Go back" onPress={onBack} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {actions?.map((a) => (
            <IconButton key={a.label} icon={a.icon} iconSize={20} color={colors.white} background={OVERLAY_BUTTON} accessibilityLabel={a.label} onPress={a.onPress} />
          ))}
        </View>
      </View>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.heroBottom}>
        <Text size={13} color="rgba(255,255,255,0.86)">
          {main?.date ? `${formatLongDate(main.date)} · ${bsMonthLabel(main.date)}` : 'Date to be fixed'}
        </Text>
        <Text serif size={32} weight="bold" lineHeight={42} color={colors.white} numberOfLines={2}>
          {project.title}
        </Text>
        <Text size={13} color="rgba(255,255,255,0.78)">
          {project.area ? `${project.area}, ` : ''}
          {project.city} · {project.code}
          {shared ? ' · shared with you' : ''}
        </Text>
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress; animates to its value on mount and on change. */
export function ProgressRing({ value, size = 68, stroke = 6, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 900 }));
  }, [progress, value]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }) {
  return (
    <View style={[styles.stat, !last && styles.statBorder]}>
      <Text size={12} color={colors.textMuted} numberOfLines={1}>
        {label}
      </Text>
      <Text size={16} weight="semibold" color={tone ?? colors.heading} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** Countdown, overall progress and the four numbers couples check most. */
export function CountdownCard({ project, onSetDate }: { project: Project; onSetDate: () => void }) {
  const occasions = useDb((s) => s.occasions);
  const occasion = occasionOf(project, occasions);
  const main = mainEvent(project);
  const progress = planningProgress(project);
  const days = main?.date ? daysUntil(main.date) : null;
  const pct = Math.round(progress.overall * 100);
  const overdue = progress.pay.overdue.length > 0;
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.countdown}>
      <View style={styles.countTop}>
        <View style={{ flex: 1 }}>
          {days === null ? (
            <>
              <Text size={12} color={colors.textMuted}>
                {occasion.id === 'wedding' ? 'Wedding date' : `${main ? main.name : occasion.label} date`}
              </Text>
              <Text serif size={26} weight="bold" lineHeight={36} color={colors.heading}>
                Not fixed yet
              </Text>
              <Pressable onPress={onSetDate} hitSlop={8} accessibilityRole="button">
                <Text size={14} weight="semibold" color={colors.primary}>
                  Set the date
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text size={12} color={colors.textMuted}>
                {days > 0 ? (days === 1 ? 'Day to go' : 'Days to go') : days === 0 ? 'The big day' : `Days since the ${occasion.id === 'wedding' ? 'wedding' : occasion.vocab.noun}`}
              </Text>
              <Text serif size={44} weight="bold" lineHeight={54} color={colors.heading}>
                {days === 0 ? 'Today' : Math.abs(days)}
              </Text>
              {days > 0 && (
                <Text size={13} color={colors.textMuted}>
                  {days >= 14 ? `About ${Math.round(days / 7)} weeks` : 'Final stretch'} · {formatShortDate(main!.date!)}
                </Text>
              )}
            </>
          )}
        </View>
        <View style={styles.ringWrap}>
          <ProgressRing value={progress.overall}>
            <Text size={16} weight="bold" color={colors.heading} lineHeight={20}>
              {pct}%
            </Text>
          </ProgressRing>
          <Text size={12} color={colors.textMuted}>
            Planned
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat label="Booked" value={`${progress.services.confirmed}/${progress.services.total}`} />
        <Stat label="Paid" value={progress.pay.total ? formatMoneyCompact(progress.pay.paid).replace('NPR ', '') : '—'} tone={overdue ? colors.danger : undefined} />
        <Stat label="Tasks done" value={`${progress.tasks.done}/${progress.tasks.total}`} />
        <Stat label="Guests" value={String(project.guests)} last />
      </View>
    </Animated.View>
  );
}

/** Section heading with an optional text action on the right. */
export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <Text size={17} weight="bold" color={colors.heading}>
          {title}
        </Text>
        {action && onAction && (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
            <Text size={14} weight="medium" color={colors.primary}>
              {action}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** Horizontal run of the wedding functions, next one highlighted. */
export function FunctionsStrip({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const events = [...project.events].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const next = events.find((e) => e.date && daysUntil(e.date) >= 0 && e.status !== 'done');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
      {events.map((e) => {
        const d = e.date ? fromISODate(e.date) : null;
        const isNext = e.id === next?.id;
        const past = !!e.date && daysUntil(e.date) < 0;
        return (
          <Pressable
            key={e.id}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, ${e.date ? formatLongDate(e.date) : 'date to be confirmed'}`}
            style={({ pressed }) => [styles.fn, isNext && { borderColor: colors.heading }, pressed && { backgroundColor: colors.bgSoft }]}>
            <View style={styles.fnDate}>
              {d ? (
                <>
                  <Text serif size={28} weight="bold" lineHeight={34} color={isNext ? colors.primary : past ? colors.textSubtle : colors.heading}>
                    {d.getDate()}
                  </Text>
                  <Text size={12} color={colors.textMuted} lineHeight={15}>
                    {MONTHS[d.getMonth()]}
                    {'\n'}
                    {DAYS[d.getDay()]}
                  </Text>
                </>
              ) : (
                <Text size={13} weight="semibold" color={colors.textMuted}>
                  Date to be{'\n'}confirmed
                </Text>
              )}
            </View>
            <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
              {e.name}
            </Text>
            <Text size={12} color={colors.textMuted} numberOfLines={1}>
              {e.venue === 'To be decided' ? 'Venue to be decided' : e.venue}
            </Text>
            <Text size={12} color={colors.textMuted} numberOfLines={1}>
              {e.dateConfirmed ? `${e.guests} guests` : e.date ? 'Provisional date' : `${e.guests} guests`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const REQ_LABEL: Record<RequirementStatus, string> = {
  OPEN: 'Finding providers',
  MATCHING: 'Finding providers',
  SHORTLISTED: 'Shortlisted',
  QUOTED: 'Quoted',
  CONFIRMED: 'Booked',
  CANCELLED: 'Cancelled',
};

/** Booked / in progress / searching, as one bar plus the first few services. */
export function ServicesSummary({ project, onOpen, limit = 5 }: { project: Project; onOpen: () => void; limit?: number }) {
  const reqs = project.requirements.filter((r) => r.status !== 'CANCELLED');
  const booked = reqs.filter((r) => r.status === 'CONFIRMED').length;
  const progressing = reqs.filter((r) => r.status === 'SHORTLISTED' || r.status === 'QUOTED').length;
  const searching = reqs.length - booked - progressing;
  // Booked last in the list so what still needs attention comes first.
  const order: Record<RequirementStatus, number> = { QUOTED: 0, SHORTLISTED: 1, MATCHING: 2, OPEN: 3, CONFIRMED: 4, CANCELLED: 5 };
  const shown = [...reqs].sort((a, b) => order[a.status] - order[b.status]).slice(0, limit);

  if (!reqs.length) {
    return (
      <View style={styles.panel}>
        <Text size={14} color={colors.textMuted}>
          No services yet. Add what you need and your coordinator will match providers.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.bar}>
        {booked > 0 && <View style={{ flex: booked, backgroundColor: colors.success }} />}
        {progressing > 0 && <View style={{ flex: progressing, backgroundColor: colors.marigold }} />}
        {searching > 0 && <View style={{ flex: searching, backgroundColor: colors.divider }} />}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.success} label={`${booked} booked`} />
        <Legend color={colors.marigold} label={`${progressing} in progress`} />
        <Legend color={colors.stepInactive} label={`${searching} searching`} />
      </View>
      <View>
        {shown.map((r, i) => {
          const def = findService(r.serviceId);
          const booking = project.bookings.find((b) => b.requirementId === r.id && b.status !== 'CANCELLED');
          return (
            <Pressable key={r.id} onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.svcRow, i > 0 && styles.svcBorder, pressed && { opacity: 0.7 }]}>
              <Ionicons name={(def?.icon ?? 'briefcase-outline') as never} size={20} color={colors.textBody} />
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
                  {serviceName(r.serviceId)}
                </Text>
                <Text size={12} color={colors.textMuted} numberOfLines={1}>
                  {booking ? booking.providerName : r.candidates.length ? `${pluralize(r.candidates.length, 'provider')} matched` : 'Your coordinator is on it'}
                </Text>
              </View>
              <StatusPill status={r.status} label={REQ_LABEL[r.status]} />
            </Pressable>
          );
        })}
      </View>
      {reqs.length > shown.length && (
        <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text size={14} weight="semibold" color={colors.primary}>
            All {reqs.length} services
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text size={12} color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

/** Paid vs. total and the next instalment; the budget before a quotation exists. */
export function MoneyCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const pay = paymentSummary(project);
  if (!pay.total) {
    return (
      <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.panel, pressed && { backgroundColor: colors.bgSoft }]}>
        <Text size={12} color={colors.textMuted}>
          Budget
        </Text>
        <Text size={22} weight="bold" color={colors.heading}>
          {project.budget ? formatMoney(project.budget) : 'Not set yet'}
        </Text>
        <Text size={13} color={colors.textMuted}>
          Your payment plan appears here once you accept a quotation.
        </Text>
      </Pressable>
    );
  }
  const share = pay.paid / pay.total;
  const late = pay.overdue.length > 0;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.panel, pressed && { backgroundColor: colors.bgSoft }]}>
      <View style={styles.moneyTop}>
        <View style={{ flex: 1 }}>
          <Text size={12} color={colors.textMuted}>
            Paid so far
          </Text>
          <Text size={22} weight="bold" color={colors.heading}>
            {formatMoney(pay.paid)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={12} color={colors.textMuted}>
            Total
          </Text>
          <Text size={15} weight="semibold" color={colors.heading}>
            {formatMoneyCompact(pay.total)}
          </Text>
        </View>
      </View>
      <View style={styles.moneyBar}>
        <View style={{ width: `${Math.round(share * 100)}%`, backgroundColor: colors.heading, height: '100%' }} />
      </View>
      {pay.next ? (
        <View style={styles.moneyNext}>
          <Ionicons name={late ? 'alert-circle-outline' : 'calendar-outline'} size={16} color={late ? colors.danger : colors.textMuted} />
          <Text size={13} color={late ? colors.danger : colors.textBody} style={{ flex: 1 }}>
            Next {formatMoney(pay.next.amount - pay.next.paidAmount)} · {pay.next.label} · {late ? 'overdue' : `due ${formatShortDate(pay.next.due)}`}
          </Text>
        </View>
      ) : (
        <Text size={13} color={colors.success}>
          All paid. Dhanyabad!
        </Text>
      )}
    </Pressable>
  );
}

/** The couple, family collaborators and an invite affordance. */
export function PeopleRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const people = [project.customerName, ...project.collaborators.map((c) => c.name)];
  const pending = project.collaborators.filter((c) => !c.joinedAt).length;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.panel, styles.people, pressed && { backgroundColor: colors.bgSoft }]}>
      <View style={styles.avatars}>
        {people.slice(0, 4).map((name, i) => (
          <View key={`${name}${i}`} style={[styles.avatarRing, i > 0 && { marginLeft: -10 }]}>
            <Avatar name={name} size={34} />
          </View>
        ))}
        <View style={[styles.avatarRing, styles.addAvatar, { marginLeft: -10 }]}>
          <Ionicons name="add" size={18} color={colors.textBody} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text size={15} weight="semibold" color={colors.heading}>
          Planning together
        </Text>
        <Text size={12} color={colors.textMuted} numberOfLines={1}>
          {pluralize(people.length, 'person', 'people')}
          {pending ? ` · ${pending} invite${pending > 1 ? 's' : ''} pending` : ' · invite family'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', backgroundColor: colors.heading, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  heroBottom: { paddingHorizontal: 20, paddingBottom: 44, gap: 2 },
  countdown: { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: -28 },
  countTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 14 },
  ringWrap: { alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 12 },
  stat: { flex: 1, paddingHorizontal: 12, gap: 1 },
  statBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  fn: { width: 156, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, gap: 2, backgroundColor: colors.white },
  fnDate: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 36 },
  panel: { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: colors.white },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  svcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  svcBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  moneyTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  moneyBar: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  moneyNext: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderRadius: 19, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.white },
  addAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderColor: colors.white, backgroundColor: colors.bgMuted },
});
